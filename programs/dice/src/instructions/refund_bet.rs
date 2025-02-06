use crate::{constants::*, error::DiceError, state::*};
use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

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

impl<'info> RefundBet<'info> {
    pub fn refund_bet(&mut self, bumps: RefundBetBumps) -> Result<()> {
        require_gt!(
            Clock::get()?.slot - self.bet.slot,
            REFUND_COOLDOWN_SLOTS,
            DiceError::RefundCooldownNotElapsed
        );

        let signer_seeds: &[&[&[u8]]] =
            &[&[VAULT_SEED, &self.house.key().to_bytes()[..], &[bumps.vault]]];

        transfer(
            CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.vault.to_account_info(),
                    to: self.player.to_account_info(),
                },
                signer_seeds,
            ),
            self.bet.amount,
        )
    }
}
