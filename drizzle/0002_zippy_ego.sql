ALTER TABLE "games" DROP CONSTRAINT "games_ingame_username_unique";--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_game_profile_id_unique";--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "games_ingame_username_idx" ON "games" USING btree ("ingame_username");--> statement-breakpoint
CREATE INDEX "matches_created_at_idx" ON "matches" USING btree ("created_at");