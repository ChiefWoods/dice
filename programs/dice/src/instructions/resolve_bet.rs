use anchor_lang::{
    prelude::*,
    solana_program::{
        ed25519_program, hash::hash, sysvar::instructions::load_instruction_at_checked,
    },
    system_program::{transfer, Transfer},
};

use crate::{
    ed25519::Ed25519InstructionSignatures, error::DiceError, Bet, BET_SEED, HOUSE_EDGE, VAULT_SEED,
};

#[derive(Accounts)]
pub struct ResolveBet<'info> {
    pub house: Signer<'info>,
    #[account(mut)]
    pub player: SystemAccount<'info>,
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
    /// CHECK: Instructions sysvar
    pub instructions_sysvar: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl ResolveBet<'_> {
    pub fn verify_ed25519_signature(ctx: &Context<ResolveBet>, sig: &[u8]) -> Result<()> {
        let ix =
            load_instruction_at_checked(0, &ctx.accounts.instructions_sysvar.to_account_info())?;

        require_keys_eq!(
            ix.program_id,
            ed25519_program::ID,
            DiceError::InvalidEd25519ProgramID
        );

        require_eq!(ix.accounts.len(), 0, DiceError::InvalidEd25519Accounts);

        let signatures = Ed25519InstructionSignatures::unpack(&ix.data).unwrap().0;

        require_eq!(signatures.len(), 1, DiceError::InvalidEd25519SignatureLen);

        let signature = &signatures[0];

        require!(signature.is_verifiable, DiceError::InvalidEd25519Header);

        require_keys_eq!(
            signature
                .public_key
                .ok_or(DiceError::InvalidEd25519Pubkey)?,
            ctx.accounts.house.key(),
            DiceError::InvalidEd25519Pubkey
        );

        require!(
            signature
                .signature
                .ok_or(DiceError::InvalidEd25519Signature)?
                .eq(sig),
            DiceError::InvalidEd25519Signature
        );

        require!(
            signature
                .message
                .as_ref()
                .ok_or(DiceError::InvalidEd25519Message)?
                .eq(&ctx.accounts.bet.to_slice()),
            DiceError::InvalidEd25519Message
        );

        Ok(())
    }

    pub fn handler(ctx: Context<ResolveBet>, sig: &[u8]) -> Result<()> {
        let hash = hash(sig).to_bytes();
        let mut hash_16: [u8; 16] = [0; 16];
        hash_16.copy_from_slice(&hash[0..16]);
        let lower = u128::from_le_bytes(hash_16);
        hash_16.copy_from_slice(&hash[16..32]);
        let upper = u128::from_le_bytes(hash_16);

        let roll = lower.wrapping_add(upper).wrapping_rem(100) as u8 + 1;

        if ctx.accounts.bet.roll > roll {
            let payout = (ctx.accounts.bet.amount as u128)
                .checked_mul(10000 - HOUSE_EDGE as u128)
                .unwrap()
                .checked_div(ctx.accounts.bet.roll as u128 - 1)
                .unwrap()
                .checked_div(100)
                .unwrap() as u64;

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
                std::cmp::min(payout, ctx.accounts.vault.lamports()),
            )?;
        }

        Ok(())
    }
}
