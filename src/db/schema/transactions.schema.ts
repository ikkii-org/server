import { users } from "./user.schema";
import { duels } from "./games.schema";

import { uuid, pgTable, index, numeric, timestamp } from "drizzle-orm/pg-core";
import { transactionStatusEnum, transactionTypeEnum } from "./enums";

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  duelId: uuid("duel_id")
    .references(() => duels.id, { onDelete: "cascade" }),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  transactionStatus: transactionStatusEnum("transaction_status").notNull(),
  amount: numeric("amount", { precision: 20, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    userIdIdx: index("transactions_user_id_idx").on(table.userId),
    duelIdIdx: index("transactions_duel_id_idx").on(table.duelId),
    transactionStatusIdx: index("transactions_status_idx").on(table.transactionStatus),
    transactionTypeIdx: index("transactions_type_idx").on(table.transactionType),
  };
});

export type Transaction = typeof transactions.$inferSelect;
