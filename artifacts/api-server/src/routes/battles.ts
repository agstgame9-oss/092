import { Router } from "express";
import { db } from "@workspace/db";
import { battlesTable } from "@workspace/db";
import { eq, count, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/battles/stats", async (req, res) => {
  try {
    const rows = await db
      .select({ type: battlesTable.type, count: count() })
      .from(battlesTable)
      .groupBy(battlesTable.type);
    res.json(rows.map((r) => ({ type: r.type, count: r.count })));
  } catch (err) {
    req.log.error({ err }, "Failed to get battle stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/battles", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    const where = type && status
      ? sql`${battlesTable.type} = ${type} AND ${battlesTable.status} = ${status}`
      : type
      ? eq(battlesTable.type, type as any)
      : status
      ? eq(battlesTable.status, status as any)
      : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: battlesTable.id,
          type: battlesTable.type,
          status: battlesTable.status,
          player1DiscordId: battlesTable.player1DiscordId,
          player2DiscordId: battlesTable.player2DiscordId,
          winnerId: battlesTable.winnerId,
          turnNumber: battlesTable.turnNumber,
          xpEarned: battlesTable.xpEarned,
          goldEarned: battlesTable.goldEarned,
          createdAt: battlesTable.createdAt,
        })
        .from(battlesTable)
        .where(where)
        .orderBy(desc(battlesTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(battlesTable).where(where),
    ]);

    const total = totalResult[0].count;
    res.json({
      data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get battles");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
