import { Router } from "express";
import { db } from "@workspace/db";
import { serverEventsTable, eventParticipantsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";

const router = Router();

router.get("/events", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const guildId = req.query.guildId as string | undefined;

    const where = guildId ? eq(serverEventsTable.guildServerId, guildId) : undefined;

    const [rows, totalResult] = await Promise.all([
      db.select().from(serverEventsTable).where(where).orderBy(desc(serverEventsTable.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(serverEventsTable).where(where),
    ]);

    const withCounts = await Promise.all(rows.map(async (ev) => {
      const [cnt] = await db.select({ c: count() }).from(eventParticipantsTable).where(eq(eventParticipantsTable.eventId, ev.id));
      return { ...ev, participantCount: cnt?.c ?? 0 };
    }));

    res.json({ data: withCounts, total: totalResult[0].count, page, totalPages: Math.ceil(totalResult[0].count / limit) });
  } catch (err) {
    req.log.error({ err }, "Failed to get events");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [ev] = await db.select().from(serverEventsTable).where(eq(serverEventsTable.id, id));
    if (!ev) { res.status(404).json({ error: "Event not found" }); return; }

    const participants = await db.select().from(eventParticipantsTable).where(eq(eventParticipantsTable.eventId, id));
    res.json({ ...ev, participants });
  } catch (err) {
    req.log.error({ err }, "Failed to get event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/events", async (req, res) => {
  try {
    const {
      name, description, type = "custom", guildServerId, organizerDiscordId = "dashboard",
      rewardGold = 0, rewardGems = 0, rewardXp = 0, bonusMultiplier = 1, maxParticipants = 50,
    } = req.body as Record<string, unknown>;

    if (!name || !description || !guildServerId) {
      res.status(400).json({ error: "name, description, guildServerId are required" });
      return;
    }

    const validTypes = ["boss_rush", "gold_rush", "xp_boost", "summon_rate_up", "pvp_tournament", "custom"];
    const safeType = validTypes.includes(String(type)) ? String(type) : "custom";

    const [ev] = await db.insert(serverEventsTable).values({
      name: String(name),
      description: String(description),
      type: safeType as "custom",
      guildServerId: String(guildServerId),
      organizerDiscordId: String(organizerDiscordId),
      rewardGold: Number(rewardGold) || 0,
      rewardGems: Number(rewardGems) || 0,
      rewardXp: Number(rewardXp) || 0,
      bonusMultiplier: Number(bonusMultiplier) || 1,
      maxParticipants: Number(maxParticipants) || 50,
      status: "upcoming",
    }).returning();

    res.json(ev);
  } catch (err) {
    req.log.error({ err }, "Failed to create event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/events/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { status } = req.body as { status: string };
    const validStatuses = ["upcoming", "active", "ended", "cancelled"];
    if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

    const extraFields = status === "ended" ? { endsAt: new Date() } : {};
    const [ev] = await db.update(serverEventsTable)
      .set({ status: status as "active", updatedAt: new Date(), ...extraFields })
      .where(eq(serverEventsTable.id, id))
      .returning();

    if (!ev) { res.status(404).json({ error: "Event not found" }); return; }
    res.json(ev);
  } catch (err) {
    req.log.error({ err }, "Failed to update event status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    await db.delete(eventParticipantsTable).where(eq(eventParticipantsTable.eventId, id));
    await db.delete(serverEventsTable).where(eq(serverEventsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete event");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
