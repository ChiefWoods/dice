import { beforeEach, describe, expect, test } from "bun:test";
import { Dice } from "../../target/types/dice";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getVaultPda } from "../pda";
import { LiteSVM } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import { fundedSystemAccountInfo, getSetup } from "../setup";

describe("initialize", () => {
  let { litesvm, provider, program } = {} as {
    litesvm: LiteSVM;
    provider: LiteSVMProvider;
    program: Program<Dice>;
  };

  const houseKeypair = Keypair.generate();
  const initialHouseBal = LAMPORTS_PER_SOL * 10;

  beforeEach(async () => {
    ({ litesvm, provider, program } = await getSetup([
      {
        pubkey: houseKeypair.publicKey,
        account: fundedSystemAccountInfo(initialHouseBal),
      },
    ]));
  });

  test("initializes the vault", async () => {
    const amount = new BN(LAMPORTS_PER_SOL * 5);

    await program.methods
      .initialize(amount)
      .accounts({
        house: houseKeypair.publicKey,
      })
      .signers([houseKeypair])
      .rpc();

    const [vaultPda] = getVaultPda(houseKeypair.publicKey);
    const vaultBal = litesvm.getBalance(vaultPda);

    expect(Number(vaultBal)).toBe(amount.toNumber());

    const postHouseBal = litesvm.getBalance(houseKeypair.publicKey);

    expect(Number(postHouseBal)).toBe(initialHouseBal - amount.toNumber());
  });
});
