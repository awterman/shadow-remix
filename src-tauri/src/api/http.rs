use std::io::Write;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[tauri::command]
pub async fn get(url: &str) -> Result<String, String> {
    let body = reqwest::get(url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    Ok(body)
}

#[tauri::command]
pub async fn http_download(url: &str, save_path: &str) -> Result<(), String> {
    let mut response = reqwest::get(url)
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;

    let mut dest = std::fs::File::create(save_path).map_err(|e| e.to_string())?;

    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        dest.write_all(&chunk).map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("http")
        .invoke_handler(tauri::generate_handler![get, http_download])
        .build()
}

#[cfg(test)]
mod test {
    #[test]
    fn test_search() {}
}
