import { Router } from "express";
import { db } from "@workspace/db";
import { adminLogsTable, playersTable, charactersTable, playerCharactersTable, itemsTable, inventoryTable } from "@workspace/db";
import { count, desc, eq } from "drizzle-orm";

const router = Router();

// ── Audit Logs ────────────────────────────────────────────────────────────────

router.get("/admin/logs", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const [rows, totalResult] = await Promise.all([
      db.select().from(adminLogsTable).orderBy(desc(adminLogsTable.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(adminLogsTable),
    ]);

    const total = totalResult[0].count;
    res.json({
      data: rows.map((r) => ({
        id: String(r.id),
        adminId: r.adminDiscordId,
        adminUsername: r.adminUsername,
        action: r.action,
        targetType: r.targetDiscordId ? "player" : undefined,
        targetId: r.targetDiscordId ?? undefined,
        targetUsername: r.targetUsername ?? undefined,
        details: r.details ?? undefined,
        reason: r.reason ?? undefined,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Broadcast ─────────────────────────────────────────────────────────────────

router.post("/admin/broadcast", async (req, res) => {
  try {
    const { message, type } = req.body as { message: string; type?: string };
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: `broadcast:${type ?? "general"}`,
      details: message,
      reason: message,
    });
    req.log.info({ message, type }, "Broadcast announcement sent");
    res.json({ success: true, message: "Announcement broadcast successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to broadcast announcement");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Give Resources to Player ──────────────────────────────────────────────────

router.post("/admin/players/:discordId/give", async (req, res) => {
  try {
    const { discordId } = req.params;
    const { type, amount } = req.body as { type: "gold" | "gems" | "xp" | "stamina"; amount: number };

    if (!["gold", "gems", "xp", "stamina"].includes(type)) {
      res.status(400).json({ error: "Invalid type. Use: gold, gems, xp, stamina" });
      return;
    }
    if (!amount || amount <= 0 || isNaN(amount)) {
      res.status(400).json({ error: "Amount must be a positive number" });
      return;
    }

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) {
      res.status(404).json({ error: "Player not found" });
      return;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (type === "gold") updateData.gold = player.gold + amount;
    if (type === "gems") updateData.gems = player.gems + amount;
    if (type === "stamina") updateData.stamina = Math.min(player.maxStamina, player.stamina + amount);
    if (type === "xp") {
      const newXp = player.xp + amount;
      if (newXp >= player.xpToNext) {
        updateData.level = player.level + 1;
        updateData.xp = newXp - player.xpToNext;
        updateData.xpToNext = Math.floor(player.xpToNext * 1.15);
      } else {
        updateData.xp = newXp;
      }
    }

    const [updated] = await db.update(playersTable).set(updateData).where(eq(playersTable.discordId, discordId)).returning();
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard", adminUsername: "Dashboard Admin", guildServerId: "dashboard",
      action: `give_${type}`, targetDiscordId: discordId, targetUsername: player.username, details: `+${amount} ${type}`,
    }).catch(() => null);

    res.json({ success: true, player: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to give resources");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Ban Player ────────────────────────────────────────────────────────────────

router.post("/admin/players/:discordId/ban", async (req, res) => {
  try {
    const { discordId } = req.params;
    const { reason = "No reason given" } = req.body as { reason?: string };

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }
    if (player.isBanned) { res.status(400).json({ error: "Player is already banned" }); return; }

    await db.update(playersTable).set({ isBanned: true, banReason: reason, updatedAt: new Date() }).where(eq(playersTable.discordId, discordId));
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard", adminUsername: "Dashboard Admin", guildServerId: "dashboard",
      action: "ban", targetDiscordId: discordId, targetUsername: player.username, reason,
    }).catch(() => null);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to ban player");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Unban Player ──────────────────────────────────────────────────────────────

router.post("/admin/players/:discordId/unban", async (req, res) => {
  try {
    const { discordId } = req.params;
    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }
    if (!player.isBanned) { res.status(400).json({ error: "Player is not banned" }); return; }

    await db.update(playersTable).set({ isBanned: false, banReason: null, updatedAt: new Date() }).where(eq(playersTable.discordId, discordId));
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard", adminUsername: "Dashboard Admin", guildServerId: "dashboard",
      action: "unban", targetDiscordId: discordId, targetUsername: player.username,
    }).catch(() => null);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to unban player");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Reset Player ──────────────────────────────────────────────────────────────

router.post("/admin/players/:discordId/reset", async (req, res) => {
  try {
    const { discordId } = req.params;
    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    await db.update(playersTable).set({
      level: 1, xp: 0, xpToNext: 100, gold: 1000, gems: 20,
      stamina: 100, maxStamina: 100, currentFloor: 0, maxAbyssFloor: 0,
      wins: 0, losses: 0, totalDamageDealt: 0, pvpRating: 1000, furyMeter: 0, updatedAt: new Date(),
    }).where(eq(playersTable.discordId, discordId));

    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard", adminUsername: "Dashboard Admin", guildServerId: "dashboard",
      action: "reset_player", targetDiscordId: discordId, targetUsername: player.username, details: "Full stat reset",
    }).catch(() => null);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reset player");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Give Character to Player ──────────────────────────────────────────────────

router.post("/admin/players/:discordId/give-character", async (req, res) => {
  try {
    const { discordId } = req.params;
    const { characterId } = req.body as { characterId: number };

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const [char] = await db.select().from(charactersTable).where(eq(charactersTable.id, characterId));
    if (!char) { res.status(404).json({ error: "Character not found" }); return; }

    const existing = await db.select().from(playerCharactersTable).where(eq(playerCharactersTable.playerId, player.id));
    const alreadyOwns = existing.find(pc => pc.characterId === characterId);

    if (alreadyOwns) {
      await db.update(playerCharactersTable).set({ copies: alreadyOwns.copies + 1 }).where(eq(playerCharactersTable.id, alreadyOwns.id));
    } else {
      await db.insert(playerCharactersTable).values({ playerId: player.id, characterId, level: 1, ascension: 0, copies: 1, isOnParty: false });
    }

    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard", adminUsername: "Dashboard Admin", guildServerId: "dashboard",
      action: "give_character", targetDiscordId: discordId, targetUsername: player.username, details: char.name,
    }).catch(() => null);

    res.json({ success: true, character: char.name, alreadyOwned: !!alreadyOwns });
  } catch (err) {
    req.log.error({ err }, "Failed to give character");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Give Item to Player ───────────────────────────────────────────────────────

router.post("/admin/players/:discordId/give-item", async (req, res) => {
  try {
    const { discordId } = req.params;
    const { itemId, quantity = 1 } = req.body as { itemId: number; quantity?: number };

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const [item] = await db.select().from(itemsTable).where(eq(itemsTable.id, itemId));
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    const [existingInv] = await db.select().from(inventoryTable)
      .where(eq(inventoryTable.discordId, discordId));

    if (existingInv && existingInv.itemId === itemId) {
      await db.update(inventoryTable).set({ quantity: existingInv.quantity + quantity, updatedAt: new Date() }).where(eq(inventoryTable.id, existingInv.id));
    } else {
      await db.insert(inventoryTable).values({ discordId, itemId, quantity });
    }

    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard", adminUsername: "Dashboard Admin", guildServerId: "dashboard",
      action: "give_item", targetDiscordId: discordId, targetUsername: player.username, details: `${item.name} x${quantity}`,
    }).catch(() => null);

    res.json({ success: true, item: item.name });
  } catch (err) {
    req.log.error({ err }, "Failed to give item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
