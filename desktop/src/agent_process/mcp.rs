//! Scope Codex's inherited MCP configuration to the connections supplied by this chat.
//! The CLI resolves its own config layers; no config or credential files are rewritten.
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use serde::Deserialize;
use serde_json::Value;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

const CATALOG_TIMEOUT: Duration = Duration::from_secs(15);
const MAX_CATALOG_BYTES: u64 = 4 * 1024 * 1024;
const MAX_SERVERS: usize = 512;
const DISCOVERY_ERROR: &str =
    "Could not inspect Codex MCP connections. Update Codex and retry; no agent was started.";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpScope {
    pub cwd: String,
    pub server_names: Vec<String>,
}

#[derive(Deserialize)]
struct ConfiguredServer {
    name: String,
}

fn server_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 200
        && name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"_-".contains(&byte))
}

impl McpScope {
    fn validate(&self) -> Result<(), String> {
        if !Path::new(&self.cwd).is_absolute()
            || self.cwd.len() > 8192
            || self.cwd.contains('\0')
            || self.server_names.len() > MAX_SERVERS
            || self.server_names.iter().any(|name| !server_name(name))
            || self.server_names.iter().collect::<BTreeSet<_>>().len() != self.server_names.len()
        {
            return Err("Invalid agent MCP connection scope.".into());
        }
        Ok(())
    }
}

fn scoped_config(
    config: &BTreeMap<String, String>,
    catalog: &[u8],
    selected: &[String],
) -> Result<String, String> {
    // Deserialize names only. Server environments and authentication metadata never
    // cross IPC, enter logs, or get copied to the launch overrides.
    let servers: Vec<ConfiguredServer> =
        serde_json::from_slice(catalog).map_err(|_| DISCOVERY_ERROR)?;
    if servers.len() > MAX_SERVERS || servers.iter().any(|server| !server_name(&server.name)) {
        return Err(DISCOVERY_ERROR.into());
    }
    if servers.iter().any(|server| selected.contains(&server.name)) {
        return Err(
            "An agent session connection name is already configured. Retry the chat.".into(),
        );
    }
    let mut scoped: BTreeMap<String, Value> = config
        .iter()
        .map(|(key, value)| (key.clone(), Value::String(value.clone())))
        .collect();
    for server in servers {
        scoped.insert(
            format!("mcp_servers.{}.enabled", server.name),
            Value::Bool(false),
        );
    }
    serde_json::to_string(&scoped).map_err(|_| DISCOVERY_ERROR.into())
}

pub async fn isolate_codex(
    env: &mut BTreeMap<String, String>,
    scope: &McpScope,
) -> Result<(), String> {
    scope.validate()?;
    // agent_process::validate has already restricted these to bounded literal strings.
    let config: BTreeMap<String, String> =
        serde_json::from_str(env.get("CODEX_CONFIG").map(String::as_str).unwrap_or("{}"))
            .map_err(|_| DISCOVERY_ERROR)?;
    let path = crate::augment_path(
        &std::env::var("PATH").unwrap_or_default(),
        &crate::mcp_candidate_dirs(),
    );
    let executable = env
        .get("CODEX_PATH")
        .cloned()
        .or_else(|| std::env::var("CODEX_PATH").ok())
        .map(std::path::PathBuf::from)
        .or_else(|| which::which_in("codex", Some(&path), &scope.cwd).ok())
        .ok_or(DISCOVERY_ERROR)?;
    let mut command = catalog_command(&executable);
    command.args(["mcp", "list", "--json"]);
    for (key, value) in &config {
        let encoded = serde_json::to_string(value).map_err(|_| DISCOVERY_ERROR)?;
        command.args(["-c", &format!("{key}={encoded}")]);
    }
    // codex-acp trusts the session root in its process-local config. Discover the
    // same project layers now, otherwise a previously untrusted project's servers
    // could appear only after the adapter creates the session.
    let root = serde_json::to_string(&scope.cwd).map_err(|_| DISCOVERY_ERROR)?;
    command.args([
        "-c",
        &format!("projects={{{root}={{trust_level=\"trusted\"}}}}"),
    ]);
    command
        .current_dir(&scope.cwd)
        .envs(env.iter())
        .env("PATH", path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    let mut child = command.spawn().map_err(|_| DISCOVERY_ERROR)?;
    let stdout = child.stdout.take().ok_or(DISCOVERY_ERROR)?;
    let catalog = tokio::time::timeout(CATALOG_TIMEOUT, async {
        let mut bytes = Vec::new();
        stdout
            .take(MAX_CATALOG_BYTES + 1)
            .read_to_end(&mut bytes)
            .await
            .map_err(|_| DISCOVERY_ERROR)?;
        if bytes.len() as u64 > MAX_CATALOG_BYTES {
            return Err(DISCOVERY_ERROR);
        }
        if !child.wait().await.map_err(|_| DISCOVERY_ERROR)?.success() {
            return Err(DISCOVERY_ERROR);
        }
        Ok(bytes)
    })
    .await
    .map_err(|_| DISCOVERY_ERROR)??;
    env.insert(
        "CODEX_CONFIG".into(),
        scoped_config(&config, &catalog, &scope.server_names)?,
    );
    Ok(())
}

fn catalog_command(executable: &Path) -> Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut command = if executable
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("cmd"))
        {
            let mut command = Command::new("cmd");
            command.arg("/c").arg(executable);
            command
        } else {
            Command::new(executable)
        };
        command.as_std_mut().creation_flags(0x08000000);
        command
    }
    #[cfg(not(windows))]
    Command::new(executable)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_arbitrary_inherited_names_and_preserves_selected_servers_and_model_settings() {
        let config = BTreeMap::from([
            ("model_provider".into(), "team-provider".into()),
            (
                "model_providers.team-provider.aws.region".into(),
                "example-region".into(),
            ),
        ]);
        let catalog = br#"[
            {"name":"another-editor","enabled":true,"env":{"TOKEN":"do-not-copy"}},
            {"name":"team-assets","enabled":false},
            {"name":"open-pencil","enabled":false}
        ]"#;
        let selected = vec!["session-canvas".into(), "session-assets".into()];
        let result = scoped_config(&config, catalog, &selected).unwrap();
        let value: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(value["mcp_servers.another-editor.enabled"], false);
        assert_eq!(value["mcp_servers.team-assets.enabled"], false);
        assert_eq!(value["mcp_servers.open-pencil.enabled"], false);
        assert!(value.get("mcp_servers.session-canvas.enabled").is_none());
        assert_eq!(value["model_provider"], "team-provider");
        assert_eq!(
            value["model_providers.team-provider.aws.region"],
            "example-region"
        );
        assert!(!result.contains("TOKEN"));
        assert!(!result.contains("do-not-copy"));
    }

    #[test]
    fn an_empty_selection_disables_all_inherited_servers() {
        let result =
            scoped_config(&BTreeMap::new(), br#"[{"name":"arbitrary-server"}]"#, &[]).unwrap();
        let value: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(value["mcp_servers.arbitrary-server.enabled"], false);
        assert_eq!(scoped_config(&BTreeMap::new(), b"[]", &[]).unwrap(), "{}");
    }

    #[test]
    fn malformed_discovery_never_falls_back_to_inheriting_servers() {
        for catalog in [
            "not JSON",
            "{}",
            "[{}]",
            r#"[{"name":"editor.enabled"}]"#,
            r#"[{"name":""}]"#,
        ] {
            assert!(scoped_config(&BTreeMap::new(), catalog.as_bytes(), &[]).is_err());
        }
        assert!(scoped_config(
            &BTreeMap::new(),
            br#"[{"name":"session-canvas"}]"#,
            &["session-canvas".into()],
        )
        .is_err());
    }

    #[test]
    fn rejects_ambiguous_names_and_invalid_working_directories() {
        let cwd = std::env::temp_dir().to_string_lossy().into_owned();
        assert!(McpScope {
            cwd: cwd.clone(),
            server_names: vec![]
        }
        .validate()
        .is_ok());
        for names in [
            vec!["duplicate".into(), "duplicate".into()],
            vec!["nested.setting".into()],
            vec!["".into()],
        ] {
            assert!(McpScope {
                cwd: cwd.clone(),
                server_names: names
            }
            .validate()
            .is_err());
        }
        assert!(McpScope {
            cwd: "relative".into(),
            server_names: vec![]
        }
        .validate()
        .is_err());
    }
}
