import { relations } from "drizzle-orm";
import { gameProfiles, games } from "./games.schema";
import { users } from "./user.schema";
import { wallet } from "./wallet.schema";

export const gameToProfiles = relations(games, ({ many }) => ({
  profiles: many(gameProfiles),
}));

export const profilesToGame = relations(gameProfiles, ({ one }) => ({
  game: one(games, {
    fields: [gameProfiles.gameId],
    references: [games.id],
  }),
}));

export const userToGames = relations(users, ({ many }) => ({
  games: many(games),
}));

export const walletToBalance = relations(wallet, ({ one }) => ({
  user: one(users, {
    fields: [wallet.userId],
    references: [users.id],
  }),
}));
