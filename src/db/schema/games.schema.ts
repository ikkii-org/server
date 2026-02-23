import {
  pgTable,
  varchar,
  uuid,
  timestamp,
  boolean,
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
});

export const duels = pgTable("duels", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: duelStatusEnum("status").notNull().default("OPEN"),
  player1Id: uuid("player1_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  player2Id: uuid("player2_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  winnerId: uuid("winner_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  player1SubmittedWinner: varchar("player1_submitted_winner", { length: 255 }),
  player2SubmittedWinner: varchar("player2_submitted_winner", { length: 255 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" })
    .unique(),
});

export const duelParticipants = pgTable("duel_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  duelId: uuid("duel_id")
    .notNull()
    .references(() => duels.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
});

export type gameProfile = typeof gameProfiles.$inferSelect;
export type match = typeof matches.$inferSelect;
