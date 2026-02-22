import { pgTable, varchar, numeric, uuid, boolean } from "drizzle-orm/pg-core";
export * from "./user.schema";
export * from "./games.schema";
export * from "./relations.schema";
export const blockchainData = pgTable("blockchain_data", {
  id: uuid("id")
    .primaryKey()
    .default(uuid() as any),
  stakeAmount: numeric("stake_amount", { precision: 18, scale: 9 }).notNull(),
  tokenMint: varchar("token_mint", { length: 255 }).notNull(),
});

// Type inference helpers
