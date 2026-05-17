import { Router } from "express";
import { db } from "@workspace/db";
import {
  charactersTable,
  bossesTable,
  itemsTable,
  serverConfigTable,
  playersTable,
  adminLogsTable,
  gachaBannersTable,
  gamePatchesTable,
} from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";

const router = Router();

const BOT_WEBHOOK_URL = `http://127.0.0.1:${process.env.BOT_WEBHOOK_PORT ?? "9001"}`;
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET ?? "ama-internal-secret-2024";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// ─────────────────────────────────────────────
// CHARACTERS
// ─────────────────────────────────────────────

router.get("/update-maker/characters", async (req, res) => {
  try {
    const rows = await db.select().from(charactersTable).orderBy(asc(charactersTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get characters");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update-maker/characters", async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db.insert(charactersTable).values(body).returning();
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: "character:create",
      // targetType: "character",
      // targetId: String(created.id),
      details: JSON.stringify({ name: body.name }),
    });
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create character");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/update-maker/characters/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db.update(charactersTable).set(body).where(eq(charactersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Character not found" }); return; }
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: "character:update",
      // targetType: "character",
      // targetId: String(id),
      details: JSON.stringify({ name: updated.name }),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update character");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/update-maker/characters/:id/toggle", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [char] = await db.select().from(charactersTable).where(eq(charactersTable.id, id));
    if (!char) { res.status(404).json({ error: "Character not found" }); return; }
    const [updated] = await db
      .update(charactersTable)
      .set({ isEnabled: !char.isEnabled })
      .where(eq(charactersTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to toggle character");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/update-maker/characters/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(charactersTable).where(eq(charactersTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Character not found" }); return; }
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: "character:delete",
      // targetType: "character",
      // targetId: String(id),
      details: JSON.stringify({ name: deleted.name }),
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete character");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// BOSSES
// ─────────────────────────────────────────────

router.get("/update-maker/bosses", async (req, res) => {
  try {
    const rows = await db.select().from(bossesTable).orderBy(asc(bossesTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get bosses");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update-maker/bosses", async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db.insert(bossesTable).values(body).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create boss");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/update-maker/bosses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db.update(bossesTable).set(body).where(eq(bossesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Boss not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update boss");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/update-maker/bosses/:id/toggle", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [boss] = await db.select().from(bossesTable).where(eq(bossesTable.id, id));
    if (!boss) { res.status(404).json({ error: "Boss not found" }); return; }
    const [updated] = await db
      .update(bossesTable)
      .set({ isEnabled: !boss.isEnabled })
      .where(eq(bossesTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to toggle boss");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/update-maker/bosses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(bossesTable).where(eq(bossesTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Boss not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete boss");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────

router.get("/update-maker/items", async (req, res) => {
  try {
    const rows = await db.select().from(itemsTable).orderBy(asc(itemsTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update-maker/items", async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db.insert(itemsTable).values(body).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/update-maker/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db.update(itemsTable).set(body).where(eq(itemsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Item not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/update-maker/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(itemsTable).where(eq(itemsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Item not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete item");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// ECONOMY / SERVER CONFIGS
// ─────────────────────────────────────────────

router.get("/update-maker/economy", async (req, res) => {
  try {
    const rows = await db.select().from(serverConfigTable).orderBy(asc(serverConfigTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get server configs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/update-maker/economy/:guildId", async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const { settings } = req.body as { settings: Record<string, unknown> };
    const [row] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, guildId));
    if (!row) { res.status(404).json({ error: "Server config not found" }); return; }
    const merged = { ...(row.settings as object), ...settings };
    const [updated] = await db
      .update(serverConfigTable)
      .set({ settings: merged as typeof row.settings, updatedAt: new Date() })
      .where(eq(serverConfigTable.guildId, guildId))
      .returning();
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: "economy:update",
      // targetType: "server",
      // targetId: guildId,
      details: JSON.stringify(settings),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update economy");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update-maker/economy/apply-all", async (req, res) => {
  try {
    const { settings } = req.body as { settings: Record<string, unknown> };
    const allConfigs = await db.select().from(serverConfigTable);
    for (const config of allConfigs) {
      const merged = { ...(config.settings as object), ...settings };
      await db
        .update(serverConfigTable)
        .set({ settings: merged as typeof config.settings, updatedAt: new Date() })
        .where(eq(serverConfigTable.guildId, config.guildId));
    }
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: "economy:apply-all",
      // targetType: "global",
      // targetId: "all",
      details: JSON.stringify(settings),
    });
    res.json({ success: true, updatedCount: allConfigs.length });
  } catch (err) {
    req.log.error({ err }, "Failed to apply global economy");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// REWARDS
// ─────────────────────────────────────────────

router.post("/update-maker/rewards", async (req, res) => {
  try {
    const { discordId, gold, gems, xp, stamina, reason } = req.body as {
      discordId: string;
      gold?: number;
      gems?: number;
      xp?: number;
      stamina?: number;
      reason?: string;
    };

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const update: Partial<typeof player> = {};
    if (gold) update.gold = player.gold + gold;
    if (gems) update.gems = player.gems + gems;
    if (xp) update.xp = player.xp + xp;
    if (stamina) update.stamina = Math.min(player.stamina + (stamina ?? 0), player.maxStamina);

    const [updated] = await db
      .update(playersTable)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(playersTable.discordId, discordId))
      .returning();

    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: "reward:give",
      // targetType: "player",
      // targetId: discordId,
      details: JSON.stringify({ gold, gems, xp, stamina, reason }),
    });

    res.json({
      success: true,
      player: {
        discordId: updated.discordId,
        username: updated.username,
        gold: updated.gold,
        gems: updated.gems,
        xp: updated.xp,
        stamina: updated.stamina,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to give reward");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/update-maker/players/search", async (req, res) => {
  try {
    const query = String(req.query.q ?? "").trim();
    if (!query) { res.json([]); return; }
    const { ilike, or } = await import("drizzle-orm");
    const rows = await db
      .select({
        discordId: playersTable.discordId,
        username: playersTable.username,
        level: playersTable.level,
        gold: playersTable.gold,
        gems: playersTable.gems,
        xp: playersTable.xp,
        stamina: playersTable.stamina,
        maxStamina: playersTable.maxStamina,
        isBanned: playersTable.isBanned,
      })
      .from(playersTable)
      .where(or(ilike(playersTable.username, `%${query}%`), eq(playersTable.discordId, query)))
      .limit(10);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to search players");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// GACHA BANNERS
// ─────────────────────────────────────────────

router.get("/update-maker/banners", async (req, res) => {
  try {
    const rows = await db.select().from(gachaBannersTable).orderBy(desc(gachaBannersTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get banners");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update-maker/banners", async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db.insert(gachaBannersTable).values({
      ...body,
      updatedAt: new Date(),
    }).returning();
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: "banner:create",
      // targetType: "banner",
      // targetId: String(created.id),
      details: JSON.stringify({ name: body.name }),
    });
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create banner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/update-maker/banners/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db
      .update(gachaBannersTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(gachaBannersTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Banner not found" }); return; }
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: "banner:update",
      // targetType: "banner",
      // targetId: String(id),
      details: JSON.stringify({ name: updated.name }),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update banner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/update-maker/banners/:id/toggle", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [banner] = await db.select().from(gachaBannersTable).where(eq(gachaBannersTable.id, id));
    if (!banner) { res.status(404).json({ error: "Banner not found" }); return; }
    const [updated] = await db
      .update(gachaBannersTable)
      .set({ isActive: !banner.isActive, updatedAt: new Date() })
      .where(eq(gachaBannersTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to toggle banner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/update-maker/banners/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(gachaBannersTable).where(eq(gachaBannersTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Banner not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete banner");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// GLOBAL SYSTEM TOGGLES
// ─────────────────────────────────────────────

const GLOBAL_GUILD_ID = "__global__";

async function getOrCreateGlobalConfig() {
  const [existing] = await db
    .select()
    .from(serverConfigTable)
    .where(eq(serverConfigTable.guildId, GLOBAL_GUILD_ID));

  if (existing) return existing;

  const [created] = await db
    .insert(serverConfigTable)
    .values({
      guildId: GLOBAL_GUILD_ID,
      guildName: "Global Settings",
      isSetup: true,
      settings: {
        allowPvp: true,
        allowMarket: true,
        allowGuilds: true,
        allowTournaments: true,
        allowWorldBoss: true,
        allowStocks: true,
        xpMultiplier: 1,
        goldMultiplier: 1,
        staminaRegenRate: 6,
      },
    })
    .returning();

  return created;
}

router.get("/update-maker/toggles", async (req, res) => {
  try {
    const config = await getOrCreateGlobalConfig();
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Failed to get global toggles");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/update-maker/toggles", async (req, res) => {
  try {
    const config = await getOrCreateGlobalConfig();
    const newSettings = req.body as Record<string, unknown>;
    const merged = { ...(config.settings as object), ...newSettings };
    const [updated] = await db
      .update(serverConfigTable)
      .set({ settings: merged as typeof config.settings, updatedAt: new Date() })
      .where(eq(serverConfigTable.guildId, GLOBAL_GUILD_ID))
      .returning();
    await db.insert(adminLogsTable).values({
      adminDiscordId: "dashboard",
      adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
      action: "toggles:update",
      // targetType: "global",
      // targetId: "system",
      details: JSON.stringify(newSettings),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update global toggles");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// PATCH HISTORY
// ─────────────────────────────────────────────

router.get("/update-maker/patches", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(gamePatchesTable)
      .orderBy(desc(gamePatchesTable.publishedAt))
      .limit(20);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get patches");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// PUBLISH UPDATE (Hot-Reload + Discord Embed)
// ─────────────────────────────────────────────

router.post("/update-maker/publish", async (req, res) => {
  const {
    version,
    title,
    changelog,
    discordChannelId,
  } = req.body as {
    version: string;
    title: string;
    changelog: {
      newCharacters: string[];
      balanceChanges: string[];
      newBanners: string[];
      systemChanges: string[];
      bugFixes: string[];
      other: string[];
    };
    discordChannelId?: string;
  };

  if (!version || !title) {
    res.status(400).json({ error: "version and title are required" });
    return;
  }

  let botReloaded = false;
  let discordNotified = false;
  let discordMessageId: string | undefined;

  // 1. Save patch record
  const [patch] = await db
    .insert(gamePatchesTable)
    .values({
      version,
      title,
      changelog,
      discordChannelId: discordChannelId ?? null,
      publishedBy: "dashboard",
    })
    .returning();

  // 2. Trigger bot hot-reload
  try {
    const reloadRes = await fetch(`${BOT_WEBHOOK_URL}/reload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": BOT_WEBHOOK_SECRET,
      },
      body: JSON.stringify({ reason: `Patch ${version}: ${title}`, patchId: patch.id }),
      signal: AbortSignal.timeout(5000),
    });
    botReloaded = reloadRes.ok;
  } catch (err) {
    req.log.warn({ err }, "Bot webhook unreachable — bot may not be running");
  }

  // 3. Send Discord embed to patch channel
  if (discordChannelId && DISCORD_TOKEN) {
    try {
      const fields: { name: string; value: string; inline?: boolean }[] = [];

      const sections: { key: keyof typeof changelog; label: string; emoji: string }[] = [
        { key: "newCharacters",  label: "New Characters",   emoji: "🌟" },
        { key: "balanceChanges", label: "Balance Changes",  emoji: "⚔️" },
        { key: "newBanners",     label: "New Banners",      emoji: "🎰" },
        { key: "systemChanges",  label: "System Changes",   emoji: "⚙️" },
        { key: "bugFixes",       label: "Bug Fixes",        emoji: "🐛" },
        { key: "other",          label: "Other",            emoji: "📝" },
      ];

      for (const { key, label, emoji } of sections) {
        const items = changelog[key];
        if (items && items.length > 0) {
          fields.push({
            name: `${emoji} ${label}`,
            value: items.map((i) => `• ${i}`).join("\n"),
          });
        }
      }

      const embed = {
        title: `🎮 ${title}`,
        description: `**Version ${version}** — Anime Multiverse Arena`,
        color: 0x7c3aed,
        fields,
        footer: { text: `Published by AMA Dashboard • ${new Date().toUTCString()}` },
        timestamp: new Date().toISOString(),
      };

      const discordRes = await fetch(
        `https://discord.com/api/v10/channels/${discordChannelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ embeds: [embed] }),
          signal: AbortSignal.timeout(8000),
        }
      );

      if (discordRes.ok) {
        const msg = await discordRes.json() as { id: string };
        discordMessageId = msg.id;
        discordNotified = true;
      } else {
        const errBody = await discordRes.text();
        req.log.warn({ status: discordRes.status, body: errBody }, "Discord API returned error");
      }
    } catch (err) {
      req.log.warn({ err }, "Failed to send Discord patch notes");
    }
  }

  // 4. Update patch record with results
  const [finalPatch] = await db
    .update(gamePatchesTable)
    .set({ botReloaded, discordNotified, discordMessageId: discordMessageId ?? null })
    .where(eq(gamePatchesTable.id, patch.id))
    .returning();

  await db.insert(adminLogsTable).values({
    adminDiscordId: "dashboard",
    adminUsername: "Dashboard Admin",
      guildServerId: "dashboard",
    action: "patch:publish",
    // targetType: "patch",
    // targetId: String(patch.id),
    details: JSON.stringify({ version, title, botReloaded, discordNotified }),
  });

  res.json({
    success: true,
    patch: finalPatch,
    botReloaded,
    discordNotified,
  });
});

// ─────────────────────────────────────────────
// SERVER COUNT (how many have announcement channels)
// ─────────────────────────────────────────────

router.get("/update-maker/server-count", async (req, res) => {
  try {
    const servers = await db.select().from(serverConfigTable);
    const total = servers.filter((s: typeof servers[0]) => s.guildId !== "__global__").length;
    const withChannel = servers.filter((s: typeof servers[0]) => s.guildId !== "__global__" && s.announcementChannelId).length;
    res.json({ total, withChannel });
  } catch (err) {
    req.log.error({ err }, "Failed to get server count");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// BROADCAST TO ALL SERVERS
// ─────────────────────────────────────────────

router.post("/update-maker/broadcast-all", async (req, res) => {
  const {
    version,
    title,
    changelog,
    extraMessage,
    pingEveryone,
  } = req.body as {
    version: string;
    title: string;
    changelog: {
      newCharacters: string[];
      balanceChanges: string[];
      newBanners: string[];
      systemChanges: string[];
      bugFixes: string[];
      other: string[];
    };
    extraMessage?: string;
    pingEveryone?: boolean;
  };

  if (!version || !title) {
    res.status(400).json({ error: "version and title are required" });
    return;
  }

  if (!DISCORD_TOKEN) {
    res.status(400).json({ error: "DISCORD_TOKEN not configured on the server" });
    return;
  }

  const servers = await db.select().from(serverConfigTable);
  const targets = servers.filter((s: typeof servers[0]) => s.guildId !== "__global__" && s.announcementChannelId);

  if (targets.length === 0) {
    res.json({ success: true, totalServers: 0, successCount: 0, failCount: 0, results: [], patchId: null });
    return;
  }

  const fields: { name: string; value: string }[] = [];
  const sections: { key: keyof typeof changelog; label: string }[] = [
    { key: "newCharacters",  label: "🌟 New Characters"  },
    { key: "balanceChanges", label: "⚔️ Balance Changes"  },
    { key: "newBanners",     label: "🎰 New Banners"      },
    { key: "systemChanges",  label: "⚙️ System Changes"   },
    { key: "bugFixes",       label: "🐛 Bug Fixes"        },
    { key: "other",          label: "📝 Other"            },
  ];
  for (const { key, label } of sections) {
    const items = changelog[key];
    if (items && items.length > 0) {
      fields.push({ name: label, value: items.map(i => `• ${i}`).join("\n") });
    }
  }

  const totalChanges = Object.values(changelog).flat().length;

  const embed = {
    title: `🎮 ${title}`,
    description: [
      `**Version ${version}** — Anime Multiverse Arena`,
      extraMessage ? `\n${extraMessage}` : "",
    ].join(""),
    color: 0x7c3aed,
    fields,
    footer: { text: `Anime Multiverse Arena Update • ${new Date().toUTCString()}` },
    timestamp: new Date().toISOString(),
  };

  // Save patch record
  const [patch] = await db
    .insert(gamePatchesTable)
    .values({
      version,
      title,
      changelog,
      publishedBy: "dashboard-broadcast-all",
    })
    .returning();

  // Trigger bot hot-reload
  try {
    await fetch(`${BOT_WEBHOOK_URL}/reload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": BOT_WEBHOOK_SECRET },
      body: JSON.stringify({ reason: `Broadcast ${version}: ${title}`, patchId: patch.id }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* bot may be offline */ }

  // Broadcast to every server's announcement channel
  const results: { guildId: string; guildName: string | null; success: boolean; error?: string }[] = [];

  for (const server of targets) {
    try {
      const content = pingEveryone ? "@everyone 📣 **New Game Update!**" : "📣 **New Game Update!**";
      const discordRes = await fetch(
        `https://discord.com/api/v10/channels/${server.announcementChannelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content, embeds: [embed] }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (discordRes.ok) {
        results.push({ guildId: server.guildId, guildName: server.guildName, success: true });
      } else {
        const body = await discordRes.text().catch(() => "");
        results.push({ guildId: server.guildId, guildName: server.guildName, success: false, error: `HTTP ${discordRes.status}` });
        req.log.warn({ status: discordRes.status, body }, `Discord send failed for guild ${server.guildId}`);
      }
    } catch (err) {
      results.push({ guildId: server.guildId, guildName: server.guildName, success: false, error: String(err) });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  await db
    .update(gamePatchesTable)
    .set({ discordNotified: successCount > 0 })
    .where(eq(gamePatchesTable.id, patch.id));

  await db.insert(adminLogsTable).values({
    adminDiscordId: "dashboard",
    adminUsername: "Dashboard Admin",
    guildServerId: "dashboard",
    action: "broadcast:all",
    details: JSON.stringify({ version, title, totalChanges, successCount, failCount, totalServers: targets.length }),
  });

  res.json({
    success: true,
    patchId: patch.id,
    totalServers: targets.length,
    successCount,
    failCount,
    results,
  });
});

// ─────────────────────────────────────────────
// MASS REWARD TO ALL PLAYERS
// ─────────────────────────────────────────────

router.post("/update-maker/rewards/mass", async (req, res) => {
  const { gold, gems, xp, stamina, reason } = req.body as {
    gold?: number;
    gems?: number;
    xp?: number;
    stamina?: number;
    reason?: string;
  };

  if (!gold && !gems && !xp && !stamina) {
    res.status(400).json({ error: "Provide at least one reward (gold, gems, xp, or stamina)" });
    return;
  }

  const { sql: drizzleSql } = await import("drizzle-orm");

  const allPlayers = await db
    .select({
      discordId: playersTable.discordId,
      gold: playersTable.gold,
      gems: playersTable.gems,
      xp: playersTable.xp,
      stamina: playersTable.stamina,
      maxStamina: playersTable.maxStamina,
    })
    .from(playersTable)
    .where(eq(playersTable.isBanned, false));

  if (allPlayers.length === 0) {
    res.json({ success: true, playersRewarded: 0 });
    return;
  }

  for (const player of allPlayers) {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (gold) update.gold = player.gold + gold;
    if (gems) update.gems = player.gems + gems;
    if (xp) update.xp = player.xp + xp;
    if (stamina) update.stamina = Math.min(player.stamina + stamina, player.maxStamina);
    await db.update(playersTable).set(update).where(eq(playersTable.discordId, player.discordId));
  }

  await db.insert(adminLogsTable).values({
    adminDiscordId: "dashboard",
    adminUsername: "Dashboard Admin",
    guildServerId: "dashboard",
    action: "reward:mass",
    details: JSON.stringify({ gold, gems, xp, stamina, reason, playerCount: allPlayers.length }),
  });

  res.json({ success: true, playersRewarded: allPlayers.length });
});

export default router;
