use crate::{constants::*, state::*};
use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
    Discriminator,
};

#[derive(Accounts)]
#[instruction(seed: u128)]
pub struct PlaceBet<'info> {
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
        init,
        payer = player,
        space = Bet::DISCRIMINATOR.len() + Bet::INIT_SPACE,
        seeds = [BET_SEED, vault.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump,
    )]
    pub bet: Account<'info, Bet>,
    pub system_program: Program<'info, System>,
}

impl<'info> PlaceBet<'info> {
    pub fn place_bet(
        &mut self,
        bumps: PlaceBetBumps,
        seed: u128,
        roll: u8,
        amount: u64,
    ) -> Result<()> {
        self.bet.set_inner(Bet {
            bump: bumps.bet,
            roll,
            slot: Clock::get()?.slot,
            amount,
            seed,
            player: self.player.key(),
        });

        transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.player.to_account_info(),
                    to: self.vault.to_account_info(),
                },
            ),
            amount,
        )
    }
}
