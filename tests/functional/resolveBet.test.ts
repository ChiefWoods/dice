import { AnchorError, BN, Program } from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";
import { beforeEach, describe, expect, test } from "bun:test";
import { ProgramTestContext } from "solana-bankrun";
import { Dice } from "../../target/types/dice";
import {
  Ed25519Program,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { getBankrunSetup } from "../setup";
import { randomBytes } from "crypto";
import { getBetPdaAndBump, getVaultPdaAndBump } from "../pda";

describe("resolveBet", () => {
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
  });

  test("resolve a bet", async () => {
    const initVaultBal = await context.banksClient.getBalance(vaultPda);
    const initPlayerBal = await context.banksClient.getBalance(
      playerKeypair.publicKey
    );

    const [betPda] = getBetPdaAndBump(vaultPda, seed);
    let betAcc = await context.banksClient.getAccount(betPda);

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

    betAcc = await context.banksClient.getAccount(betPda);

    expect(betAcc).toBeNull();

    const postVaultBal = await context.banksClient.getBalance(vaultPda);

    expect(initVaultBal).toBeGreaterThanOrEqual(postVaultBal);
  });

  test("throws if program of first instruction is not Ed25519", async () => {
    const [betPda] = getBetPdaAndBump(vaultPda, seed);
    const betAcc = await context.banksClient.getAccount(betPda);

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
      expect(err).toBeInstanceOf(AnchorError);
      expect(err.error.errorCode.code).toEqual("InvalidEd25519ProgramID");
      expect(err.error.errorCode.number).toEqual(6000);
    }
  });

  test("throws if signature pubkey is invalid", async () => {
    const [betPda] = getBetPdaAndBump(vaultPda, seed);
    const betAcc = await context.banksClient.getAccount(betPda);

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
      expect(err).toBeInstanceOf(AnchorError);
      expect(err.error.errorCode.code).toEqual("InvalidEd25519Pubkey");
      expect(err.error.errorCode.number).toEqual(6004);
    }
  });

  test("throws if instruction data does not match", async () => {
    const [betPda] = getBetPdaAndBump(vaultPda, seed);
    const playerAcc = await context.banksClient.getAccount(
      playerKeypair.publicKey
    );

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
      expect(err).toBeInstanceOf(AnchorError);
      expect(err.error.errorCode.code).toEqual("InvalidEd25519Message");
      expect(err.error.errorCode.number).toEqual(6006);
    }
  });
});
