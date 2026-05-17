import { Router } from "express";
import { db } from "@workspace/db";
import { marketListingsTable } from "@workspace/db";
import { eq, count, desc, sql, sum } from "drizzle-orm";

const router = Router();

router.get("/market/stats", async (req, res) => {
  try {
    const [totalVolume, activeListings, soldListings, totalGoldTraded] = await Promise.all([
      db.select({ count: count() }).from(marketListingsTable),
      db.select({ count: count() }).from(marketListingsTable).where(eq(marketListingsTable.status, "active")),
      db.select({ count: count() }).from(marketListingsTable).where(eq(marketListingsTable.status, "sold")),
      db.select({ total: sum(marketListingsTable.price) }).from(marketListingsTable).where(eq(marketListingsTable.status, "sold")),
    ]);

    res.json({
      totalVolume: totalVolume[0].count,
      activeListings: activeListings[0].count,
      soldListings: soldListings[0].count,
      totalGoldTraded: Number(totalGoldTraded[0].total ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get market stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/market/listings", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    const where = status ? eq(marketListingsTable.status, status as any) : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: marketListingsTable.id,
          itemName: marketListingsTable.itemName,
          itemType: marketListingsTable.itemType,
          sellerDiscordId: marketListingsTable.sellerDiscordId,
          price: marketListingsTable.price,
          quantity: marketListingsTable.quantity,
          status: marketListingsTable.status,
          createdAt: marketListingsTable.createdAt,
        })
        .from(marketListingsTable)
        .where(where)
        .orderBy(desc(marketListingsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(marketListingsTable).where(where),
    ]);

    const total = totalResult[0].count;
    res.json({
      data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get market listings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
