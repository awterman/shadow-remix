use std::fs::File;
use std::io::Read;

use aes::cipher::typenum::{U12, U32};
use aes_gcm::aead::generic_array::GenericArray;
use aes_gcm::{AeadInPlace, Aes256Gcm, KeyInit, Nonce, Tag};
use flate2::read::GzDecoder;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

fn decrypt_file_impl(
    path: String,
    base64_aes: String,
    zipped: bool,
) -> Result<String, Box<dyn std::error::Error>> {
    let mut file = File::open(path)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;

    let (iv, buffer) = buffer.split_at(12);
    let (tag, buffer) = buffer.split_at(16);

    let binary_key = hex::decode(base64_aes.clone())?;

    let key: GenericArray<_, U32> = GenericArray::clone_from_slice(&binary_key);

    let cipher = Aes256Gcm::new(&key);
    let nonce: Nonce<U12> = Nonce::clone_from_slice(iv);
    let mut in_out = buffer.to_vec();
    let associated_data = b"";
    let tag = Tag::clone_from_slice(tag);

    cipher
        .decrypt_in_place_detached(&nonce, associated_data, &mut in_out, &tag)
        .map_err(|e| e.to_string())?;

    if zipped {
        let mut decoder = GzDecoder::new(&in_out[..]);
        let mut decoded = Vec::new();
        decoder.read_to_end(&mut decoded)?;
        Ok(String::from_utf8(decoded)?)
    } else {
        Ok(String::from_utf8(in_out)?)
    }
}

const BASE64_AES: &str = "e7ce0b261cf11fd489a7e04e6db34aa04fca11b2d333116dbaef3e241a438534";

#[tauri::command]
pub fn decrypt_file(path: String, zipped: bool) -> Result<String, String> {
    decrypt_file_impl(path, BASE64_AES.to_string(), zipped).map_err(|e| e.to_string())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("secrets")
        .invoke_handler(tauri::generate_handler![decrypt_file,])
        .build()
}
