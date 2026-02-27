import {
  pgTable,
  varchar,
  uuid,
  timestamp,
  boolean,
  real,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./user.schema";
import { duelStatusEnum } from "./enums";
export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull().unique(),
  ingame_username: varchar("ingame_username", { length: 255 })
    .notNull()
    .unique(),
}, (table) => {
  return {
    userIdIdx: index("games_user_id_idx").on(table.userId),
  };
});

export const duels = pgTable("duels", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: duelStatusEnum("status").notNull().default("OPEN"),
  player1Username: varchar("player1_username", { length: 255 }).notNull(),
  player2Username: varchar("player2_username", { length: 255 }),
  player1Id: uuid("player1_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  player2Id: uuid("player2_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  winnerUsername: varchar("winner_username", { length: 255 }),
  winnerId: uuid("winner_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  player1SubmittedWinner: varchar("player1_submitted_winner", { length: 255 }),
  player2SubmittedWinner: varchar("player2_submitted_winner", { length: 255 }),
  stakeAmount: real("stake_amount").notNull(),
  tokenMint: varchar("token_mint", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  gameId: uuid("game_id").references(() => games.id, {
    onDelete: "cascade",
  }),
}, (table) => {
  return {
    statusIdx: index("duels_status_idx").on(table.status),
    player1IdIdx: index("duels_player1_id_idx").on(table.player1Id),
    player2IdIdx: index("duels_player2_id_idx").on(table.player2Id),
    winnerIdIdx: index("duels_winner_id_idx").on(table.winnerId),
    expiresAtIdx: index("duels_expires_at_idx").on(table.expiresAt),
    createdAtIdx: index("duels_created_at_idx").on(table.createdAt),
  };
});

export const duelParticipants = pgTable("duel_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  duelId: uuid("duel_id")
    .notNull()
    .references(() => duels.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
}, (table) => {
  return {
    duelIdIdx: index("duel_participants_duel_id_idx").on(table.duelId),
    userIdIdx: index("duel_participants_user_id_idx").on(table.userId),
    duelUserIdx: index("duel_participants_duel_user_idx").on(table.duelId, table.userId),
  };
});

export const matches = pgTable("matches", {
  id: uuid("id")
    .primaryKey()
    .$default(uuid() as any),
  gameprofileId: uuid("game_profile_id")
    .notNull()
    .references(() => gameProfiles.id, { onDelete: "cascade" })
    .unique(),
  mvp: boolean("mvp").notNull().default(false),
  won: boolean("won").notNull().default(false),
}, (table) => {
  return {
    gameprofileIdIdx: index("matches_game_profile_id_idx").on(table.gameprofileId),
    wonIdx: index("matches_won_idx").on(table.won),
    mvpIdx: index("matches_mvp_idx").on(table.mvp),
  };
});

export const gameProfiles = pgTable("game_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").unique(),
  rank: varchar("rank"),
}, (table) => {
  return {
    userIdIdx: index("game_profiles_user_id_idx").on(table.userId),
    gameIdIdx: index("game_profiles_game_id_idx").on(table.gameId),
    userGameIdx: index("game_profiles_user_game_idx").on(table.userId, table.gameId),
  };
});

export type gameProfile = typeof gameProfiles.$inferSelect;
export type match = typeof matches.$inferSelect;
