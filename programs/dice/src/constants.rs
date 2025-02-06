use anchor_lang::prelude::*;

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
pub const BET_SEED: &[u8] = b"bet";
pub const HOUSE_EDGE: u16 = 150;
pub const REFUND_COOLDOWN_SLOTS: u64 = 9000;
