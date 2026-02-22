import { users } from "./user.schema";
import { duels } from "./games.schema";
import {
  transactionStatusEnum,
  transactionTypeEnum,
} from "../types/transactions.type";
import { uuid, pgTable } from "drizzle-orm/pg-core";

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  duelId: uuid("duel_id")
    .notNull()
    .references(() => duels.id, { onDelete: "cascade" }),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  transactionStatus: transactionStatusEnum("transaction_status").notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
