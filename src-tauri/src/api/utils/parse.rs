// match a string with a prefix and a suffix, and return the string in between, if the prefix or the suffix is empty, ignore it
pub fn match_prefix_suffix(a: &str, prefix: &str, suffix: &str) -> Option<String> {
    let mut start = 0;
    let mut end = a.len();
    if !prefix.is_empty() {
        if let Some(i) = a.find(prefix) {
            start = i + prefix.len();
        } else {
            return None;
        }
    }
    if !suffix.is_empty() {
        if let Some(i) = a[start..].find(suffix) {
            end = start + i;
        } else {
            return None;
        }
    }
    Some(a[start..end].to_string())
}
