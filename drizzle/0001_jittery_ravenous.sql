CREATE TYPE "public"."duel_status" AS ENUM('OPEN', 'ACTIVE', 'DISPUTED', 'SETTLED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('STAKE', 'REWARD', 'WITHDRAW', 'CLAIM');--> statement-breakpoint
ALTER TABLE "duels" DROP CONSTRAINT "duels_game_id_unique";--> statement-breakpoint
ALTER TABLE "duels" ALTER COLUMN "player2_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "duels" ALTER COLUMN "game_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "player1_username" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "player2_username" varchar(255);--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "winner_username" varchar(255);--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "stake_amount" real NOT NULL;--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "token_mint" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
CREATE INDEX "duel_participants_duel_id_idx" ON "duel_participants" USING btree ("duel_id");--> statement-breakpoint
CREATE INDEX "duel_participants_user_id_idx" ON "duel_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "duel_participants_duel_user_idx" ON "duel_participants" USING btree ("duel_id","user_id");--> statement-breakpoint
CREATE INDEX "duels_status_idx" ON "duels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "duels_player1_id_idx" ON "duels" USING btree ("player1_id");--> statement-breakpoint
CREATE INDEX "duels_player2_id_idx" ON "duels" USING btree ("player2_id");--> statement-breakpoint
CREATE INDEX "duels_winner_id_idx" ON "duels" USING btree ("winner_id");--> statement-breakpoint
CREATE INDEX "duels_expires_at_idx" ON "duels" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "duels_created_at_idx" ON "duels" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "game_profiles_user_id_idx" ON "game_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_profiles_game_id_idx" ON "game_profiles" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_profiles_user_game_idx" ON "game_profiles" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "games_user_id_idx" ON "games" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "matches_game_profile_id_idx" ON "matches" USING btree ("game_profile_id");--> statement-breakpoint
CREATE INDEX "matches_won_idx" ON "matches" USING btree ("won");--> statement-breakpoint
CREATE INDEX "matches_mvp_idx" ON "matches" USING btree ("mvp");--> statement-breakpoint
CREATE INDEX "portfolio_user_id_idx" ON "portfolio" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "portfolio_current_rank_idx" ON "portfolio" USING btree ("current_rank");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_duel_id_idx" ON "transactions" USING btree ("duel_id");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("transaction_status");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "wallet_token_idx" ON "wallet" USING btree ("token");