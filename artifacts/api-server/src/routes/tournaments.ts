import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq, count, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/tournaments", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    const where = status ? eq(tournamentsTable.status, status as any) : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: tournamentsTable.id,
          name: tournamentsTable.name,
          status: tournamentsTable.status,
          size: tournamentsTable.size,
          currentRound: tournamentsTable.currentRound,
          totalRounds: tournamentsTable.totalRounds,
          prizePool: tournamentsTable.prizePool,
          winnerId: tournamentsTable.winnerId,
          winnerUsername: tournamentsTable.winnerUsername,
          createdAt: tournamentsTable.createdAt,
        })
        .from(tournamentsTable)
        .where(where)
        .orderBy(desc(tournamentsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(tournamentsTable).where(where),
    ]);

    const total = totalResult[0].count;
    res.json({
      data: rows.map((r) => ({
        ...r,
        maxParticipants: r.size,
        currentParticipants: 0,
        startedAt: null,
        endedAt: null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get tournaments");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
