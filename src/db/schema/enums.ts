import { pgEnum } from "drizzle-orm/pg-core";

export const duelStatusEnum = pgEnum("duel_status", [
  "OPEN",
  "ACTIVE",
  "DISPUTED",
  "SETTLED",
  "CANCELLED",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "STAKE",
  "REWARD",
  "WITHDRAW",
  "CLAIM",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "PENDING",
  "SUCCESS",
  "FAILED",
]);
