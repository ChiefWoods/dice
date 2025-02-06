use anchor_lang::prelude::*;

#[error_code]
pub enum DiceError {
    #[msg("Invalid Ed25519 program ID")]
    InvalidEd25519ProgramID,
    #[msg("Instruction should not include any accounts")]
    InvalidEd25519Accounts,
    #[msg("Instruction should contain only 1 signature")]
    InvalidEd25519SignatureLen,
    #[msg("Signature not verifiable")]
    InvalidEd25519Header,
    #[msg("Signature pubkey does not match house pubkey")]
    InvalidEd25519Pubkey,
    #[msg("Signature does not match")]
    InvalidEd25519Signature,
    #[msg("Instruction data does not match")]
    InvalidEd25519Message,
    #[msg("Bets can only be refunded after 9000 slots")]
    RefundCooldownNotElapsed = 1000,
}
