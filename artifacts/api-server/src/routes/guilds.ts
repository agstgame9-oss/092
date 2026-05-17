import { Router } from "express";
import { db } from "@workspace/db";
import { guildsTable, guildMembersTable } from "@workspace/db";
import { eq, ilike, count, desc } from "drizzle-orm";

const router = Router();

router.get("/guilds", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = req.query.search as string | undefined;
    const offset = (page - 1) * limit;

    const where = search ? ilike(guildsTable.name, `%${search}%`) : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: guildsTable.id,
          name: guildsTable.name,
          tag: guildsTable.tag,
          emblem: guildsTable.emblem,
          level: guildsTable.level,
          treasury: guildsTable.treasury,
          maxMembers: guildsTable.maxMembers,
          totalWins: guildsTable.totalWins,
          totalBossKills: guildsTable.totalBossKills,
          isOpen: guildsTable.isOpen,
          createdAt: guildsTable.createdAt,
          memberCount: count(guildMembersTable.id),
        })
        .from(guildsTable)
        .leftJoin(guildMembersTable, eq(guildMembersTable.guildId, guildsTable.id))
        .where(where)
        .groupBy(guildsTable.id)
        .orderBy(desc(guildsTable.level))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(guildsTable).where(where),
    ]);

    const total = totalResult[0].count;
    res.json({
      data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get guilds");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/guilds/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [guild] = await db
      .select({
        id: guildsTable.id,
        name: guildsTable.name,
        tag: guildsTable.tag,
        emblem: guildsTable.emblem,
        level: guildsTable.level,
        treasury: guildsTable.treasury,
        maxMembers: guildsTable.maxMembers,
        totalWins: guildsTable.totalWins,
        totalBossKills: guildsTable.totalBossKills,
        isOpen: guildsTable.isOpen,
        createdAt: guildsTable.createdAt,
        memberCount: count(guildMembersTable.id),
      })
      .from(guildsTable)
      .leftJoin(guildMembersTable, eq(guildMembersTable.guildId, guildsTable.id))
      .where(eq(guildsTable.id, id))
      .groupBy(guildsTable.id);

    if (!guild) { res.status(404).json({ error: "Guild not found" }); return; }

    const members = await db
      .select({
        discordId: guildMembersTable.discordId,
        username: guildMembersTable.username,
        role: guildMembersTable.role,
        contribution: guildMembersTable.contribution,
        joinedAt: guildMembersTable.joinedAt,
      })
      .from(guildMembersTable)
      .where(eq(guildMembersTable.guildId, id))
      .orderBy(desc(guildMembersTable.contribution));

    res.json({
      guild: { ...guild, createdAt: guild.createdAt.toISOString() },
      members: members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get guild");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
