import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, playerCharactersTable } from "@workspace/db";
import { eq, ilike, desc, asc, count, sql, or, type AnyColumn } from "drizzle-orm";

const router = Router();

const SORT_COLS: Record<string, AnyColumn> = {
  level: playersTable.level,
  gold: playersTable.gold,
  pvpRating: playersTable.pvpRating,
  wins: playersTable.wins,
  createdAt: playersTable.createdAt,
};

router.get("/players/leaderboard", async (req, res) => {
  try {
    const type = (req.query.type as string) || "level";
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const col = SORT_COLS[type] ?? playersTable.level;

    const rows = await db
      .select({
        discordId: playersTable.discordId,
        username: playersTable.username,
        level: playersTable.level,
        gold: playersTable.gold,
        pvpRating: playersTable.pvpRating,
        wins: playersTable.wins,
        totalDamageDealt: playersTable.totalDamageDealt,
      })
      .from(playersTable)
      .where(eq(playersTable.isBanned, false))
      .orderBy(desc(col))
      .limit(limit);

    const valueMap: Record<string, keyof typeof rows[0]> = {
      level: "level",
      gold: "gold",
      pvpRating: "pvpRating",
      wins: "wins",
      totalDamageDealt: "totalDamageDealt",
    };
    const valueKey = valueMap[type] ?? "level";

    res.json(
      rows.map((r, i) => ({
        rank: i + 1,
        discordId: r.discordId,
        username: r.username,
        value: Number(r[valueKey as keyof typeof r] ?? 0),
        level: r.level,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get leaderboard");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/players", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = req.query.search as string | undefined;
    const sort = (req.query.sort as string) || "level";
    const offset = (page - 1) * limit;
    const col = SORT_COLS[sort] ?? playersTable.level;

    const where = search
      ? or(
          ilike(playersTable.username, `%${search}%`),
          ilike(playersTable.discordId, `%${search}%`)
        )
      : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: playersTable.id,
          discordId: playersTable.discordId,
          username: playersTable.username,
          level: playersTable.level,
          gold: playersTable.gold,
          gems: playersTable.gems,
          pvpRating: playersTable.pvpRating,
          wins: playersTable.wins,
          losses: playersTable.losses,
          isBanned: playersTable.isBanned,
          currentWorld: playersTable.currentWorld,
          createdAt: playersTable.createdAt,
        })
        .from(playersTable)
        .where(where)
        .orderBy(desc(col))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(playersTable).where(where),
    ]);

    const total = totalResult[0].count;
    res.json({
      data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get players");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/players/:discordId", async (req, res) => {
  try {
    const { discordId } = req.params;
    const [player] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.discordId, discordId));

    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const [charCount] = await db
      .select({ count: count() })
      .from(playerCharactersTable)
      .where(eq(playerCharactersTable.playerId, player.id));

    res.json({
      player: {
        id: player.id,
        discordId: player.discordId,
        username: player.username,
        level: player.level,
        gold: player.gold,
        gems: player.gems,
        pvpRating: player.pvpRating,
        wins: player.wins,
        losses: player.losses,
        isBanned: player.isBanned,
        currentWorld: player.currentWorld,
        createdAt: player.createdAt.toISOString(),
      },
      characterCount: charCount.count,
      totalDamageDealt: Number(player.totalDamageDealt),
      maxAbyssFloor: player.maxAbyssFloor,
      stamina: player.stamina,
      maxStamina: player.maxStamina,
      currentTitle: player.currentTitle ?? undefined,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get player");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/players/:discordId/ban", async (req, res) => {
  try {
    const { discordId } = req.params;
    const { ban, reason } = req.body as { ban: boolean; reason?: string };
    await db
      .update(playersTable)
      .set({ isBanned: ban, banReason: reason ?? null })
      .where(eq(playersTable.discordId, discordId));
    res.json({ success: true, message: ban ? "Player banned" : "Player unbanned" });
  } catch (err) {
    req.log.error({ err }, "Failed to ban player");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/players/:discordId/modify", async (req, res) => {
  try {
    const { discordId } = req.params;
    const { gold, gems, xp } = req.body as { gold?: number; gems?: number; xp?: number };
    const updates: Partial<typeof playersTable.$inferInsert> = {};
    if (gold !== undefined) updates.gold = gold;
    if (gems !== undefined) updates.gems = gems;
    if (xp !== undefined) updates.xp = xp;
    await db.update(playersTable).set(updates).where(eq(playersTable.discordId, discordId));
    res.json({ success: true, message: "Player modified" });
  } catch (err) {
    req.log.error({ err }, "Failed to modify player");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
