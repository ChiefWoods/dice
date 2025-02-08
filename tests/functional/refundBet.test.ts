import { AnchorError, BN, Program } from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";
import { beforeEach, describe, expect, test } from "bun:test";
import { Clock, ProgramTestContext } from "solana-bankrun";
import { Dice } from "../../target/types/dice";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { getBankrunSetup } from "../setup";
import { randomBytes } from "crypto";
import { getBetPdaAndBump, getVaultPdaAndBump } from "../pda";

describe("refundBet", () => {
  let { context, provider, program } = {} as {
    context: ProgramTestContext;
    provider: BankrunProvider;
    program: Program<Dice>;
  };

  const [houseKeypair, playerKeypair] = Array.from({ length: 2 }, () =>
    Keypair.generate()
  );
  const seed = new BN(randomBytes(16));
  const amount = new BN(LAMPORTS_PER_SOL);

  const [vaultPda] = getVaultPdaAndBump(houseKeypair.publicKey);
  const [betPda] = getBetPdaAndBump(vaultPda, seed);
  let initialVaultBal: bigint;
  let initialPlayerBal: bigint;
  let betAccBal: bigint;

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

    await program.methods
      .placeBet(seed, 50, amount)
      .accounts({
        house: houseKeypair.publicKey,
        player: playerKeypair.publicKey,
      })
      .signers([playerKeypair])
      .rpc();

    initialVaultBal = await context.banksClient.getBalance(vaultPda);
    initialPlayerBal = await context.banksClient.getBalance(
      playerKeypair.publicKey
    );
    betAccBal = await context.banksClient.getBalance(betPda);
  });

  test("refund a bet", async () => {
    const {
      slot,
      epochStartTimestamp,
      epoch,
      leaderScheduleEpoch,
      unixTimestamp,
    } = await context.banksClient.getClock();
    const refundCooldownSlots = 9000; // 1 hour
    context.setClock(
      new Clock(
        slot + BigInt(refundCooldownSlots + 1),
        epochStartTimestamp,
        epoch,
        leaderScheduleEpoch,
        unixTimestamp
      )
    );

    await program.methods
      .refundBet()
      .accountsPartial({
        house: houseKeypair.publicKey,
        player: playerKeypair.publicKey,
        bet: betPda,
      })
      .signers([playerKeypair])
      .rpc();

    const betAcc = await context.banksClient.getAccount(betPda);

    expect(betAcc).toBeNull();

    const postVaultBal = await context.banksClient.getBalance(vaultPda);

    expect(Number(postVaultBal)).toBe(
      Number(initialVaultBal) - amount.toNumber()
    );

    const postPlayerBal = await context.banksClient.getBalance(
      playerKeypair.publicKey
    );

    expect(Number(postPlayerBal)).toBe(
      Number(initialPlayerBal) + amount.toNumber() + Number(betAccBal)
    );
  });

  test("throws if refund cooldown is not over", async () => {
    try {
      await program.methods
        .refundBet()
        .accountsPartial({
          house: houseKeypair.publicKey,
          player: playerKeypair.publicKey,
          bet: betPda,
        })
        .signers([playerKeypair])
        .rpc();
    } catch (err) {
      expect(err).toBeInstanceOf(AnchorError);
      expect(err.error.errorCode.code).toEqual("RefundCooldownNotElapsed");
      expect(err.error.errorCode.number).toEqual(7000);
    }
  });
});
