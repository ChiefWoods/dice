import { BankrunProvider } from "anchor-bankrun";
import { beforeEach, describe, expect, test } from "bun:test";
import { ProgramTestContext } from "solana-bankrun";
import { Dice } from "../../target/types/dice";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { getBankrunSetup } from "../setup";
import { randomBytes } from "crypto";
import { getBetPdaAndBump, getVaultPdaAndBump } from "../pda";
import { getBetAcc } from "../accounts";

describe("placeBet", () => {
  let { context, provider, program } = {} as {
    context: ProgramTestContext;
    provider: BankrunProvider;
    program: Program<Dice>;
  };

  const [houseKeypair, playerKeypair] = Array.from({ length: 2 }, () =>
    Keypair.generate()
  );

  const [vaultPda] = getVaultPdaAndBump(houseKeypair.publicKey);
  let initialVaultBal: bigint;
  let initialPlayerBal: bigint;

  beforeEach(async () => {
    ({ context, provider, program } = await getBankrunSetup(
      [houseKeypair, playerKeypair].map((kp) => {
        return {
          address: kp.publicKey,
          info: {
            lamports: LAMPORTS_PER_SOL * 10,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        };
      })
    ));

    await program.methods
      .initialize(new BN(LAMPORTS_PER_SOL * 5))
      .accounts({
        house: houseKeypair.publicKey,
      })
      .signers([houseKeypair])
      .rpc();

    initialVaultBal = await context.banksClient.getBalance(vaultPda);
    initialPlayerBal = await context.banksClient.getBalance(
      playerKeypair.publicKey
    );
  });

  test("place a bet", async () => {
    const seed = new BN(randomBytes(16));
    const roll = 50;
    const amount = new BN(LAMPORTS_PER_SOL);
    const slot = (await context.banksClient.getClock()).slot;

    await program.methods
      .placeBet(seed, roll, amount)
      .accounts({
        house: houseKeypair.publicKey,
        player: playerKeypair.publicKey,
      })
      .signers([playerKeypair])
      .rpc();

    const [vaultPda] = getVaultPdaAndBump(houseKeypair.publicKey);
    const [betPda, betBump] = getBetPdaAndBump(vaultPda, seed);
    const betAcc = await getBetAcc(program, betPda);

    expect(betAcc.bump).toEqual(betBump);
    expect(betAcc.roll).toEqual(roll);
    expect(betAcc.slot.toNumber()).toBeGreaterThanOrEqual(Number(slot));
    expect(betAcc.amount.toNumber()).toEqual(amount.toNumber());
    expect(betAcc.seed).toStrictEqual(seed);
    expect(betAcc.player).toStrictEqual(playerKeypair.publicKey);

    const postVaultBal = await context.banksClient.getBalance(vaultPda);

    expect(Number(postVaultBal)).toBe(
      Number(initialVaultBal) + amount.toNumber()
    );

    const postPlayerBal = await context.banksClient.getBalance(
      playerKeypair.publicKey
    );
    const betAccBal = await context.banksClient.getBalance(betPda);

    expect(Number(postPlayerBal)).toBe(
      Number(initialPlayerBal) - amount.toNumber() - Number(betAccBal)
    );
  });
});
