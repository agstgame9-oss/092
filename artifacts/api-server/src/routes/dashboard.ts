import { Router } from "express";
import { db } from "@workspace/db";
import {
  playersTable,
  battlesTable,
  guildsTable,
  charactersTable,
  marketListingsTable,
  tournamentsTable,
  adminLogsTable,
} from "@workspace/db";
import { eq, sql, desc, gte, count, sum } from "drizzle-orm";

const router = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalPlayers,
      activeBattles,
      totalGuilds,
      totalCharacters,
      totalBattlesToday,
      newPlayersToday,
      marketListingsActive,
      activeTournaments,
      goldSum,
      bannedPlayers,
    ] = await Promise.all([
      db.select({ count: count() }).from(playersTable),
      db.select({ count: count() }).from(battlesTable).where(eq(battlesTable.status, "active")),
      db.select({ count: count() }).from(guildsTable),
      db.select({ count: count() }).from(charactersTable).where(eq(charactersTable.isEnabled, true)),
      db.select({ count: count() }).from(battlesTable).where(gte(battlesTable.createdAt, todayStart)),
      db.select({ count: count() }).from(playersTable).where(gte(playersTable.createdAt, todayStart)),
      db.select({ count: count() }).from(marketListingsTable).where(eq(marketListingsTable.status, "active")),
      db.select({ count: count() }).from(tournamentsTable).where(sql`${tournamentsTable.status} IN ('registration','active','finals')`),
      db.select({ total: sum(playersTable.gold) }).from(playersTable),
      db.select({ count: count() }).from(playersTable).where(eq(playersTable.isBanned, true)),
    ]);

    res.json({
      totalPlayers: totalPlayers[0].count,
      activeBattles: activeBattles[0].count,
      totalGuilds: totalGuilds[0].count,
      totalCharacters: totalCharacters[0].count,
      totalBattlesToday: totalBattlesToday[0].count,
      newPlayersToday: newPlayersToday[0].count,
      marketListingsActive: marketListingsActive[0].count,
      activeTournaments: activeTournaments[0].count,
      totalGoldInCirculation: Number(goldSum[0].total ?? 0),
      bannedPlayers: bannedPlayers[0].count,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/activity", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const recent = await db
      .select({
        id: battlesTable.id,
        type: battlesTable.type,
        status: battlesTable.status,
        player1: battlesTable.player1DiscordId,
        createdAt: battlesTable.createdAt,
      })
      .from(battlesTable)
      .orderBy(desc(battlesTable.createdAt))
      .limit(limit);

    const items = recent.map((b) => ({
      id: String(b.id),
      type: "battle",
      description: `Battle ${b.type} — ${b.status}`,
      timestamp: b.createdAt.toISOString(),
      playerUsername: b.player1,
    }));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to get activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/charts", async (req, res) => {
  try {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const battlesPerDay = await Promise.all(
      last7.map(async (d) => {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(start.getTime() + 86400000);
        const res = await db.select({ count: count() }).from(battlesTable)
          .where(sql`${battlesTable.createdAt} >= ${start} AND ${battlesTable.createdAt} < ${end}`);
        return { date: start.toISOString().slice(0, 10), value: res[0].count };
      })
    );

    const newPlayersPerDay = await Promise.all(
      last7.map(async (d) => {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(start.getTime() + 86400000);
        const res = await db.select({ count: count() }).from(playersTable)
          .where(sql`${playersTable.createdAt} >= ${start} AND ${playersTable.createdAt} < ${end}`);
        return { date: start.toISOString().slice(0, 10), value: res[0].count };
      })
    );

    const battleTypeDistribution = await db
      .select({ type: battlesTable.type, count: count() })
      .from(battlesTable)
      .groupBy(battlesTable.type);

    const rarityDistribution = await db
      .select({ rarity: charactersTable.rarity, count: count() })
      .from(charactersTable)
      .groupBy(charactersTable.rarity);

    res.json({
      battlesPerDay,
      newPlayersPerDay,
      battleTypeDistribution: battleTypeDistribution.map((r) => ({ type: r.type, count: r.count })),
      topRarityDistribution: rarityDistribution.map((r) => ({ rarity: r.rarity, count: r.count })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get chart data");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
