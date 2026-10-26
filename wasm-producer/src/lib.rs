#[no_mangle]
pub extern "C" fn abi_version() -> u32 {
    1
}

#[no_mangle]
pub extern "C" fn probe(input: u32) -> u32 {
    input.rotate_left(7) ^ 0x5741_534D
}

#[cfg(test)]
mod tests {
    use super::probe;

    #[test]
    fn probe_returns_the_expected_wasm_signature() {
        assert_eq!(probe(1), 0x5741_53CD);
    }
}
