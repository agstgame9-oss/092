import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, charactersTable, guildsTable, battlesTable } from "@workspace/db";
import { count, sql, desc } from "drizzle-orm";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const router = Router();
const execAsync = promisify(exec);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WORKSPACE = "/home/runner/workspace";
const BACKUP_DIR = "/tmp/ai_engineer_backups";
const EXCLUDED = new Set(["node_modules", ".git", "dist", "build", ".pnpm", ".cache", "coverage"]);

// Session history
const sessions = new Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>();

// ── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت مهندس برمجيات AI متخصص متضمّن داخل لوحة تحكم بوت RPG يسمى "Anime Multiverse Arena".

## صلاحياتك الكاملة:
- قراءة أي ملف في المشروع
- كتابة وتعديل الكود مباشرة
- تشغيل TypeScript typecheck
- اكتشاف وإصلاح الأخطاء تلقائياً
- إضافة ميزات جديدة للبوت

## هيكل المشروع:
- artifacts/discord-bot/src/ → كود البوت (TypeScript)
  - commands/game/ → أوامر اللاعبين (/start, /summon, /explore ...)
  - commands/admin/ → أوامر الأدمن
  - commands/guild/ → أوامر النقابات
  - lib/actions.ts → المنطق المشترك
  - lib/gameEngine.ts → محرك اللعبة
  - lib/embeds.ts → تصميم الرسائل
  - events/ → أحداث Discord
- lib/db/src/schema/ → مخططات قاعدة البيانات (Drizzle ORM)
- artifacts/api-server/src/ → API Server (Express 5)
- artifacts/dashboard/src/ → واجهة الويب (React + Vite)

## تقنيات المشروع:
- TypeScript 5.9، Node.js 24، Discord.js v14
- PostgreSQL + Drizzle ORM، Zod v4
- pnpm workspaces

## قواعد المهندس:
1. دائماً اقرأ الملف قبل تعديله
2. اذكر رقم السطر عند الإشارة للكود
3. عند اقتراح تعديل، أعطِ الكود الكامل الجاهز للنسخ
4. اذكر إذا كان التعديل يحتاج DB push أو إعادة تشغيل
5. رد بالعربية دائماً
6. كن دقيقاً ومباشراً — لا حشو`;

// ── HELPERS ──────────────────────────────────────────────────────────────────

function safePath(p: string): string {
  const resolved = path.resolve(WORKSPACE, p.replace(/^\//, ""));
  if (!resolved.startsWith(WORKSPACE)) throw new Error("Path outside workspace");
  return resolved;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
  size?: number;
  ext?: string;
}

function buildTree(dir: string, depth = 0, maxDepth = 4): FileNode[] {
  if (depth > maxDepth) return [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return []; }

  return entries
    .filter((e) => !EXCLUDED.has(e.name) && !e.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((e) => {
      const full = path.join(dir, e.name);
      const rel = path.relative(WORKSPACE, full);
      if (e.isDirectory()) {
        return { name: e.name, path: rel, type: "dir" as const, children: buildTree(full, depth + 1, maxDepth) };
      }
      const stat = fs.statSync(full);
      return { name: e.name, path: rel, type: "file" as const, size: stat.size, ext: path.extname(e.name) };
    });
}

// ── ROUTES ───────────────────────────────────────────────────────────────────

// GET /api/ai-engineer/files — project file tree
router.get("/ai-engineer/files", (_req, res) => {
  try {
    const tree = buildTree(WORKSPACE, 0, 4);
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/ai-engineer/read-file?path=... — read file content
router.get("/ai-engineer/read-file", (req, res) => {
  try {
    const filePath = safePath(String(req.query.path ?? ""));
    const stat = fs.statSync(filePath);
    if (stat.size > 500_000) return void res.status(413).json({ error: "File too large (>500KB)" });
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").length;
    res.json({ content, lines, size: stat.size, path: path.relative(WORKSPACE, filePath) });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/ai-engineer/write-file — write file with backup
router.post("/ai-engineer/write-file", (req, res) => {
  try {
    const { path: filePath, content } = req.body as { path: string; content: string };
    const abs = safePath(filePath);

    // Create backup
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if (fs.existsSync(abs)) {
      const backupName = `${path.basename(abs)}.${Date.now()}.bak`;
      fs.copyFileSync(abs, path.join(BACKUP_DIR, backupName));
    }

    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
    res.json({ success: true, path: path.relative(WORKSPACE, abs) });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/ai-engineer/run-cmd — run safe commands
const SAFE_CMDS = [
  /^pnpm\s+(run\s+)?(typecheck|build|typecheck:libs|typecheck:all)(\s|$)/,
  /^pnpm\s+--filter\s+@workspace\/[\w-]+\s+run\s+(typecheck|build|dev|start)(\s|$)/,
  /^pnpm\s+--filter\s+@workspace\/db\s+run\s+push(\s|$)/,
  /^node\s+--version(\s|$)/,
  /^pnpm\s+--version(\s|$)/,
];

router.post("/ai-engineer/run-cmd", async (req, res) => {
  const { cmd } = req.body as { cmd: string };
  const trimmed = cmd?.trim() ?? "";
  if (!SAFE_CMDS.some((re) => re.test(trimmed))) {
    return void res.status(403).json({ error: `Command not allowed: ${trimmed}` });
  }
  try {
    const { stdout, stderr } = await execAsync(trimmed, { cwd: WORKSPACE, timeout: 60_000 });
    res.json({ stdout: stdout.trim(), stderr: stderr.trim(), success: true });
  } catch (err: any) {
    res.json({ stdout: err.stdout?.trim() ?? "", stderr: err.stderr?.trim() ?? String(err), success: false });
  }
});

// GET /api/ai-engineer/context — live game stats
router.get("/ai-engineer/context", async (_req, res) => {
  try {
    const [players, chars, guilds, battlesToday] = await Promise.all([
      db.select({ count: count() }).from(playersTable),
      db.select({ count: count() }).from(charactersTable),
      db.select({ count: count() }).from(guildsTable),
      db.select({ count: count() }).from(battlesTable).where(sql`created_at > NOW() - INTERVAL '24 hours'`),
    ]);
    const topPlayers = await db.select({
      username: playersTable.username, level: playersTable.level, pvpRating: playersTable.pvpRating,
    }).from(playersTable).orderBy(desc(playersTable.pvpRating)).limit(5);

    res.json({
      players: players[0]?.count ?? 0,
      characters: chars[0]?.count ?? 0,
      guilds: guilds[0]?.count ?? 0,
      battlesToday: battlesToday[0]?.count ?? 0,
      topPlayers,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/ai-engineer/chat — streaming chat with optional file context
router.post("/ai-engineer/chat", async (req, res) => {
  const { message, sessionId = "default", fileContext } = req.body as {
    message: string; sessionId?: string; fileContext?: { path: string; content: string };
  };
  if (!message?.trim()) return void res.status(400).json({ error: "message required" });

  // Build context block
  let contextBlock = "";
  if (fileContext?.path && fileContext.content) {
    contextBlock = `\n\n## الملف المفتوح حالياً: \`${fileContext.path}\`\n\`\`\`typescript\n${fileContext.content.slice(0, 8000)}\n\`\`\``;
  }

  // Fetch game stats briefly
  let statsBlock = "";
  try {
    const [players, battles] = await Promise.all([
      db.select({ count: count() }).from(playersTable),
      db.select({ count: count() }).from(battlesTable).where(sql`created_at > NOW() - INTERVAL '24 hours'`),
    ]);
    statsBlock = `\n\n## إحصائيات البوت: ${players[0]?.count ?? 0} لاعب | ${battles[0]?.count ?? 0} معركة اليوم`;
  } catch { /* non-critical */ }

  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  const history = sessions.get(sessionId)!;

  const userContent = `${statsBlock}${contextBlock}\n\n---\nسؤال المشرف: ${message}`;
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-12),
    { role: "user", content: userContent },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini", messages, stream: true, max_tokens: 2000, temperature: 0.5,
    });

    let fullReply = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) { fullReply += delta; res.write(`data: ${JSON.stringify({ delta })}\n\n`); }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: fullReply });
    if (history.length > 30) history.splice(0, 10);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err?.message ?? String(err) })}\n\n`);
    res.end();
  }
});

// POST /api/ai-engineer/auto-fix — AI reads error + file and returns fix
router.post("/ai-engineer/auto-fix", async (req, res) => {
  const { filePath, errorText } = req.body as { filePath: string; errorText: string };

  let fileContent = "";
  try {
    const abs = safePath(filePath);
    fileContent = fs.readFileSync(abs, "utf8");
  } catch {
    return void res.status(400).json({ error: "Cannot read file" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      max_tokens: 3000,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `## الخطأ:
\`\`\`
${errorText.slice(0, 2000)}
\`\`\`

## الملف المتسبب: \`${filePath}\`
\`\`\`typescript
${fileContent.slice(0, 6000)}
\`\`\`

حلّل الخطأ وأعطني:
1. شرح سبب الخطأ
2. الكود المُصلَح الكامل للملف جاهز للنسخ (ضمّن تريبل backticks مع typescript)
3. خطوات تطبيق الإصلاح`,
        },
      ],
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

// POST /api/ai-engineer/clear — clear session
router.post("/ai-engineer/clear", (req, res) => {
  const { sessionId = "default" } = req.body as { sessionId?: string };
  sessions.delete(sessionId);
  res.json({ cleared: true });
});

export default router;
