import {
  pgTable,
  varchar,
  timestamp,
  integer,
  real,
  uuid,
  index,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: uuid("user_id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  walletKey: varchar("wallet_key", { length: 255 }).notNull().unique(),
  pfp: varchar("pfp", { length: 500 }),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    createdAtIdx: index("users_created_at_idx").on(table.createdAt),
  };
});

export const portfolio = pgTable("portfolio", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  solanaBalance: real("solana_balance").notNull().default(0),
  currentRank: integer("current_rank").notNull().default(0),
  previousRank: integer("previous_rank").notNull().default(0),
  totalStakeWon: real("total_won").notNull().default(0),
  totalStakeLost: real("total_lost").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("portfolio_user_id_idx").on(table.userId),
    currentRankIdx: index("portfolio_current_rank_idx").on(table.currentRank),
  };
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Portfolio = typeof portfolio.$inferSelect;
export type NewPortfolio = typeof portfolio.$inferInsert;
