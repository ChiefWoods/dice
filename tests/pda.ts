import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import idl from "../target/idl/dice.json";

const DICE_PROGRAM_ID = new PublicKey(idl.address);

export function getBetPda(vaultPda: PublicKey, seed: BN) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("bet"),
      vaultPda.toBuffer(),
      seed.toArrayLike(Buffer, "le", 16),
    ],
    DICE_PROGRAM_ID,
  );
}

export function getVaultPda(housePubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), housePubkey.toBuffer()],
    DICE_PROGRAM_ID,
  );
}
