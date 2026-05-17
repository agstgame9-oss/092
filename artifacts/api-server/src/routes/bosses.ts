import { Router } from "express";
import { db } from "@workspace/db";
import { bossesTable } from "@workspace/db";
import { count, desc, eq } from "drizzle-orm";

const router = Router();

router.get("/bosses", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: bossesTable.id,
          name: bossesTable.name,
          title: bossesTable.title,
          animeSource: bossesTable.animeSource,
          element1: bossesTable.element1,
          element2: bossesTable.element2,
          tier: bossesTable.tier,
          hp: bossesTable.hp,
          atk: bossesTable.atk,
          def: bossesTable.def,
          spd: bossesTable.spd,
          isWorldBoss: bossesTable.isWorldBoss,
          isAbyssBoss: bossesTable.isAbyssBoss,
          abyssFloor: bossesTable.abyssFloor,
          isEnabled: bossesTable.isEnabled,
          xpReward: bossesTable.xpReward,
          goldReward: bossesTable.goldReward,
        })
        .from(bossesTable)
        .orderBy(desc(bossesTable.hp))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(bossesTable),
    ]);

    const total = totalResult[0].count;
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.isWorldBoss ? "world_boss" : r.isAbyssBoss ? "abyss_boss" : "regular",
        element: r.element1,
        baseHp: r.hp,
        currentHp: r.hp,
        maxHp: r.hp,
        level: r.abyssFloor ?? 1,
        isActive: r.isEnabled,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get bosses");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
