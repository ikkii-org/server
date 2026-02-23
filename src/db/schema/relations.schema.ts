import { relations } from "drizzle-orm";
import { gameProfiles, games, matches } from "./games.schema";
import { users } from "./user.schema";
import { wallet } from "./wallet.schema";

export const gameToMatches = relations(games, ({ many }) => ({
  matches: many(matches),
}));

export const matchesToGame = relations(matches, ({ one }) => ({
  game: one(gameProfiles, {
    fields: [matches.gameprofileId],
    references: [gameProfiles.id],
  }),
}));

export const userToGames = relations(users, ({ many }) => ({
  games: many(games),
}));

export const gamesToUser = relations(games, ({ one }) => ({
  user: one(users, {
    fields: [games.userId],
    references: [users.id],
  }),
}));

export const walletToBalance = relations(wallet, ({ one }) => ({
  user: one(users, {
    fields: [wallet.userId],
    references: [users.id],
  }),
}));
