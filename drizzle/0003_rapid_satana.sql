ALTER TABLE "games" DROP CONSTRAINT "games_user_id_users_user_id_fk";
--> statement-breakpoint
DROP INDEX "games_user_id_idx";--> statement-breakpoint
DROP INDEX "games_ingame_username_idx";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "ingame_username";