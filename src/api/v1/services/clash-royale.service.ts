/**
 * Clash Royale API Integration Service
 *
 * Endpoints used:
 *  - GET /players/{tag}           → Player profile (trophies, bestTrophies)
 *  - GET /players/{tag}/battlelog → Last 25 battles
 *
 * Note: Player tags start with "#", must be URL-encoded (# → %23)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClashRoyalePlayer {
  tag: string;
  name: string;
  trophies: number;
  bestTrophies: number;
  expLevel: number;
  arena: {
    id: number;
    name: string;
  };
  clan?: {
    tag: string;
    name: string;
  };
}

export interface ClashRoyaleBattle {
  type: string;
  battleTime: string; // ISO format: "20260305T143000.000Z"
  team: Array<{
    tag: string;
    name: string;
    crowns: number;
  }>;
  opponent: Array<{
    tag: string;
    name: string;
    crowns: number;
  }>;
  gameMode: {
    id: number;
    name: string;
  };
}

export interface MatchResult {
  won: boolean;
  battleTime: Date;
  crowns: number;
  opponentCrowns: number;
  gameMode: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Encode player tag for URL (e.g., "#ABC123" → "%23ABC123")
 */
function encodeTag(tag: string): string {
  return encodeURIComponent(tag);
}

/**
 * Parse Clash Royale's battleTime format to JS Date
 * Format: "20260305T143000.000Z"
 */
function parseBattleTime(battleTime: string): Date {
  // Insert dashes and colons: "2026-03-05T14:30:00.000Z"
  const formatted = battleTime.replace(
    /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
    "$1-$2-$3T$4:$5:$6"
  );
  return new Date(formatted);
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Fetch player profile from Clash Royale API
 */
export async function getPlayer(
  baseUrl: string,
  apiKey: string,
  playerTag: string
): Promise<ClashRoyalePlayer | null> {
  const url = `${baseUrl}/players/${encodeTag(playerTag)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error(`Clash Royale API error: ${response.status} for tag ${playerTag}`);
    return null;
  }

  return response.json();
}

/**
 * Fetch player's battle log (last 25 matches)
 */
export async function getBattleLog(
  baseUrl: string,
  apiKey: string,
  playerTag: string
): Promise<ClashRoyaleBattle[]> {
  const url = `${baseUrl}/players/${encodeTag(playerTag)}/battlelog`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error(`Clash Royale API error: ${response.status} for battlelog ${playerTag}`);
    return [];
  }

  return response.json();
}

// ─── Match Verification ───────────────────────────────────────────────────────

/**
 * Get the most recent 1v1 match result for a player
 *
 * Filters out 2v2, war, and other non-duel modes
 */
export async function getLastMatchResult(
  baseUrl: string,
  apiKey: string,
  playerTag: string
): Promise<MatchResult | null> {
  const battles = await getBattleLog(baseUrl, apiKey, playerTag);

  // Find the first 1v1 battle (team and opponent each have 1 player)
  const match = battles.find(
    (b) => b.team.length === 1 && b.opponent.length === 1
  );

  if (!match) {
    return null;
  }

  const playerCrowns = match.team[0].crowns;
  const opponentCrowns = match.opponent[0].crowns;

  return {
    won: playerCrowns > opponentCrowns,
    battleTime: parseBattleTime(match.battleTime),
    crowns: playerCrowns,
    opponentCrowns,
    gameMode: match.gameMode.name,
  };
}

/**
 * Verify if two players played against each other recently
 *
 * Checks if player1's last opponent tag matches player2's tag
 */
export async function verifyMatchBetweenPlayers(
  baseUrl: string,
  apiKey: string,
  player1Tag: string,
  player2Tag: string,
  withinMinutes: number = 30
): Promise<{ verified: boolean; winner: string | null; reason: string }> {
  const battles1 = await getBattleLog(baseUrl, apiKey, player1Tag);
  const battles2 = await getBattleLog(baseUrl, apiKey, player2Tag);

  if (battles1.length === 0 || battles2.length === 0) {
    return { verified: false, winner: null, reason: "Could not fetch battle logs" };
  }

  // Find a 1v1 match where they faced each other
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);

  for (const battle of battles1) {
    // Must be 1v1
    if (battle.team.length !== 1 || battle.opponent.length !== 1) continue;

    // Must be recent
    const battleDate = parseBattleTime(battle.battleTime);
    if (battleDate < cutoff) break; // Battles are sorted newest first

    // Check if opponent is player2
    const opponentTag = battle.opponent[0].tag;
    if (opponentTag === player2Tag) {
      const p1Crowns = battle.team[0].crowns;
      const p2Crowns = battle.opponent[0].crowns;

      if (p1Crowns > p2Crowns) {
        return { verified: true, winner: player1Tag, reason: "Player 1 won the match" };
      } else if (p2Crowns > p1Crowns) {
        return { verified: true, winner: player2Tag, reason: "Player 2 won the match" };
      } else {
        return { verified: false, winner: null, reason: "Match ended in a draw" };
      }
    }
  }

  return { verified: false, winner: null, reason: "No recent match found between these players" };
}
