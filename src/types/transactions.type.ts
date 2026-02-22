export type TransactionType = "STAKE" | "REWARD" | "WITHDRAW" | "CLAIM";
export type TransactionStatus = "PENDING" | "SUCCESS" | "FAILED";

import { pgEnum } from "drizzle-orm/pg-core";

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
