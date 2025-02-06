use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Bet {
    pub bump: u8,
    pub roll: u8,
    pub slot: u64,
    pub amount: u64,
    pub seed: u128,
    pub player: Pubkey,
}

impl Bet {
    pub fn to_slice(&self) -> Vec<u8> {
        let mut s = Vec::new();
        s.extend_from_slice(&[self.bump, self.roll]);
        s.extend_from_slice(&self.slot.to_le_bytes());
        s.extend_from_slice(&self.amount.to_le_bytes());
        s.extend_from_slice(&self.seed.to_le_bytes());
        s.extend_from_slice(&self.player.to_bytes());

        s
    }
}
