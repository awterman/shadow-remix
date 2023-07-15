pub fn event_name(module: &str, event: &str) -> String {
    format!("{}::{}", module, event)
}
