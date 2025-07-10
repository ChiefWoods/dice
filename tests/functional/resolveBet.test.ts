import { BN, Program } from "@coral-xyz/anchor";
import { beforeEach, describe, expect, test } from "bun:test";
import { Dice } from "../../target/types/dice";
import {
  Ed25519Program,
  Keypair,
  LAMPORTS_PER_SOL,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { randomBytes } from "crypto";
import { getBetPda, getVaultPda } from "../pda";
import { LiteSVM } from "litesvm";
import { LiteSVMProvider } from "anchor-litesvm";
import { expectAnchorError, fundedSystemAccountInfo, getSetup } from "../setup";

describe("resolveBet", () => {
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
  });

  test("resolve a bet", async () => {
    const initVaultBal = litesvm.getBalance(vaultPda);
    const initPlayerBal = litesvm.getBalance(playerKeypair.publicKey);

    const [betPda] = getBetPda(vaultPda, seed);
    let betAcc = litesvm.getAccount(betPda);

    const sigIx = Ed25519Program.createInstructionWithPrivateKey({
      message: betAcc.data.subarray(8), // begin after Anchor account discriminator
      privateKey: houseKeypair.secretKey,
    });

    const sig = Buffer.from(sigIx.data.buffer.slice(16 + 32, 16 + 32 + 64));

    await program.methods
      .resolveBet(sig)
      .accountsPartial({
        house: houseKeypair.publicKey,
        player: playerKeypair.publicKey,
        bet: betPda,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .preInstructions([sigIx])
      .signers([houseKeypair])
      .rpc();

    const betAccBal = litesvm.getBalance(betPda);

    expect(betAccBal).toBe(0n);

    const postVaultBal = litesvm.getBalance(vaultPda);

    expect(initVaultBal).toBeGreaterThanOrEqual(postVaultBal);
  });

  test("throws if program of first instruction is not Ed25519", async () => {
    const [betPda] = getBetPda(vaultPda, seed);
    const betAcc = litesvm.getAccount(betPda);

    const sigIx = Ed25519Program.createInstructionWithPrivateKey({
      message: betAcc.data.subarray(8),
      privateKey: houseKeypair.secretKey,
    });

    const sig = Buffer.from(sigIx.data.buffer.slice(16 + 32, 16 + 32 + 64));

    try {
      await program.methods
        .resolveBet(sig)
        .accountsPartial({
          house: houseKeypair.publicKey,
          player: playerKeypair.publicKey,
          bet: betPda,
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .postInstructions([sigIx])
        .signers([houseKeypair])
        .rpc();
    } catch (err) {
      expectAnchorError(err, "InvalidEd25519ProgramID");
    }
  });

  test("throws if signature pubkey is invalid", async () => {
    const [betPda] = getBetPda(vaultPda, seed);
    const betAcc = litesvm.getAccount(betPda);

    const sigIx = Ed25519Program.createInstructionWithPrivateKey({
      message: betAcc.data.subarray(8),
      privateKey: playerKeypair.secretKey,
    });

    const sig = Buffer.from(sigIx.data.buffer.slice(16 + 32, 16 + 32 + 64));

    try {
      await program.methods
        .resolveBet(sig)
        .accountsPartial({
          house: houseKeypair.publicKey,
          player: playerKeypair.publicKey,
          bet: betPda,
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .preInstructions([sigIx])
        .signers([houseKeypair])
        .rpc();
    } catch (err) {
      expectAnchorError(err, "InvalidEd25519Pubkey");
    }
  });

  test("throws if instruction data does not match", async () => {
    const [betPda] = getBetPda(vaultPda, seed);
    const playerAcc = litesvm.getAccount(playerKeypair.publicKey);

    const sigIx = Ed25519Program.createInstructionWithPrivateKey({
      message: playerAcc.data,
      privateKey: houseKeypair.secretKey,
    });

    const sig = Buffer.from(sigIx.data.buffer.slice(16 + 32, 16 + 32 + 64));

    try {
      await program.methods
        .resolveBet(sig)
        .accountsPartial({
          house: houseKeypair.publicKey,
          player: playerKeypair.publicKey,
          bet: betPda,
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .preInstructions([sigIx])
        .signers([houseKeypair])
        .rpc();
    } catch (err) {
      expectAnchorError(err, "InvalidEd25519Message");
    }
  });
});
