use crate::rng::Rng;

pub const MAX_INSTRUMENTS: u32 = 50;
pub const MAX_BATCH: u32 = 1_000;

/// Mid prices are clamped to this range ($1.00 – $100,000.00) so that the bid
/// stays positive and all values fit comfortably in `u32`.
pub const MIN_MID_CENTS: u32 = 100;
pub const MAX_MID_CENTS: u32 = 10_000_000;
pub const MAX_BOOK_QUANTITY: u32 = 2_000;
pub const MAX_TRADE_QUANTITY: u32 = 200;

/// One market update: a trade plus the book snapshot it traded against.
/// `#[repr(C)]` with seven `u32` fields gives the 28-byte record documented in
/// `ABI.md`.
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Update {
    pub instrument: u32,
    pub price_cents: u32,
    pub trade_quantity: u32,
    pub bid_cents: u32,
    pub ask_cents: u32,
    pub bid_quantity: u32,
    pub ask_quantity: u32,
}

struct Instrument {
    mid_cents: u32,
    bid_quantity: u32,
    ask_quantity: u32,
}

pub struct Generator {
    rng: Rng,
    instruments: Vec<Instrument>,
}

impl Generator {
    /// Returns `None` when `instrument_count` is outside `1..=MAX_INSTRUMENTS`.
    pub fn new(seed: u64, instrument_count: u32) -> Option<Self> {
        if !(1..=MAX_INSTRUMENTS).contains(&instrument_count) {
            return None;
        }
        let mut rng = Rng::new(seed);
        let instruments = (0..instrument_count)
            .map(|_| Instrument {
                mid_cents: rng.range(2_000, 50_000),
                bid_quantity: rng.range(100, 1_000),
                ask_quantity: rng.range(100, 1_000),
            })
            .collect();
        Some(Self { rng, instruments })
    }

    #[cfg(test)]
    pub fn instrument_count(&self) -> u32 {
        self.instruments.len() as u32
    }

    /// Clears `out` and fills it with exactly `count` updates. Returns `false`
    /// (leaving `out` empty) when `count` is outside `1..=MAX_BATCH`.
    pub fn generate_into(&mut self, count: u32, out: &mut Vec<Update>) -> bool {
        out.clear();
        if !(1..=MAX_BATCH).contains(&count) {
            return false;
        }
        out.reserve(count as usize);
        for _ in 0..count {
            let update = self.next_update();
            out.push(update);
        }
        true
    }

    fn next_update(&mut self) -> Update {
        let rng = &mut self.rng;
        let index = rng.below(self.instruments.len() as u32);
        let inst = &mut self.instruments[index as usize];

        // Random walk on the mid price: at most ~0.1% (min 1 cent) per update.
        let max_step = (inst.mid_cents / 1_000).max(1);
        let mid = i64::from(inst.mid_cents) + rng.signed(max_step);
        inst.mid_cents = mid.clamp(i64::from(MIN_MID_CENTS), i64::from(MAX_MID_CENTS)) as u32;

        // Spread of 1 cent up to ~0.05% of the mid, centred on the mid.
        // With mid >= MIN_MID_CENTS the bid is always >= 1 cent.
        let spread = rng.range(1, (inst.mid_cents / 2_000).max(1));
        let bid_cents = inst.mid_cents - spread / 2;
        let ask_cents = bid_cents + spread;

        // Book quantities drift and may reach zero, but never go negative.
        inst.bid_quantity = drift(rng, inst.bid_quantity, 100, MAX_BOOK_QUANTITY);
        inst.ask_quantity = drift(rng, inst.ask_quantity, 100, MAX_BOOK_QUANTITY);

        // A buyer lifts the ask or a seller hits the bid.
        let price_cents = if rng.coin() { ask_cents } else { bid_cents };

        Update {
            instrument: index,
            price_cents,
            trade_quantity: rng.range(1, MAX_TRADE_QUANTITY),
            bid_cents,
            ask_cents,
            bid_quantity: inst.bid_quantity,
            ask_quantity: inst.ask_quantity,
        }
    }
}

fn drift(rng: &mut Rng, value: u32, max_step: u32, max: u32) -> u32 {
    (i64::from(value) + rng.signed(max_step)).clamp(0, i64::from(max)) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn batch(generator: &mut Generator, count: u32) -> Vec<Update> {
        let mut out = Vec::new();
        assert!(generator.generate_into(count, &mut out));
        out
    }

    fn assert_valid(update: &Update, instrument_count: u32) {
        assert!(update.instrument < instrument_count, "{update:?}");
        assert!(update.bid_cents >= 1, "bid must be positive: {update:?}");
        assert!(update.bid_cents < update.ask_cents, "bid must be below ask: {update:?}");
        assert!(
            update.price_cents == update.bid_cents || update.price_cents == update.ask_cents,
            "trade price must be the bid or the ask: {update:?}"
        );
        assert!(update.trade_quantity >= 1, "trade quantity must be positive: {update:?}");
        assert!(update.bid_quantity <= MAX_BOOK_QUANTITY);
        assert!(update.ask_quantity <= MAX_BOOK_QUANTITY);
    }

    #[test]
    fn rejects_instrument_counts_outside_the_allowed_range() {
        assert!(Generator::new(1, 0).is_none());
        assert!(Generator::new(1, MAX_INSTRUMENTS + 1).is_none());
        assert_eq!(Generator::new(1, 1).unwrap().instrument_count(), 1);
        assert_eq!(Generator::new(1, MAX_INSTRUMENTS).unwrap().instrument_count(), MAX_INSTRUMENTS);
    }

    #[test]
    fn returns_exactly_the_requested_batch_size() {
        let mut generator = Generator::new(1, 5).unwrap();
        for count in [1, 2, 100, MAX_BATCH] {
            assert_eq!(batch(&mut generator, count).len(), count as usize);
        }
    }

    #[test]
    fn rejects_batch_sizes_outside_the_allowed_range() {
        let mut generator = Generator::new(1, 5).unwrap();
        let mut out = vec![];
        assert!(!generator.generate_into(0, &mut out));
        assert!(!generator.generate_into(MAX_BATCH + 1, &mut out));
        assert!(out.is_empty());
    }

    #[test]
    fn same_seed_produces_identical_batches() {
        let mut a = Generator::new(123, 10).unwrap();
        let mut b = Generator::new(123, 10).unwrap();
        for _ in 0..5 {
            assert_eq!(batch(&mut a, 100), batch(&mut b, 100));
        }
    }

    #[test]
    fn different_seeds_produce_different_batches() {
        let mut a = Generator::new(1, 10).unwrap();
        let mut b = Generator::new(2, 10).unwrap();
        assert_ne!(batch(&mut a, 100), batch(&mut b, 100));
    }

    #[test]
    fn all_generated_values_satisfy_the_invariants() {
        for (seed, count) in [(1, 1), (2, 5), (3, MAX_INSTRUMENTS)] {
            let mut generator = Generator::new(seed, count).unwrap();
            for _ in 0..200 {
                for update in batch(&mut generator, MAX_BATCH) {
                    assert_valid(&update, count);
                }
            }
        }
    }

    #[test]
    fn invariants_hold_at_the_minimum_price() {
        let mut generator = Generator::new(4, 1).unwrap();
        generator.instruments[0].mid_cents = MIN_MID_CENTS;
        for _ in 0..50 {
            for update in batch(&mut generator, MAX_BATCH) {
                assert_valid(&update, 1);
            }
        }
    }

    #[test]
    fn book_quantities_can_reach_zero_and_stay_nonnegative() {
        let mut generator = Generator::new(5, 1).unwrap();
        generator.instruments[0].bid_quantity = 0;
        generator.instruments[0].ask_quantity = 0;
        let updates = batch(&mut generator, MAX_BATCH);
        // u32 cannot be negative; check the clamp at zero is actually exercised.
        assert!(updates.iter().any(|u| u.bid_quantity == 0 || u.ask_quantity == 0));
    }

    #[test]
    fn prices_evolve_from_previous_values() {
        let mut generator = Generator::new(6, 3).unwrap();
        let mut last_bid = [None::<u32>; 3];
        for _ in 0..20 {
            for update in batch(&mut generator, MAX_BATCH) {
                if let Some(previous) = last_bid[update.instrument as usize] {
                    // One walk step (<= 0.1%) plus spread changes (<= 0.05%) plus rounding.
                    let limit = previous / 500 + 2;
                    assert!(
                        previous.abs_diff(update.bid_cents) <= limit,
                        "bid jumped from {previous} to {}",
                        update.bid_cents
                    );
                }
                last_bid[update.instrument as usize] = Some(update.bid_cents);
            }
        }
    }

    #[test]
    fn every_instrument_receives_updates() {
        let mut generator = Generator::new(8, MAX_INSTRUMENTS).unwrap();
        let updates = batch(&mut generator, MAX_BATCH);
        for i in 0..MAX_INSTRUMENTS {
            assert!(updates.iter().any(|u| u.instrument == i), "instrument {i} never traded");
        }
    }
}
