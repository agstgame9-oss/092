import { Router } from "express";
import { db } from "@workspace/db";
import {
  playersTable, charactersTable, guildsTable, battlesTable,
  worldBossSessionsTable, tournamentsTable, guildMembersTable,
  playerCharactersTable, itemsTable, bossesTable, gamePatchesTable,
} from "@workspace/db";
import { sql, desc, count } from "drizzle-orm";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Conversation history per session (in-memory, keyed by sessionId) ────────
const sessions = new Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>();

// ── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت "AI Engineer" — مهندس ذكاء اصطناعي متخصص في لعبة "Anime Multiverse Arena" (AMA).

## دورك:
- تحليل بيانات اللعبة وإعطاء توصيات ذكية
- مساعدة المشرف في اتخاذ قرارات اللعبة (موازنة، أحداث، مكافآت)
- تشخيص مشاكل اللعبة وإقتراح حلول
- كتابة patch notes احترافية
- اقتراح شخصيات جديدة، أحداث، بوسات
- تحليل اقتصاد اللعبة (ذهب، جواهر، سوق)

## قواعد الأسلوب:
- رد بالعربية دائماً
- كن دقيقاً وعملياً، لا تبالغ
- استخدم البيانات الفعلية المقدمة لك في تحليلاتك
- عند اقتراح شخصيات أو محتوى، اجعلها متوافقة مع نظام AMA (رتب D-SSS+، عناصر متعددة)
- قدّم الاقتراحات بصيغة قابلة للتطبيق مباشرة

## نظام AMA:
- رتب الشخصيات: D, C, B, A, S, SS, SSS, SSS+
- العناصر: Fire, Water, Wind, Earth, Light, Dark, Lightning, Ice, Psychic, Cosmic
- الاقتصاد: ذهب + جواهر
- نظام PvP بتقييم ELO
- الوحش العالمي، البطولات، النقابات، الاستكشاف`;

// ── GET /api/ai-engineer/context — fetch live game stats ────────────────────
router.get("/ai-engineer/context", async (_req, res) => {
  try {
    const [
      playerCount,
      characterCount,
      guildCount,
      battleCount,
      activeBoss,
      topPlayers,
      recentBattles,
      guildStats,
    ] = await Promise.all([
      db.select({ count: count() }).from(playersTable),
      db.select({ count: count() }).from(charactersTable),
      db.select({ count: count() }).from(guildsTable),
      db.select({ count: count() }).from(battlesTable),
      db.select().from(worldBossSessionsTable).where(sql`is_defeated = false`).limit(1),
      db.select({
        username: playersTable.username,
        level: playersTable.level,
        pvpRating: playersTable.pvpRating,
        gold: playersTable.gold,
      }).from(playersTable).orderBy(desc(playersTable.level)).limit(5),
      db.select({ count: count() }).from(battlesTable).where(sql`created_at > NOW() - INTERVAL '24 hours'`),
      db.select({
        name: guildsTable.name,
        level: guildsTable.level,
        treasury: guildsTable.treasury,
      }).from(guildsTable).orderBy(desc(guildsTable.level)).limit(3),
    ]);

    res.json({
      players: playerCount[0]?.count ?? 0,
      characters: characterCount[0]?.count ?? 0,
      guilds: guildCount[0]?.count ?? 0,
      totalBattles: battleCount[0]?.count ?? 0,
      battlesToday: recentBattles[0]?.count ?? 0,
      activeBoss: activeBoss[0] ?? null,
      topPlayers,
      topGuilds: guildStats,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/ai-engineer/chat ───────────────────────────────────────────────
router.post("/ai-engineer/chat", async (req, res) => {
  const { message, sessionId = "default" } = req.body as { message: string; sessionId?: string };
  if (!message?.trim()) return void res.status(400).json({ error: "message required" });

  // Fetch live context
  let context = "";
  try {
    const [players, chars, guilds, battles, battlesToday, boss, items] = await Promise.all([
      db.select({ count: count() }).from(playersTable),
      db.select({ count: count() }).from(charactersTable),
      db.select({ count: count() }).from(guildsTable),
      db.select({ count: count() }).from(battlesTable),
      db.select({ count: count() }).from(battlesTable).where(sql`created_at > NOW() - INTERVAL '24 hours'`),
      db.select({ name: worldBossSessionsTable.bossName, hp: worldBossSessionsTable.currentHp, total: worldBossSessionsTable.totalHp })
        .from(worldBossSessionsTable).where(sql`is_defeated = false`).limit(1),
      db.select({ count: count() }).from(itemsTable),
    ]);

    const topP = await db.select({
      username: playersTable.username,
      level: playersTable.level,
      pvpRating: playersTable.pvpRating,
      gold: playersTable.gold,
      gems: playersTable.gems,
    }).from(playersTable).orderBy(desc(playersTable.pvpRating)).limit(5);

    const richPlayers = await db.select({
      username: playersTable.username,
      gold: playersTable.gold,
    }).from(playersTable).orderBy(desc(playersTable.gold)).limit(3);

    context = `
## بيانات اللعبة الحالية (${new Date().toLocaleString("ar")}):
- 👥 إجمالي اللاعبين: ${players[0]?.count ?? 0}
- 🃏 الشخصيات في القاعدة: ${chars[0]?.count ?? 0}
- 🏰 النقابات: ${guilds[0]?.count ?? 0}
- ⚔️ إجمالي المعارك: ${battles[0]?.count ?? 0}
- 🔥 معارك اليوم: ${battlesToday[0]?.count ?? 0}
- 📦 الأيتم في القاعدة: ${items[0]?.count ?? 0}
${boss[0] ? `- 🌋 وحش عالمي نشط: ${boss[0].name} (HP: ${boss[0].hp}/${boss[0].total})` : "- لا يوجد وحش عالمي نشط حالياً"}

## أفضل اللاعبين بالتقييم:
${topP.map((p, i) => `${i + 1}. ${p.username} — مستوى ${p.level} | تقييم ${p.pvpRating} | ${p.gold.toLocaleString()}💰`).join("\n")}

## أثرى اللاعبين:
${richPlayers.map((p, i) => `${i + 1}. ${p.username} — ${p.gold.toLocaleString()}💰`).join("\n")}
`.trim();
  } catch { context = "تعذّر تحميل بيانات اللعبة الآن."; }

  // Build message history
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  const history = sessions.get(sessionId)!;

  const userMsg: OpenAI.Chat.ChatCompletionMessageParam = {
    role: "user",
    content: `${context}\n\n---\n\nسؤال المشرف: ${message}`,
  };

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-10), // keep last 10 messages
    userMsg,
  ];

  try {
    // Streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
      max_tokens: 1500,
      temperature: 0.7,
    });

    let fullReply = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        fullReply += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    // Save to history (without the injected context to save tokens)
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: fullReply });

    // Limit history size
    if (history.length > 30) history.splice(0, 10);

  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    } else {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
  }
});

// ── POST /api/ai-engineer/clear — clear session history ─────────────────────
router.post("/ai-engineer/clear", (req, res) => {
  const { sessionId = "default" } = req.body as { sessionId?: string };
  sessions.delete(sessionId);
  res.json({ cleared: true });
});

// ── POST /api/ai-engineer/quick — quick one-shot prompts ─────────────────────
router.post("/ai-engineer/quick", async (req, res) => {
  const { type } = req.body as { type: string };

  const quickPrompts: Record<string, string> = {
    balance:    "حلّل توازن اللعبة الحالي بناءً على البيانات وقدّم 3 توصيات فورية للتحسين.",
    patch_note: "اكتب patch notes احترافية باللغة العربية بناءً على حالة اللعبة الحالية، بأسلوب ألعاب gacha مميز.",
    new_char:   "اقترح شخصية anime جديدة كاملة للعبة: الاسم، الأنمي، الرتبة، العنصر، المهارات الثلاث، والقصة، مع مراعاة توازن اللعبة.",
    new_event:  "صمّم حدثاً محدود الوقت مثيراً للعبة: الاسم، الآلية، المكافآت، المدة المقترحة.",
    economy:    "حلّل اقتصاد اللعبة (الذهب والجواهر) بناءً على البيانات وقدّم توصيات لتحسين التوازن الاقتصادي.",
    boss:       "صمّم وحشاً عالمياً جديداً: الاسم، الأنمي المصدر، قيم HP، الهجمات الخاصة، ومكافآت الهزيمة.",
  };

  const prompt = quickPrompts[type];
  if (!prompt) return void res.status(400).json({ error: "unknown type" });

  // Fetch context
  let context = "";
  try {
    const [players, chars, battles] = await Promise.all([
      db.select({ count: count() }).from(playersTable),
      db.select({ count: count() }).from(charactersTable),
      db.select({ count: count() }).from(battlesTable).where(sql`created_at > NOW() - INTERVAL '24 hours'`),
    ]);
    context = `بيانات: ${players[0]?.count ?? 0} لاعب، ${chars[0]?.count ?? 0} شخصية، ${battles[0]?.count ?? 0} معركة اليوم.\n\n`;
  } catch { /* non-critical */ }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: context + prompt },
      ],
      stream: true,
      max_tokens: 1200,
      temperature: 0.8,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err?.message ?? String(err) })}\n\n`);
    res.end();
  }
});

export default router;
