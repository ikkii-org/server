import { decimal, numeric, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./user.schema";

export const wallet = pgTable("wallet", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),

  token: varchar("token").notNull(),

  availableBalance: numeric("available_balance", { precision: 20, scale: 6 })
    .notNull()
    .default("0"),

  lockedBalance: numeric("locked_balance", { precision: 20, scale: 6 })
    .notNull()
    .default("0"),
});

export type Wallet = typeof wallet.$inferSelect;
