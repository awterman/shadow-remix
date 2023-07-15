use std::process::Command;

use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

use super::utils::parse;

// TODO: get path correctly and relatively.
static PCS: &'static str = r"C:\Users\z\code\shadow\src-tauri\bin\BaiduPCS-Go.exe";

// FIXME: baiduPCS-Go.exe always return 0, so we can't use status code to check if command is success.
fn pcs_cmd(cmd: &str, args: Vec<String>) -> Result<String, String> {
    Command::new(PCS)
        .arg(cmd)
        .args(args)
        .output()
        .map_err(|e| e.to_string())
        .and_then(|output| {
            if output.status.success() {
                Ok(String::from_utf8(output.stdout).unwrap())
            } else {
                Err(String::from_utf8(output.stderr).unwrap())
            }
        })
}

#[tauri::command]
pub async fn ls(path: String) -> Result<String, String> {
    pcs_cmd("ls", vec![path])
}

#[tauri::command]
pub async fn cd(path: String) -> Result<String, String> {
    pcs_cmd("cd", vec![path])
}

#[tauri::command]
pub async fn mkdir(path: String) -> Result<String, String> {
    pcs_cmd("mkdir", vec![path])
}

#[tauri::command]
pub async fn download(path: String, save_path: String) -> Result<String, String> {
    if path.is_empty() {
        return Err("path is empty".to_string());
    }

    if save_path.is_empty() {
        return Err("save_path is empty".to_string());
    }

    pcs_cmd(
        "download",
        vec![
            path,
            "--saveto".to_string(),
            save_path,
            "--no-check".to_string(),
        ],
    )
}

#[tauri::command]
pub async fn rm(path: String) -> Result<String, String> {
    pcs_cmd("rm", vec![path])
}

#[tauri::command]
pub async fn pwd() -> Result<String, String> {
    pcs_cmd("pwd", vec![]).and_then(|s| Ok(s.trim().to_string()))
}

#[tauri::command]
pub async fn transfer(url: String, code: String, dst: String) -> Result<String, String> {
    let current = pwd().await?;
    cd(dst).await?;
    let output = pcs_cmd("transfer", vec![url, code])?;
    cd(current).await?;

    parse::match_prefix_suffix(&output, "分享链接转存到网盘成功, 保存了", "到当前目录")
        .ok_or_else(|| format!("transfer failed: {}", output).to_string())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("baidu_pcs")
        .invoke_handler(tauri::generate_handler![
            ls, cd, download, rm, pwd, transfer, mkdir
        ])
        .build()
}

#[cfg(test)]
mod test {
    use tauri::async_runtime::block_on;

    #[test]
    fn test_pcs() {
        // let output = super::ls("".to_string()).unwrap();
        // println!("{}", output);

        let output = block_on(super::pwd()).unwrap();
        println!("{}", output);
    }
}
