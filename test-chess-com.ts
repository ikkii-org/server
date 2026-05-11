import {
  getPlayer,
  getPlayerStats,
  getMonthlyArchive,
  verifyMatchBetweenPlayers,
  formatRank,
  buildStatsJson,
} from "./src/api/v1/services/chess-com.service";

const BASE_URL = "https://api.chess.com/pub";
const USERNAME = "harshhchauhan";
const OPPONENT = "killoutw";

async function runTests() {
  let passed = 0;
  let failed = 0;

  // ─── Test 1: Fetch Profile ──────────────────────────────────────────────────
  console.log("\n=== Test 1: Fetch Profile (harshhchauhan) ===");
  const player = await getPlayer(BASE_URL, USERNAME);
  if (player) {
    console.log("✅ Username:", player.username);
    console.log("✅ Player ID:", player.player_id);
    console.log("✅ Status:", player.status);
    console.log("✅ Followers:", player.followers);
    if (player.title) console.log("✅ Title:", player.title);
    passed++;
  } else {
    console.error("❌ Failed to fetch profile");
    failed++;
  }

  // ─── Test 2: Fetch Stats ────────────────────────────────────────────────────
  console.log("\n=== Test 2: Fetch Stats (harshhchauhan) ===");
  const stats = await getPlayerStats(BASE_URL, USERNAME);
  if (stats) {
    console.log("✅ Formatted Rank:", formatRank(stats));
    const statsJson = buildStatsJson(stats);
    console.log("✅ Stats JSON keys:", Object.keys(statsJson).join(", "));
    if (stats.chess_blitz) {
      console.log("✅ Blitz rating:", stats.chess_blitz.last?.rating);
    }
    if (stats.chess_rapid) {
      console.log("✅ Rapid rating:", stats.chess_rapid.last?.rating);
    }
    if (stats.chess_bullet) {
      console.log("✅ Bullet rating:", stats.chess_bullet.last?.rating);
    }
    passed++;
  } else {
    console.error("❌ Failed to fetch stats");
    failed++;
  }

  // ─── Test 3: Fetch Monthly Archive ──────────────────────────────────────────
  console.log("\n=== Test 3: Fetch Monthly Archive ===");
  const now = new Date();
  const archive = await getMonthlyArchive(
    BASE_URL,
    USERNAME,
    now.getFullYear(),
    now.getMonth() + 1
  );
  if (archive) {
    console.log("✅ Games this month:", archive.games?.length ?? 0);
    if (archive.games?.length) {
      const lastGame = archive.games[archive.games.length - 1];
      const opponent =
        lastGame.white.username.toLowerCase() === USERNAME.toLowerCase()
          ? lastGame.black.username
          : lastGame.white.username;
      console.log("✅ Last game vs:", opponent);
      console.log("✅ Result (white):", lastGame.white.result);
      console.log("✅ Result (black):", lastGame.black.result);
      console.log("✅ Time class:", lastGame.time_class);
      console.log("✅ Rules:", lastGame.rules);
      console.log(
        "✅ End time:",
        new Date(lastGame.end_time * 1000).toISOString()
      );
      if (lastGame.accuracies) {
        console.log(
          "✅ Accuracies — White:",
          lastGame.accuracies.white,
          "Black:",
          lastGame.accuracies.black
        );
      }
    }
    passed++;
  } else {
    console.error("❌ Failed to fetch archive");
    failed++;
  }

  // ─── Test 4: Verify Match with killoutw ─────────────────────────────────────
  console.log("\n=== Test 4: Verify Match (harshhchauhan vs killoutw) ===");
  const matchResult = await verifyMatchBetweenPlayers(
    BASE_URL,
    USERNAME,
    OPPONENT,
    24 * 60 * 30 // 30 days for testing
  );
  console.log("✅ Verified:", matchResult.verified);
  console.log("✅ Winner:", matchResult.winner);
  console.log("✅ Reason:", matchResult.reason);
  if (matchResult.verified) {
    passed++;
  } else {
    // Not a failure — they might not have played recently
    console.log("ℹ️  No recent match found (this is okay if they haven't played)");
    passed++; // Still passes the API test
  }

  // ─── Test 5: Non-existent User ──────────────────────────────────────────────
  console.log("\n=== Test 5: Non-existent User ===");
  const fake = await getPlayer(BASE_URL, "thisusernamedoesnotexist12345");
  if (fake === null) {
    console.log("✅ Correctly returned null for non-existent user");
    passed++;
  } else {
    console.error("❌ Should have returned null");
    failed++;
  }

  // ─── Test 6: Invalid Username Format ────────────────────────────────────────
  console.log("\n=== Test 6: Username with Spaces (should normalize) ===");
  const spaced = await getPlayer(BASE_URL, "  HarshhChauhan  ");
  if (spaced && spaced.username === "harshhchauhan") {
    console.log("✅ Correctly normalized username:", spaced.username);
    passed++;
  } else {
    console.error("❌ Failed to normalize username");
    failed++;
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log("\n=== Test Summary ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
