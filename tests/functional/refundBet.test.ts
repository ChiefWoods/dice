import { BN, Program } from "@coral-xyz/anchor";
import { beforeEach, describe, expect, test } from "bun:test";
import { Dice } from "../../target/types/dice";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { randomBytes } from "crypto";
import { getBetPda, getVaultPda } from "../pda";
import { Clock, LiteSVM } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import { expectAnchorError, fundedSystemAccountInfo, getSetup } from "../setup";

describe("refundBet", () => {
  let { litesvm, provider, program } = {} as {
    litesvm: LiteSVM;
    provider: LiteSVMProvider;
    program: Program<Dice>;
  };

  const [houseKeypair, playerKeypair] = Array.from({ length: 2 }, () =>
    Keypair.generate(),
  );
  const seed = new BN(randomBytes(16));
  const amount = new BN(LAMPORTS_PER_SOL);

  const [vaultPda] = getVaultPda(houseKeypair.publicKey);
  const [betPda] = getBetPda(vaultPda, seed);
  let initialVaultBal: bigint;
  let initialPlayerBal: bigint;
  let betAccBal: bigint;

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

    await program.methods
      .placeBet(seed, 50, amount)
      .accounts({
        house: houseKeypair.publicKey,
        player: playerKeypair.publicKey,
      })
      .signers([playerKeypair])
      .rpc();

    initialVaultBal = litesvm.getBalance(vaultPda);
    initialPlayerBal = litesvm.getBalance(playerKeypair.publicKey);
    betAccBal = litesvm.getBalance(betPda);
  });

  test("refund a bet", async () => {
    const {
      slot,
      epochStartTimestamp,
      epoch,
      leaderScheduleEpoch,
      unixTimestamp,
    } = litesvm.getClock();
    const refundCooldownSlots = 9000; // 1 hour
    litesvm.setClock(
      new Clock(
        slot + BigInt(refundCooldownSlots + 1),
        epochStartTimestamp,
        epoch,
        leaderScheduleEpoch,
        unixTimestamp,
      ),
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

    const betAccBal = litesvm.getBalance(betPda);

    expect(betAccBal).toBe(0n);

    const postVaultBal = litesvm.getBalance(vaultPda);

    expect(Number(postVaultBal)).toBe(
      Number(initialVaultBal) - amount.toNumber(),
    );

    const postPlayerBal = litesvm.getBalance(playerKeypair.publicKey);

    expect(Number(postPlayerBal)).toBeGreaterThan(
      Number(initialPlayerBal) + amount.toNumber() + Number(betAccBal),
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
      expectAnchorError(err, "RefundCooldownNotElapsed");
    }
  });
});
