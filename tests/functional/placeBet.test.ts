import { beforeEach, describe, expect, test } from "bun:test";
import { Dice } from "../../target/types/dice";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { randomBytes } from "crypto";
import { getBetPda, getVaultPda } from "../pda";
import { fetchBetAcc } from "../accounts";
import { LiteSVM } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import { fundedSystemAccountInfo, getSetup } from "../setup";

describe("placeBet", () => {
  let { litesvm, provider, program } = {} as {
    litesvm: LiteSVM;
    provider: LiteSVMProvider;
    program: Program<Dice>;
  };

  const [houseKeypair, playerKeypair] = Array.from({ length: 2 }, () =>
    Keypair.generate(),
  );

  const [vaultPda] = getVaultPda(houseKeypair.publicKey);
  let initialVaultBal: bigint;
  let initialPlayerBal: bigint;

  beforeEach(async () => {
    ({ litesvm, provider, program } = await getSetup(
      [houseKeypair, playerKeypair].map((kp) => {
        return {
          pubkey: kp.publicKey,
          account: fundedSystemAccountInfo(10 * LAMPORTS_PER_SOL),
        };
      }),
    ));

    await program.methods
      .initialize(new BN(LAMPORTS_PER_SOL * 5))
      .accounts({
        house: houseKeypair.publicKey,
      })
      .signers([houseKeypair])
      .rpc();

    initialVaultBal = litesvm.getBalance(vaultPda);
    initialPlayerBal = litesvm.getBalance(playerKeypair.publicKey);
  });

  test("place a bet", async () => {
    const seed = new BN(randomBytes(16));
    const roll = 50;
    const amount = new BN(LAMPORTS_PER_SOL);
    const slot = litesvm.getClock().slot;

    await program.methods
      .placeBet(seed, roll, amount)
      .accounts({
        house: houseKeypair.publicKey,
        player: playerKeypair.publicKey,
      })
      .signers([playerKeypair])
      .rpc();

    const [vaultPda] = getVaultPda(houseKeypair.publicKey);
    const [betPda, betBump] = getBetPda(vaultPda, seed);
    const betAcc = await fetchBetAcc(program, betPda);

    expect(betAcc.bump).toEqual(betBump);
    expect(betAcc.roll).toEqual(roll);
    expect(betAcc.slot.toNumber()).toBeGreaterThanOrEqual(Number(slot));
    expect(betAcc.amount.toNumber()).toEqual(amount.toNumber());
    expect(betAcc.seed).toStrictEqual(seed);
    expect(betAcc.player).toStrictEqual(playerKeypair.publicKey);

    const postVaultBal = litesvm.getBalance(vaultPda);

    expect(Number(postVaultBal)).toBe(
      Number(initialVaultBal) + amount.toNumber(),
    );

    const postPlayerBal = litesvm.getBalance(playerKeypair.publicKey);
    const betAccBal = litesvm.getBalance(betPda);

    expect(Number(postPlayerBal)).toBe(
      Number(initialPlayerBal) - amount.toNumber() - Number(betAccBal),
    );
  });
});
