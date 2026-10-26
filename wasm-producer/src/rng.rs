/// SplitMix64: a small, fast, deterministic PRNG. Not cryptographic; it only
/// needs to be reproducible for a given seed and statistically reasonable.
pub struct Rng {
    state: u64,
}

impl Rng {
    pub fn new(seed: u64) -> Self {
        Self { state: seed }
    }

    pub fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// Uniform integer in `0..n` (Lemire's multiply-shift; bias is negligible
    /// for the small ranges used here). `n` must be nonzero.
    pub fn below(&mut self, n: u32) -> u32 {
        debug_assert!(n > 0);
        (((self.next_u64() >> 32) * u64::from(n)) >> 32) as u32
    }

    /// Uniform integer in `lo..=hi`.
    pub fn range(&mut self, lo: u32, hi: u32) -> u32 {
        debug_assert!(lo <= hi);
        lo + self.below(hi - lo + 1)
    }

    /// Uniform signed integer in `-max..=max`.
    pub fn signed(&mut self, max: u32) -> i64 {
        i64::from(self.below(2 * max + 1)) - i64::from(max)
    }

    pub fn coin(&mut self) -> bool {
        self.next_u64() >> 63 == 1
    }
}

#[cfg(test)]
mod tests {
    use super::Rng;

    #[test]
    fn same_seed_produces_same_sequence() {
        let mut a = Rng::new(42);
        let mut b = Rng::new(42);
        for _ in 0..100 {
            assert_eq!(a.next_u64(), b.next_u64());
        }
    }

    #[test]
    fn range_stays_within_bounds_and_hits_both_ends() {
        let mut rng = Rng::new(7);
        let (mut saw_lo, mut saw_hi) = (false, false);
        for _ in 0..10_000 {
            let v = rng.range(3, 6);
            assert!((3..=6).contains(&v));
            saw_lo |= v == 3;
            saw_hi |= v == 6;
        }
        assert!(saw_lo && saw_hi);
    }

    #[test]
    fn signed_stays_within_bounds() {
        let mut rng = Rng::new(9);
        for _ in 0..10_000 {
            assert!((-5..=5).contains(&rng.signed(5)));
        }
    }
}
