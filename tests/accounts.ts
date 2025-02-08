import { PublicKey } from "@solana/web3.js";
import { Dice } from "../target/types/dice";
import { Program } from "@coral-xyz/anchor";

export async function getBetAcc(program: Program<Dice>, betPda: PublicKey) {
  return await program.account.bet.fetchNullable(betPda);
}
