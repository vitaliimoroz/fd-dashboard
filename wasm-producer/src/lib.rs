//! Raw C ABI over [`generator::Generator`]. See `ABI.md` for the contract.

mod generator;
mod rng;

use std::cell::RefCell;

use generator::{Generator, Update, MAX_BATCH};

pub const ABI_VERSION: u32 = 2;

struct State {
    generator: Option<Generator>,
    output: Vec<Update>,
}

thread_local! {
    // The output buffer is allocated once at full capacity so that `generate`
    // normally never grows linear memory.
    static STATE: RefCell<State> = RefCell::new(State {
        generator: None,
        output: Vec::with_capacity(MAX_BATCH as usize),
    });
}

#[no_mangle]
pub extern "C" fn abi_version() -> u32 {
    ABI_VERSION
}

/// Starts a new run. Returns 1 on success, 0 when `instrument_count` is
/// outside `1..=50` (the previous run is discarded either way).
#[no_mangle]
pub extern "C" fn init(seed_lo: u32, seed_hi: u32, instrument_count: u32) -> u32 {
    let seed = u64::from(seed_hi) << 32 | u64::from(seed_lo);
    STATE.with_borrow_mut(|state| {
        state.output.clear();
        state.generator = Generator::new(seed, instrument_count);
        state.generator.is_some() as u32
    })
}

/// Generates `update_count` updates and returns the byte offset of the first
/// record, or 0 when not initialized or `update_count` is outside `1..=1000`.
#[no_mangle]
pub extern "C" fn generate(update_count: u32) -> u32 {
    STATE.with_borrow_mut(|state| {
        let State { generator, output } = state;
        let ok = generator
            .as_mut()
            .is_some_and(|generator| generator.generate_into(update_count, output));
        if ok {
            output.as_ptr() as usize as u32
        } else {
            output.clear();
            0
        }
    })
}

/// Byte length of the output written by the last successful `generate` call.
#[no_mangle]
pub extern "C" fn output_len() -> u32 {
    STATE.with_borrow(|state| (state.output.len() * std::mem::size_of::<Update>()) as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Each test runs on its own thread, so `STATE` is isolated per test.
    // Pointers are 32-bit only on wasm32; reading records through the returned
    // offset is covered by the Karma test that loads the compiled module.

    #[test]
    fn record_layout_is_seven_u32_values() {
        assert_eq!(std::mem::size_of::<Update>(), 28);
        assert_eq!(std::mem::align_of::<Update>(), 4);
    }

    #[test]
    fn generate_fails_before_init() {
        assert_eq!(generate(10), 0);
        assert_eq!(output_len(), 0);
    }

    #[test]
    fn init_validates_instrument_count() {
        assert_eq!(init(1, 0, 0), 0);
        assert_eq!(init(1, 0, 51), 0);
        assert_eq!(generate(10), 0);
        assert_eq!(init(1, 0, 50), 1);
    }

    #[test]
    fn generate_reports_the_requested_number_of_records() {
        assert_eq!(init(42, 0, 5), 1);
        for count in [1, 100, MAX_BATCH] {
            assert_ne!(generate(count), 0);
            assert_eq!(output_len(), count * 28);
        }
        assert_eq!(generate(0), 0);
        assert_eq!(output_len(), 0);
        assert_eq!(generate(MAX_BATCH + 1), 0);
    }

    #[test]
    fn init_resets_the_run() {
        init(7, 0, 3);
        generate(100);
        assert_eq!(init(7, 0, 0), 0);
        assert_eq!(generate(1), 0);
    }
}
