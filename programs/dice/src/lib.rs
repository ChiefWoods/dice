pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("3GJV9YpK9BNahmJbuGHVfY2UyiDXDsCFvbvAP34G7LJE");

#[program]
pub mod dice {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amount: u64) -> Result<()> {
        Initialize::initialize(ctx, amount)
    }

    pub fn place_bet(ctx: Context<PlaceBet>, seed: u128, roll: u8, amount: u64) -> Result<()> {
        PlaceBet::place_bet(ctx, seed, roll, amount)
    }

    pub fn resolve_bet(ctx: Context<ResolveBet>, sig: Vec<u8>) -> Result<()> {
        ResolveBet::verify_ed25519_signature(&ctx, &sig)?;
        ResolveBet::resolve_bet(ctx, &sig)
    }

    pub fn refund_bet(ctx: Context<RefundBet>) -> Result<()> {
        RefundBet::refund_bet(ctx)
    }
}
