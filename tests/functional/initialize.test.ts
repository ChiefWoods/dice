import { BankrunProvider } from "anchor-bankrun";
import { beforeEach, describe, expect, test } from "bun:test";
import { ProgramTestContext } from "solana-bankrun";
import { Dice } from "../../target/types/dice";
import { BN, Program } from "@coral-xyz/anchor";
import { getBankrunSetup } from "../setup";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { getVaultPdaAndBump } from "../pda";

describe("initialize", () => {
  let { context, provider, program } = {} as {
    context: ProgramTestContext;
    provider: BankrunProvider;
    program: Program<Dice>;
  };

  const houseKeypair = Keypair.generate();
  const initialHouseBal = LAMPORTS_PER_SOL * 10;

  beforeEach(async () => {
    ({ context, provider, program } = await getBankrunSetup([
      {
        address: houseKeypair.publicKey,
        info: {
          lamports: initialHouseBal,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
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

    const [vaultPda] = getVaultPdaAndBump(houseKeypair.publicKey);
    const vaultBal = await context.banksClient.getBalance(vaultPda);

    expect(Number(vaultBal)).toBe(amount.toNumber());

    const postHouseBal = await context.banksClient.getBalance(
      houseKeypair.publicKey
    );

    expect(Number(postHouseBal)).toBe(initialHouseBal - amount.toNumber());
  });
});
