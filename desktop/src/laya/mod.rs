use std::{
    path::PathBuf,
    process::Stdio,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri::{ipc::Channel, Manager};
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout, Command},
    sync::{watch, Mutex},
};

const WORKER: &str = include_str!("worker.py");
const PACKAGE: &str = "laya==0.3.24";
const SETUP_TIMEOUT: Duration = Duration::from_secs(900);
const LOAD_TIMEOUT: Duration = Duration::from_secs(120);
const PREDICT_TIMEOUT: Duration = Duration::from_secs(5);

pub struct LayaState {
    worker: Mutex<Option<Worker>>,
    busy: AtomicBool,
    cancel: watch::Sender<u64>,
}

impl Default for LayaState {
    fn default() -> Self {
        Self {
            worker: Mutex::new(None),
            busy: AtomicBool::new(false),
            cancel: watch::channel(0).0,
        }
    }
}

struct Worker {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    installed: bool,
    loaded: bool,
    busy: bool,
}

fn root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|p| p.join("experimental-laya-v1"))
        .map_err(|_| "storage-unavailable".to_owned())
}

fn python(directory: &std::path::Path) -> PathBuf {
    directory.join("venv").join(if cfg!(windows) {
        "Scripts/python.exe"
    } else {
        "bin/python"
    })
}

fn command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut command = Command::new(program);
    command
        .kill_on_drop(true)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command
        .env("HF_HUB_DISABLE_TELEMETRY", "1")
        .env("DO_NOT_TRACK", "1")
        .env("PIP_DISABLE_PIP_VERSION_CHECK", "1")
        .env("PYTHONNOUSERSITE", "1");
    command
}

async fn finish(mut command: Command) -> Result<(), String> {
    let status = command
        .status()
        .await
        .map_err(|_| "runtime-unavailable".to_owned())?;
    if status.success() {
        Ok(())
    } else {
        Err("setup-failed".to_owned())
    }
}

async fn interpreter() -> Result<PathBuf, String> {
    let search = crate::augment_path(
        &std::env::var("PATH").unwrap_or_default(),
        &crate::mcp_candidate_dirs(),
    );
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/"));
    for name in [
        "python3",
        "python3.13",
        "python3.12",
        "python3.11",
        "python3.10",
        "python",
    ] {
        let Ok(path) = which::which_in(name, Some(&search), &cwd) else {
            continue;
        };
        let mut probe = command(&path);
        probe.args([
            "-I",
            "-c",
            "import sys; sys.exit(0 if (3,10) <= sys.version_info < (3,14) else 1)",
        ]);
        if tokio::time::timeout(Duration::from_secs(5), finish(probe))
            .await
            .is_ok_and(|r| r.is_ok())
        {
            return Ok(path);
        }
    }
    Err("python-required".to_owned())
}

async fn read<R: tokio::io::AsyncBufRead + Unpin>(
    output: &mut R,
) -> Result<serde_json::Value, String> {
    let mut bytes = Vec::new();
    output
        .take(65537)
        .read_until(b'\n', &mut bytes)
        .await
        .map_err(|_| "runtime-failed".to_owned())?;
    if bytes.len() > 65536 || bytes.last() != Some(&b'\n') {
        return Err("runtime-failed".to_owned());
    }
    serde_json::from_slice(&bytes).map_err(|_| "runtime-failed".to_owned())
}

async fn spawn(directory: &std::path::Path, mode: &str) -> Result<Worker, String> {
    let mut process = command(python(directory));
    process
        .args(["-I", "-u", "-c", WORKER, mode])
        .arg(directory.join("model"))
        .env("HF_HOME", directory.join("cache"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped());
    let mut child = process
        .spawn()
        .map_err(|_| "runtime-unavailable".to_owned())?;
    let input = child.stdin.take().ok_or("runtime-failed")?;
    let output = BufReader::new(child.stdout.take().ok_or("runtime-failed")?);
    Ok(Worker {
        child,
        input,
        output,
    })
}

async fn load(directory: &std::path::Path) -> Result<Worker, String> {
    let mut worker = spawn(directory, "run").await?;
    let ready = read(&mut worker.output).await?;
    if ready["stage"] != "ready" {
        return Err("runtime-failed".to_owned());
    }
    Ok(worker)
}

fn worker_alive(current: &mut Option<Worker>) -> bool {
    let alive = current
        .as_mut()
        .is_some_and(|worker| worker.child.try_wait().is_ok_and(|status| status.is_none()));
    if !alive {
        *current = None;
    }
    alive
}

#[tauri::command]
pub async fn laya_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, LayaState>,
) -> Result<Status, String> {
    let directory = root(&app)?;
    let loaded = worker_alive(&mut *state.worker.lock().await);
    Ok(Status {
        installed: directory.join("ready").is_file() && python(&directory).is_file(),
        loaded,
        busy: state.busy.load(Ordering::Acquire),
    })
}

#[tauri::command]
pub async fn laya_prepare(
    app: tauri::AppHandle,
    state: tauri::State<'_, LayaState>,
    progress: Channel<serde_json::Value>,
) -> Result<(), String> {
    if state.busy.swap(true, Ordering::AcqRel) {
        return Err("busy".to_owned());
    }
    let mut cancel = state.cancel.subscribe();
    let operation = async {
        let directory = root(&app)?;
        tokio::fs::create_dir_all(&directory)
            .await
            .map_err(|_| "storage-unavailable".to_owned())?;
        if !directory.join("ready").is_file() {
            let _ = progress.send(serde_json::json!({"stage": "runtime"}));
            if !python(&directory).is_file() {
                let mut create = command(interpreter().await?);
                create
                    .args(["-I", "-m", "venv"])
                    .arg(directory.join("venv"));
                finish(create).await?;
            }
            let mut repair = command(python(&directory));
            repair.args(["-I", "-m", "ensurepip", "--upgrade"]);
            finish(repair).await?;
            let mut install = command(python(&directory));
            install.args([
                "-I",
                "-m",
                "pip",
                "--isolated",
                "install",
                "--disable-pip-version-check",
                "--index-url",
                "https://pypi.org/simple",
                PACKAGE,
            ]);
            install.arg("--cache-dir").arg(directory.join("pip-cache"));
            finish(install).await?;
            let _ = progress.send(serde_json::json!({"stage": "download"}));
            let mut worker = spawn(&directory, "prepare").await?;
            loop {
                let event = read(&mut worker.output).await?;
                if event["stage"] == "downloaded" {
                    break;
                }
                let _ = progress.send(event);
            }
            if !worker
                .child
                .wait()
                .await
                .map_err(|_| "setup-failed")?
                .success()
            {
                return Err("setup-failed".to_owned());
            }
        }
        let _ = progress.send(serde_json::json!({"stage": "loading"}));
        let mut current = state.worker.lock().await;
        if !worker_alive(&mut current) {
            *current = Some(
                tokio::time::timeout(LOAD_TIMEOUT, load(&directory))
                    .await
                    .map_err(|_| "load-timeout")??,
            );
        }
        tokio::fs::write(directory.join("ready"), PACKAGE)
            .await
            .map_err(|_| "storage-unavailable".to_owned())?;
        Ok(())
    };
    let result = tokio::select! {
        result = tokio::time::timeout(SETUP_TIMEOUT, operation) => result.map_err(|_| "setup-timeout".to_owned()).and_then(|r| r),
        _ = cancel.changed() => Err("cancelled".to_owned()),
    };
    state.busy.store(false, Ordering::Release);
    result
}

#[tauri::command]
pub async fn laya_predict(
    state: tauri::State<'_, LayaState>,
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let bytes = serde_json::to_vec(&request).map_err(|_| "invalid-request".to_owned())?;
    if bytes.len() > 16384 {
        return Err("invalid-request".to_owned());
    }
    let mut cancel = state.cancel.subscribe();
    let mut current = state.worker.lock().await;
    let worker = current.as_mut().ok_or("not-loaded")?;
    let operation = async {
        worker
            .input
            .write_all(&bytes)
            .await
            .map_err(|_| "runtime-failed")?;
        worker
            .input
            .write_all(b"\n")
            .await
            .map_err(|_| "runtime-failed")?;
        worker.input.flush().await.map_err(|_| "runtime-failed")?;
        let result = read(&mut worker.output).await?;
        if result.get("error").is_some() {
            return Err("prediction-failed".to_owned());
        }
        Ok(result)
    };
    let result = tokio::select! {
        result = tokio::time::timeout(PREDICT_TIMEOUT, operation) => result.map_err(|_| "prediction-timeout".to_owned()).and_then(|r| r),
        _ = cancel.changed() => Err("cancelled".to_owned()),
    };
    if result.is_err() {
        *current = None;
    }
    result
}

#[tauri::command]
pub async fn laya_unload(state: tauri::State<'_, LayaState>) -> Result<(), String> {
    state
        .cancel
        .send_modify(|value| *value = value.wrapping_add(1));
    *state.worker.lock().await = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn reads_one_complete_json_message_without_consuming_the_next() {
        let mut output = &b"{\"stage\":\"ready\"}\n{\"answers\":{}}\n"[..];
        assert_eq!(read(&mut output).await.unwrap()["stage"], "ready");
        assert!(read(&mut output).await.unwrap()["answers"].is_object());
    }

    #[tokio::test]
    async fn rejects_truncated_oversized_and_non_json_worker_output() {
        for bytes in [
            b"{\"stage\":\"ready\"}".to_vec(),
            b"library log\n".to_vec(),
            vec![b'x'; 65537],
        ] {
            let mut output = bytes.as_slice();
            assert!(read(&mut output).await.is_err());
        }
    }
}
