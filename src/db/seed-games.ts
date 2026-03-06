/**
 * Seed the `games` table with supported games.
 *
 * Usage:  bun src/db/seed-games.ts
 */

import { db } from "./index";
import { games } from "./schema";
import { eq } from "drizzle-orm";

const GAMES_TO_SEED = [
    {
        name: "Clash Royale",
        icon: "https://cdn-icons-png.flaticon.com/512/588/588378.png",
        apiBaseUrl: "https://api.clashroyale.com/v1",
    },
    {
        name: "Valorant",
        icon: "https://cdn-icons-png.flaticon.com/512/7455/7455025.png",
        apiBaseUrl: null,
    },
    {
        name: "CS2",
        icon: "https://cdn-icons-png.flaticon.com/512/2503/2503508.png",
        apiBaseUrl: null,
    },
    {
        name: "Apex Legends",
        icon: "https://cdn-icons-png.flaticon.com/512/3408/3408478.png",
        apiBaseUrl: null,
    },
];

async function seed() {
    console.log("Seeding games table...");

    for (const game of GAMES_TO_SEED) {
        const [existing] = await db
            .select()
            .from(games)
            .where(eq(games.name, game.name));

        if (existing) {
            console.log(`  Already exists: "${game.name}" (${existing.id})`);
        } else {
            const [inserted] = await db
                .insert(games)
                .values(game)
                .returning();
            console.log(`  Inserted: "${inserted.name}" (${inserted.id})`);
        }
    }

    console.log("Done.");
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
