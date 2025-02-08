import { Program } from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";
import { AddedAccount, startAnchor } from "solana-bankrun";
import { Dice } from "../target/types/dice";
import idl from "../target/idl/dice.json";

export async function getBankrunSetup(accounts: AddedAccount[] = []) {
  const context = await startAnchor("", [], accounts);
  const provider = new BankrunProvider(context);
  const program = new Program(idl as Dice, provider);

  return {
    context,
    provider,
    program,
  };
}
