import { pgTable, serial, varchar, timestamp, numeric, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    userId: serial("user_id").primaryKey(),
    username: varchar("username", { length: 255 }).notNull().unique(),
    walletKey: varchar("wallet_key", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const duels = pgTable("duels", {
    id: text("id").primaryKey(),
    player1: varchar("player1", { length: 255 }).notNull(),
    player2: varchar("player2", { length: 255 }),
    stakeAmount: numeric("stake_amount", { precision: 18, scale: 9 }).notNull(),
    tokenMint: varchar("token_mint", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("OPEN"),
    winner: varchar("winner", { length: 255 }),
    player1SubmittedWinner: varchar("player1_submitted_winner", { length: 255 }),
    player2SubmittedWinner: varchar("player2_submitted_winner", { length: 255 }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type inference helpers
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Duel = typeof duels.$inferSelect;
export type NewDuel = typeof duels.$inferInsert;
