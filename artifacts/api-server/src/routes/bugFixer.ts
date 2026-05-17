import { Router } from "express";
import { db } from "@workspace/db";
import {
  playersTable,
  playerCharactersTable,
  guildMembersTable,
  guildsTable,
  cooldownsTable,
  battlesTable,
  playerAchievementsTable,
} from "@workspace/db";
import { eq, lt, sql, and, isNull, ne } from "drizzle-orm";

const router = Router();

export interface BugIssue {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  count: number;
  fixable: boolean;
  fixEndpoint?: string;
}

// ── GET /api/bug-fixer/scan ─────────────────────────────────────────────────
router.get("/bug-fixer/scan", async (req, res) => {
  const issues: BugIssue[] = [];

  try {
    // 1. Players with negative gold
    const negGold = await db.select({ count: sql<number>`count(*)::int` })
      .from(playersTable).where(lt(playersTable.gold, 0));
    if ((negGold[0]?.count ?? 0) > 0) {
      issues.push({
        id: "neg_gold",
        category: "اللاعبون",
        severity: "high",
        title: "لاعبون برصيد ذهب سالب",
        description: "لاعبون لديهم قيمة ذهب أقل من صفر، مما قد يتسبب في أخطاء في العمليات.",
        count: negGold[0].count,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/neg-gold",
      });
    }

    // 2. Players with negative gems
    const negGems = await db.select({ count: sql<number>`count(*)::int` })
      .from(playersTable).where(lt(playersTable.gems, 0));
    if ((negGems[0]?.count ?? 0) > 0) {
      issues.push({
        id: "neg_gems",
        category: "اللاعبون",
        severity: "high",
        title: "لاعبون برصيد جواهر سالب",
        description: "لاعبون لديهم قيمة جواهر أقل من صفر.",
        count: negGems[0].count,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/neg-gems",
      });
    }

    // 3. Players with negative stamina
    const negStamina = await db.select({ count: sql<number>`count(*)::int` })
      .from(playersTable).where(lt(playersTable.stamina, 0));
    if ((negStamina[0]?.count ?? 0) > 0) {
      issues.push({
        id: "neg_stamina",
        category: "اللاعبون",
        severity: "medium",
        title: "لاعبون بطاقة سالبة",
        description: "لاعبون لديهم قيمة طاقة أقل من صفر.",
        count: negStamina[0].count,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/neg-stamina",
      });
    }

    // 4. Expired cooldowns still in DB
    const expiredCds = await db.select({ count: sql<number>`count(*)::int` })
      .from(cooldownsTable).where(lt(cooldownsTable.expiresAt, new Date()));
    if ((expiredCds[0]?.count ?? 0) > 100) {
      issues.push({
        id: "expired_cooldowns",
        category: "قاعدة البيانات",
        severity: "low",
        title: "cooldowns منتهية الصلاحية",
        description: `${expiredCds[0].count} سجل cooldown منتهي الصلاحية يأخذ مساحة غير ضرورية.`,
        count: expiredCds[0].count,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/expired-cooldowns",
      });
    }

    // 5. Guild members referencing non-existent guilds
    const orphanGuildMembers = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM guild_members gm
      LEFT JOIN guilds g ON g.id = gm.guild_id
      WHERE g.id IS NULL
    `);
    const orphanGmCount = (orphanGuildMembers.rows[0] as { count: number })?.count ?? 0;
    if (orphanGmCount > 0) {
      issues.push({
        id: "orphan_guild_members",
        category: "النقابات",
        severity: "high",
        title: "أعضاء نقابة يتيمون",
        description: "أعضاء نقابة لا تنتمي نقاباتهم لسجلات موجودة.",
        count: orphanGmCount,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/orphan-guild-members",
      });
    }

    // 6. Players with guildMemberId but not in guild_members
    const mismatchedGuild = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM players p
      WHERE p.guild_member_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM guild_members gm WHERE gm.id = p.guild_member_id)
    `);
    const mismatchCount = (mismatchedGuild.rows[0] as { count: number })?.count ?? 0;
    if (mismatchCount > 0) {
      issues.push({
        id: "mismatched_guild_ref",
        category: "النقابات",
        severity: "medium",
        title: "مراجع نقابة غير صحيحة في اللاعبين",
        description: "لاعبون لديهم guild_member_id لكن لا يوجد سجل مطابق في جدول الأعضاء.",
        count: mismatchCount,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/mismatched-guild-ref",
      });
    }

    // 7. Stuck battles (active battles older than 1 hour)
    const stuckBattles = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM battles
      WHERE status = 'active'
      AND created_at < NOW() - INTERVAL '1 hour'
    `);
    const stuckCount = (stuckBattles.rows[0] as { count: number })?.count ?? 0;
    if (stuckCount > 0) {
      issues.push({
        id: "stuck_battles",
        category: "المعارك",
        severity: "medium",
        title: "معارك عالقة",
        description: "معارك في حالة 'نشطة' منذ أكثر من ساعة — على الأرجح خطأ لم يُكتمل.",
        count: stuckCount,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/stuck-battles",
      });
    }

    // 8. Player characters with invalid party references
    const invalidParty = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM players p
      WHERE jsonb_array_length(p.active_party) > 0
      AND NOT EXISTS (
        SELECT 1 FROM player_characters pc
        WHERE pc.player_id = p.id AND pc.is_on_party = true
      )
    `);
    const invPartyCount = (invalidParty.rows[0] as { count: number })?.count ?? 0;
    if (invPartyCount > 0) {
      issues.push({
        id: "invalid_party",
        category: "اللاعبون",
        severity: "medium",
        title: "مؤشرات فريق غير متزامنة",
        description: "لاعبون لديهم active_party غير فارغة لكن لا توجد شخصيات مُعيَّنة للفريق.",
        count: invPartyCount,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/invalid-party",
      });
    }

    // 9. Players with stamina > maxStamina
    const overStamina = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM players
      WHERE stamina > max_stamina
    `);
    const overSCount = (overStamina.rows[0] as { count: number })?.count ?? 0;
    if (overSCount > 0) {
      issues.push({
        id: "over_stamina",
        category: "اللاعبون",
        severity: "low",
        title: "طاقة تتجاوز الحد الأقصى",
        description: "لاعبون لديهم طاقة أعلى من الحد الأقصى المسموح به.",
        count: overSCount,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/over-stamina",
      });
    }

    // 10. Duplicate player achievements
    const dupAchs = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM (
        SELECT discord_id, achievement_key, COUNT(*) as c
        FROM player_achievements
        GROUP BY discord_id, achievement_key
        HAVING COUNT(*) > 1
      ) dups
    `);
    const dupAchCount = (dupAchs.rows[0] as { count: number })?.count ?? 0;
    if (dupAchCount > 0) {
      issues.push({
        id: "dup_achievements",
        category: "الإنجازات",
        severity: "medium",
        title: "إنجازات مكررة",
        description: "لاعبون لديهم نفس الإنجاز مسجلاً أكثر من مرة.",
        count: dupAchCount,
        fixable: true,
        fixEndpoint: "/api/bug-fixer/fix/dup-achievements",
      });
    }

    res.json({
      scannedAt: new Date().toISOString(),
      totalIssues: issues.length,
      issues,
    });
  } catch (err) {
    res.status(500).json({ error: "Scan failed", details: String(err) });
  }
});

// ── POST fix endpoints ──────────────────────────────────────────────────────

router.post("/bug-fixer/fix/neg-gold", async (_req, res) => {
  const result = await db.update(playersTable).set({ gold: 0 }).where(lt(playersTable.gold, 0)).returning({ id: playersTable.id });
  res.json({ fixed: result.length, message: `تم إصلاح ${result.length} لاعب برصيد ذهب سالب.` });
});

router.post("/bug-fixer/fix/neg-gems", async (_req, res) => {
  const result = await db.update(playersTable).set({ gems: 0 }).where(lt(playersTable.gems, 0)).returning({ id: playersTable.id });
  res.json({ fixed: result.length, message: `تم إصلاح ${result.length} لاعب برصيد جواهر سالب.` });
});

router.post("/bug-fixer/fix/neg-stamina", async (_req, res) => {
  const result = await db.update(playersTable).set({ stamina: 0 }).where(lt(playersTable.stamina, 0)).returning({ id: playersTable.id });
  res.json({ fixed: result.length, message: `تم إصلاح ${result.length} لاعب بطاقة سالبة.` });
});

router.post("/bug-fixer/fix/over-stamina", async (_req, res) => {
  await db.execute(sql`
    UPDATE players SET stamina = max_stamina WHERE stamina > max_stamina
  `);
  res.json({ fixed: true, message: "تم تصحيح جميع قيم الطاقة التي تتجاوز الحد الأقصى." });
});

router.post("/bug-fixer/fix/expired-cooldowns", async (_req, res) => {
  const result = await db.delete(cooldownsTable).where(lt(cooldownsTable.expiresAt, new Date())).returning({ id: cooldownsTable.id });
  res.json({ fixed: result.length, message: `تم حذف ${result.length} سجل cooldown منتهي الصلاحية.` });
});

router.post("/bug-fixer/fix/orphan-guild-members", async (_req, res) => {
  await db.execute(sql`
    DELETE FROM guild_members gm
    WHERE NOT EXISTS (SELECT 1 FROM guilds g WHERE g.id = gm.guild_id)
  `);
  res.json({ fixed: true, message: "تم حذف جميع أعضاء النقابة اليتيمين." });
});

router.post("/bug-fixer/fix/mismatched-guild-ref", async (_req, res) => {
  await db.execute(sql`
    UPDATE players SET guild_member_id = NULL
    WHERE guild_member_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM guild_members gm WHERE gm.id = players.guild_member_id)
  `);
  res.json({ fixed: true, message: "تم مسح مراجع النقابة غير الصحيحة." });
});

router.post("/bug-fixer/fix/stuck-battles", async (_req, res) => {
  await db.execute(sql`
    UPDATE battles SET status = 'abandoned'
    WHERE status = 'active'
    AND created_at < NOW() - INTERVAL '1 hour'
  `);
  res.json({ fixed: true, message: "تم وضع حالة 'مهجور' على جميع المعارك العالقة." });
});

router.post("/bug-fixer/fix/invalid-party", async (_req, res) => {
  await db.execute(sql`
    UPDATE players SET active_party = '[]'::jsonb
    WHERE jsonb_array_length(active_party) > 0
    AND NOT EXISTS (
      SELECT 1 FROM player_characters pc
      WHERE pc.player_id = players.id AND pc.is_on_party = true
    )
  `);
  res.json({ fixed: true, message: "تم مسح مؤشرات الفريق غير المتزامنة." });
});

router.post("/bug-fixer/fix/dup-achievements", async (_req, res) => {
  await db.execute(sql`
    DELETE FROM player_achievements pa1
    WHERE pa1.id NOT IN (
      SELECT MIN(pa2.id) FROM player_achievements pa2
      GROUP BY pa2.discord_id, pa2.achievement_key
    )
  `);
  res.json({ fixed: true, message: "تم حذف الإنجازات المكررة." });
});

// ── GET /api/bug-fixer/audit-log ────────────────────────────────────────────
router.get("/bug-fixer/audit-log", async (_req, res) => {
  const logs = await db.select({
    id: playersTable.id,
  }).from(playersTable).limit(1); // placeholder — real audit log from adminLogsTable
  const realLogs = await db.execute(sql`
    SELECT id, admin_discord_id as "adminId", admin_username as "adminUsername",
      action, details, created_at as "createdAt"
    FROM admin_logs
    WHERE action LIKE 'bug_fix%'
    ORDER BY created_at DESC
    LIMIT 50
  `);
  res.json({ logs: realLogs.rows });
});

export default router;
