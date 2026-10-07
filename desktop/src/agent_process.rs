//! Configured ACP launches keep the executable native-owned. The webview may provide
//! bounded string settings, never a program, shell fragment, or arbitrary CLI flags.
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use tauri::{ipc::Channel, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

#[derive(Default, Clone)]
pub struct AgentProcesses(Arc<Mutex<BTreeMap<u32, CommandChild>>>);

impl AgentProcesses {
    pub fn stop_all(&self) {
        if let Ok(mut map) = self.0.lock() {
            for (_, child) in std::mem::take(&mut *map) {
                let _ = child.kill();
            }
        }
    }
}

#[derive(serde::Serialize, Clone)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum AgentEvent {
    Stdout(Vec<u8>),
    Stderr(Vec<u8>),
    Close,
}

fn base_args(command: &str) -> Result<&'static [&'static str], String> {
    match command {
        "codex-acp" | "claude-agent-acp" => Ok(&[]),
        "gemini" => Ok(&["--acp"]),
        "kiro-cli" => Ok(&["acp", "--agent-engine=v3", "--auth-method=cli"]),
        _ => Err("Unknown ACP executable.".into()),
    }
}

fn literal(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 2048
        && !value
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || "\"'`$&|<>^%!\\()".contains(c))
}

fn config_key(key: &str) -> bool {
    key.len() <= 200
        && key.split('.').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
                && !matches!(
                    part.to_ascii_lowercase().as_str(),
                    "command" | "args" | "env" | "shell" | "hooks" | "notify" | "mcp_servers"
                )
        })
}

fn environment_name(name: &str) -> bool {
    let upper = name.to_ascii_uppercase();
    name.len() <= 80
        && name.bytes().next().is_some_and(|b| b.is_ascii_uppercase())
        && name
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_')
        && !matches!(
            upper.as_str(),
            "PATH"
                | "HOME"
                | "USERPROFILE"
                | "CODEX_HOME"
                | "NODE_OPTIONS"
                | "BUN_OPTIONS"
                | "SHELL"
                | "ENV"
                | "BASH_ENV"
                | "ZDOTDIR"
                | "PYTHONPATH"
                | "PYTHONHOME"
                | "COMSPEC"
                | "PATHEXT"
        )
        && !upper.starts_with("LD_")
        && !upper.starts_with("DYLD_")
}

fn validate(command: &str, args: &[String], env: &BTreeMap<String, String>) -> Result<(), String> {
    let base = base_args(command)?;
    if args.len() < base.len() || !args.iter().zip(base).all(|(a, b)| a == b) {
        return Err("Invalid ACP startup arguments.".into());
    }
    let overrides = &args[base.len()..];
    if overrides.len() > 48 || overrides.len() % 2 != 0 || env.len() > 96 {
        return Err("Too many ACP settings.".into());
    }
    for pair in overrides.chunks_exact(2) {
        if !matches!(pair[0].as_str(), "-c" | "--config") {
            return Err("Only configuration settings may follow ACP startup arguments.".into());
        }
        let (key, encoded) = pair[1].split_once('=').ok_or("Invalid ACP setting.")?;
        let value: String =
            serde_json::from_str(encoded).map_err(|_| "Expected a string setting.")?;
        if !config_key(key) || !literal(&value) {
            return Err("Invalid ACP configuration setting.".into());
        }
    }
    if env
        .iter()
        .any(|(key, value)| !environment_name(key) || !literal(value))
    {
        return Err("Invalid ACP environment setting.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_process_spawn(
    app: tauri::AppHandle,
    window: tauri::Window,
    processes: State<'_, AgentProcesses>,
    command: String,
    args: Vec<String>,
    env: BTreeMap<String, String>,
    events: Channel<AgentEvent>,
) -> Result<u32, String> {
    if window.label() != "main" {
        return Err("Agent launches belong to the main window.".into());
    }
    validate(&command, &args, &env)?;
    let path = crate::augment_path(
        &std::env::var("PATH").unwrap_or_default(),
        &crate::mcp_candidate_dirs(),
    );
    // The name was checked above; cmd.exe receives only the fixed adapter and validated literals.
    #[cfg(windows)]
    let process = app.shell().command("cmd").args(["/c", &command]).args(args);
    #[cfg(not(windows))]
    let process = app.shell().command(&command).args(args);
    let (mut receiver, child) = process
        .envs(env)
        .env("PATH", path)
        .set_raw_out(true)
        .spawn()
        .map_err(|_| "Could not start the configured agent.")?;
    let pid = child.pid();
    let children = processes.0.clone();
    match children.lock() {
        Ok(mut map) => {
            map.insert(pid, child);
        }
        Err(_) => {
            let _ = child.kill();
            return Err("Agent process state unavailable.".into());
        }
    }
    tauri::async_runtime::spawn(async move {
        while let Some(event) = receiver.recv().await {
            let event = match event {
                CommandEvent::Stdout(data) => AgentEvent::Stdout(data),
                CommandEvent::Stderr(data) => AgentEvent::Stderr(data),
                CommandEvent::Terminated(_) | CommandEvent::Error(_) => AgentEvent::Close,
                _ => continue,
            };
            let closed = matches!(event, AgentEvent::Close);
            if events.send(event).is_err() || closed {
                break;
            }
        }
        if let Ok(mut map) = children.lock() {
            if let Some(child) = map.remove(&pid) {
                let _ = child.kill();
            }
        }
    });
    Ok(pid)
}

#[tauri::command]
pub async fn agent_process_write(
    processes: State<'_, AgentProcesses>,
    pid: u32,
    data: Vec<u8>,
) -> Result<(), String> {
    if data.len() > 16 * 1024 * 1024 {
        return Err("Agent message too large.".into());
    }
    let children = processes.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        children
            .lock()
            .map_err(|_| "Agent process state unavailable.")?
            .get_mut(&pid)
            .ok_or("Agent process closed.")?
            .write(&data)
            .map_err(|_| "Could not write to the agent.")
    })
    .await
    .map_err(|_| "Could not write to the agent.".to_owned())?
    .map_err(str::to_owned)
}

#[tauri::command]
pub fn agent_process_kill(processes: State<'_, AgentProcesses>, pid: u32) -> Result<(), String> {
    if let Some(child) = processes
        .0
        .lock()
        .map_err(|_| "Agent process state unavailable.")?
        .remove(&pid)
    {
        child.kill().map_err(|_| "Could not stop the agent.")?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|s| (*s).to_owned()).collect()
    }
    #[test]
    fn permits_bounded_string_configuration_for_known_adapters() {
        assert!(validate(
            "codex-acp",
            &strings(&[
                "-c",
                "model_provider=\"team\"",
                "-c",
                "model_providers.team.base_url=\"https://example.com/v1\""
            ]),
            &BTreeMap::new()
        )
        .is_ok());
        assert!(validate(
            "kiro-cli",
            &strings(base_args("kiro-cli").unwrap()),
            &BTreeMap::from([("AWS_REGION".into(), "us-east-1".into())])
        )
        .is_ok());
    }
    #[test]
    fn rejects_programs_flags_shell_syntax_and_execution_settings() {
        for (program, args) in [
            ("sh", vec!["-c", "echo yes"]),
            (
                "codex-acp",
                vec!["--dangerously-bypass-approvals-and-sandbox"],
            ),
            ("codex-acp", vec!["-c", "model_provider=\"team&whoami\""]),
            ("codex-acp", vec!["-c", "model_provider=[\"team\"]"]),
            ("codex-acp", vec!["-c", "mcp_servers.local.command=\"sh\""]),
            ("kiro-cli", vec!["chat"]),
        ] {
            assert!(validate(program, &strings(&args), &BTreeMap::new()).is_err());
        }
        for name in ["PATH", "NODE_OPTIONS", "COMSPEC", "DYLD_INSERT_LIBRARIES"] {
            assert!(validate(
                "codex-acp",
                &[],
                &BTreeMap::from([(name.into(), "value".into())])
            )
            .is_err());
        }
    }
}
