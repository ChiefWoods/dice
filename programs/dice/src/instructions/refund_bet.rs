use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{error::DiceError, Bet, BET_SEED, REFUND_COOLDOWN_SLOTS, VAULT_SEED};

#[derive(Accounts)]
pub struct RefundBet<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    pub house: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [VAULT_SEED, house.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,
    #[account(
        mut,
        close = player,
        seeds = [BET_SEED, vault.key().as_ref(), bet.seed.to_le_bytes().as_ref()],
        bump = bet.bump,
    )]
    pub bet: Account<'info, Bet>,
    pub system_program: Program<'info, System>,
}

impl RefundBet<'_> {
    pub fn handler(ctx: Context<RefundBet>) -> Result<()> {
        require_gt!(
            Clock::get()?.slot - ctx.accounts.bet.slot,
            REFUND_COOLDOWN_SLOTS,
            DiceError::RefundCooldownNotElapsed
        );

        let signer_seeds: &[&[&[u8]]] = &[&[
            VAULT_SEED,
            &ctx.accounts.house.key().to_bytes()[..],
            &[ctx.bumps.vault],
        ]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.player.to_account_info(),
                },
                signer_seeds,
            ),
            ctx.accounts.bet.amount,
        )
    }
}
