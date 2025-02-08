import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import idl from "../target/idl/dice.json";

export function getBetPdaAndBump(vaultPda: PublicKey, seed: BN) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("bet"),
      vaultPda.toBuffer(),
      seed.toArrayLike(Buffer, "le", 16),
    ],
    new PublicKey(idl.address)
  );
}

export function getVaultPdaAndBump(housePubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), housePubkey.toBuffer()],
    new PublicKey(idl.address)
  );
}
