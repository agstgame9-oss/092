import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Send, Trash2, Cpu, RefreshCw, FolderOpen, FileCode,
  ChevronRight, ChevronDown, Terminal, Wrench, Play,
  CheckCircle, XCircle, Loader2, Save, AlertTriangle,
  Bug, Zap, FolderClosed, FilePlus, RotateCcw, Check,
  ArrowDownToLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FileNode {
  name: string; path: string; type: "file" | "dir";
  children?: FileNode[]; size?: number; ext?: string;
}
interface Message {
  id: string; role: "user" | "assistant"; content: string;
  timestamp: Date; isStreaming?: boolean;
}
interface OpenFile {
  path: string; content: string; lines: number; modified: boolean; savedContent: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const API = "/api/ai-engineer";
const FILE_COLORS: Record<string, string> = {
  ".ts": "text-blue-400", ".tsx": "text-cyan-400", ".js": "text-yellow-400",
  ".json": "text-green-400", ".md": "text-gray-400", ".sql": "text-orange-400",
  ".css": "text-pink-400",
};
const QUICK_CMDS = [
  { label: "Typecheck (all)",  cmd: "pnpm run typecheck",                                       icon: "🔍" },
  { label: "Typecheck (bot)",  cmd: "pnpm --filter @workspace/discord-bot run typecheck",       icon: "🤖" },
  { label: "Typecheck (api)",  cmd: "pnpm --filter @workspace/api-server run typecheck",        icon: "⚡" },
  { label: "Build (all)",      cmd: "pnpm run build",                                           icon: "🏗️" },
  { label: "DB Push",          cmd: "pnpm --filter @workspace/db run push",                     icon: "🗄️" },
  { label: "إعادة تشغيل البوت", cmd: 'pkill -f "tsx src/index.ts"',                            icon: "🔄" },
];

// ── Code-block extractor ──────────────────────────────────────────────────────
function extractCodeBlocks(text: string): string[] {
  const re = /```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) blocks.push(m[1]);
  return blocks;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderMarkdown(text: string) {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="bg-black/50 border border-border/40 rounded-md p-3 my-2 overflow-x-auto text-[11px] font-mono text-green-300 leading-relaxed"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`)
    .replace(/`([^`]+)`/g, `<code class="bg-black/30 px-1 rounded text-[11px] font-mono text-yellow-300">$1</code>`)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^## (.+)$/gm, '<p class="text-sm font-bold mt-3 mb-1">$1</p>')
    .replace(/^### (.+)$/gm, '<p class="text-xs font-semibold mt-2 mb-1 text-muted-foreground uppercase tracking-wide">$1</p>')
    .replace(/^- (.+)$/gm, '<p class="text-sm mr-3">• $1</p>')
    .replace(/^\d+\. (.+)$/gm, '<p class="text-sm mr-3">$1</p>')
    .replace(/\n\n/g, '<div class="my-1.5"></div>')
    .replace(/\n/g, "<br/>");
}

// ── Stream helper ─────────────────────────────────────────────────────────────
async function streamFetch(
  url: string, body: object,
  onDelta: (d: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { onError(`HTTP ${res.status}`); return; }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) { onError(data.error); return; }
        if (data.done) { onDone(); return; }
        if (data.delta) onDelta(data.delta);
      } catch { /* skip */ }
    }
  }
  onDone();
}

// ── File Tree Node ─────────────────────────────────────────────────────────────
function TreeNode({ node, depth, selected, onSelect }: {
  node: FileNode; depth: number; selected: string | null; onSelect: (n: FileNode) => void;
}) {
  const [open, setOpen] = useState(depth === 0 || (depth === 1 && ["discord-bot", "api-server"].includes(node.name)));
  const isSelected = node.path === selected;

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          style={{ paddingLeft: `${depth * 10 + 6}px` }}
          className="flex items-center gap-1 w-full text-left py-0.5 pr-2 rounded hover:bg-secondary/50 text-xs transition-colors"
        >
          {open ? <ChevronDown className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                : <ChevronRight className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />}
          {open ? <FolderOpen className="w-3 h-3 text-yellow-400/80 flex-shrink-0" />
                : <FolderClosed className="w-3 h-3 text-yellow-400/80 flex-shrink-0" />}
          <span className="text-muted-foreground/80 truncate">{node.name}</span>
        </button>
        {open && node.children?.map((c) => (
          <TreeNode key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node)}
      style={{ paddingLeft: `${depth * 10 + 6}px` }}
      className={cn(
        "flex items-center gap-1.5 w-full text-left py-0.5 pr-2 rounded text-xs transition-colors",
        isSelected ? "bg-primary/20 text-primary font-medium" : "hover:bg-secondary/50 text-foreground/70",
      )}
    >
      <FileCode className={cn("w-3 h-3 flex-shrink-0", FILE_COLORS[node.ext ?? ""] ?? "text-gray-400")} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function MsgBubble({ msg, openFile, onApplyCode, toast }: {
  msg: Message;
  openFile: OpenFile | null;
  onApplyCode: (filePath: string, aiText: string) => void;
  toast: (t: any) => void;
}) {
  const [applied, setApplied] = useState(false);
  const codeBlocks = msg.role === "assistant" && !msg.isStreaming ? extractCodeBlocks(msg.content) : [];
  const hasCode = codeBlocks.length > 0;

  const handleApply = async () => {
    if (!openFile) { toast({ title: "⚠️ افتح الملف أولاً", description: "افتح الملف الذي تريد تطبيق الكود عليه من المستكشف", variant: "destructive" }); return; }
    try {
      const res = await fetch(`${API}/apply-code`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: openFile.path, aiText: msg.content }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setApplied(true);
      toast({ title: `✅ تم تطبيق الكود على ${data.path}`, description: `${data.lines} سطر كُتبوا بنجاح` });
    } catch (e: any) {
      toast({ title: "خطأ في التطبيق", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className={cn("flex gap-2 group", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5",
        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-violet-600 to-blue-600 text-white",
      )}>
        {msg.role === "user" ? "أنت" : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={cn("max-w-[88%]", msg.role === "user" ? "items-end flex flex-col" : "")}>
        <div className={cn(
          "rounded-xl px-3 py-2.5 text-sm",
          msg.role === "user"
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-secondary/50 text-foreground rounded-tl-sm border border-border/30",
        )}>
          {msg.role === "user"
            ? <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
            : <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          }
          {msg.isStreaming && <span className="inline-block w-1.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm opacity-70" />}
        </div>

        {/* Apply Code button — shown when AI gives code and is done streaming */}
        {hasCode && !msg.isStreaming && (
          <div className="mt-1.5 flex items-center gap-2">
            <Button
              size="sm"
              variant={applied ? "secondary" : "outline"}
              onClick={handleApply}
              disabled={applied}
              className={cn(
                "h-6 px-2.5 text-[11px] gap-1.5 transition-colors",
                !applied && "border-green-500/50 text-green-400 hover:bg-green-500/10",
              )}
            >
              {applied
                ? <><Check className="w-3 h-3" /> تم التطبيق</>
                : <><ArrowDownToLine className="w-3 h-3" /> تطبيق الكود على {openFile?.path.split("/").pop() ?? "الملف المفتوح"}</>
              }
            </Button>
            {codeBlocks.length > 1 && (
              <span className="text-[10px] text-muted-foreground">{codeBlocks.length} كود blocks</span>
            )}
          </div>
        )}

        <div className={cn(
          "flex items-center gap-1.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
          msg.role === "user" ? "flex-row-reverse" : "",
        )}>
          <span className="text-[10px] text-muted-foreground">
            {msg.timestamp.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AIEngineer() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome", role: "assistant", timestamp: new Date(),
    content: `مرحباً! أنا مهندس AI الخاص ببوتك 🤖\n\n**أقدر أعمل كل ده:**\n- **إضافة أوامر جديدة** للبوت (مثلاً: /shop, /duel, /rank)\n- **تعديل أوامر موجودة** (عدّل المكافآت، الميكانيكيات، الرسائل)\n- **إصلاح الأخطاء** تلقائياً\n- **تشغيل typecheck** وشرح الأخطاء\n- **كتابة الكود كاملاً** وتطبيقه مباشرة على الملف\n\n**كيف تستخدمني:**\n1. افتح الملف المناسب من المستكشف\n2. اسألني عن أي تعديل أو إضافة\n3. اضغط **"تطبيق الكود"** على ردي لتطبيقه مباشرة على الملف 🚀`,
  }]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [cmdOut, setCmdOut] = useState<{ cmd: string; stdout: string; stderr: string; ok: boolean } | null>(null);
  const [runningCmd, setRunningCmd] = useState(false);
  const [autoFixErr, setAutoFixErr] = useState("");
  const [rightTab, setRightTab] = useState<"code" | "terminal" | "fix">("code");
  const [sessionId] = useState(() => `s_${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } = useQuery<{ tree: FileNode[] }>({
    queryKey: ["ai-files"],
    queryFn: () => fetch(`${API}/files`).then((r) => r.json()),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Open a file from the explorer
  const handleSelectFile = useCallback(async (node: FileNode) => {
    if (node.type !== "file") return;
    try {
      const res = await fetch(`${API}/read-file?path=${encodeURIComponent(node.path)}`);
      const data = await res.json();
      if (data.error) { toast({ title: "خطأ", description: data.error, variant: "destructive" }); return; }
      setOpenFile({ path: node.path, content: data.content, lines: data.lines, modified: false, savedContent: data.content });
      setRightTab("code");
    } catch (e: any) { toast({ title: "خطأ", description: e.message, variant: "destructive" }); }
  }, [toast]);

  // Save the open file
  const saveFile = useCallback(async () => {
    if (!openFile) return;
    try {
      const res = await fetch(`${API}/write-file`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: openFile.path, content: openFile.content }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setOpenFile((f) => f ? { ...f, modified: false, savedContent: f.content } : f);
      toast({ title: "✅ تم الحفظ", description: openFile.path });
    } catch (e: any) { toast({ title: "خطأ في الحفظ", description: e.message, variant: "destructive" }); }
  }, [openFile, toast]);

  // Run a quick command
  const runCmd = useCallback(async (cmd: string, label: string) => {
    setRunningCmd(true);
    setRightTab("terminal");
    setCmdOut(null);
    try {
      const res = await fetch(`${API}/run-cmd`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd }),
      });
      const d = await res.json();
      setCmdOut({ cmd: label, stdout: d.stdout, stderr: d.stderr, ok: d.success });
      if (d.success) toast({ title: `✅ ${label} — نجح` });
      else toast({ title: `❌ ${label} — فشل`, description: "شوف Terminal", variant: "destructive" });
    } catch (e: any) {
      setCmdOut({ cmd: label, stdout: "", stderr: e.message, ok: false });
    } finally { setRunningCmd(false); }
  }, [toast]);

  // Send a chat message
  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isStreaming) return;
    setInput("");
    const userId = `u_${Date.now()}`;
    const aId = `a_${Date.now()}`;

    setMessages((p) => [
      ...p,
      { id: userId, role: "user", content: text, timestamp: new Date() },
      { id: aId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true },
    ]);
    setIsStreaming(true);

    const fileContext = openFile
      ? { path: openFile.path, content: openFile.content.slice(0, 8000) }
      : undefined;

    await streamFetch(
      `${API}/chat`, { message: text, sessionId, fileContext },
      (delta) => setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: m.content + delta } : m)),
      () => { setMessages((p) => p.map((m) => m.id === aId ? { ...m, isStreaming: false } : m)); setIsStreaming(false); inputRef.current?.focus(); },
      (err) => { setMessages((p) => p.filter((m) => m.id !== aId)); setIsStreaming(false); toast({ title: "خطأ", description: err, variant: "destructive" }); },
    );
  }, [input, isStreaming, openFile, sessionId, toast]);

  // Auto-fix
  const runAutoFix = useCallback(async () => {
    if (!openFile || !autoFixErr.trim() || isStreaming) return;
    const aId = `a_fix_${Date.now()}`;
    setMessages((p) => [
      ...p,
      { id: `u_fix_${Date.now()}`, role: "user", content: `🔧 إصلاح تلقائي لـ \`${openFile.path}\`:\n${autoFixErr}`, timestamp: new Date() },
      { id: aId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true },
    ]);
    setIsStreaming(true);
    setAutoFixErr("");
    await streamFetch(
      `${API}/auto-fix`, { filePath: openFile.path, errorText: autoFixErr },
      (delta) => setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: m.content + delta } : m)),
      () => { setMessages((p) => p.map((m) => m.id === aId ? { ...m, isStreaming: false } : m)); setIsStreaming(false); },
      (err) => { setMessages((p) => p.filter((m) => m.id !== aId)); setIsStreaming(false); toast({ title: "خطأ", description: err, variant: "destructive" }); },
    );
  }, [openFile, autoFixErr, isStreaming, toast]);

  const clearChat = useCallback(async () => {
    await fetch(`${API}/clear`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
    setMessages([{ id: `w_${Date.now()}`, role: "assistant", content: "تم مسح المحادثة — كيف أساعدك؟ 🛠️", timestamp: new Date() }]);
  }, [sessionId]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-1rem)] gap-0 overflow-hidden rounded-xl border border-border/50 bg-background m-2">

      {/* ── LEFT: File Explorer ─────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 border-r border-border/50 flex flex-col bg-background/50">
        <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">الملفات</span>
          </div>
          <button onClick={() => refetchFiles()} className="text-muted-foreground/60 hover:text-muted-foreground">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        <ScrollArea className="flex-1 py-1 px-1">
          {filesLoading
            ? <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            : filesData?.tree.map((n) => <TreeNode key={n.path} node={n} depth={0} selected={openFile?.path ?? null} onSelect={handleSelectFile} />)
          }
        </ScrollArea>

        {/* Quick Commands */}
        <div className="border-t border-border/50 p-1.5 space-y-0.5">
          <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide px-1 mb-1">أوامر سريعة</p>
          {QUICK_CMDS.map((c) => (
            <button
              key={c.cmd}
              onClick={() => runCmd(c.cmd, c.label)}
              disabled={runningCmd}
              className={cn(
                "w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] hover:bg-secondary/60 transition-colors text-left disabled:opacity-50 text-foreground/70",
                c.label === "إعادة تشغيل البوت" && "text-orange-400/80 hover:bg-orange-500/10",
              )}
            >
              <span className="text-xs">{c.icon}</span>
              <span className="truncate">{c.label}</span>
              {runningCmd && <Loader2 className="w-2.5 h-2.5 animate-spin ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── CENTER: Chat ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">AI Engineer</p>
              <p className="text-[10px] text-muted-foreground leading-tight">يعدّل البوت مباشرة</p>
            </div>
            <Badge variant="secondary" className="text-[9px] gap-0.5 ml-1 h-4">
              <Cpu className="w-2.5 h-2.5" /> GPT-4o mini
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={clearChat}
            className="h-6 px-2 text-[11px] text-muted-foreground gap-1">
            <Trash2 className="w-3 h-3" /> مسح
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-4">
            {messages.map((msg) => (
              <MsgBubble key={msg.id} msg={msg} openFile={openFile} onApplyCode={() => {}} toast={toast} />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Open file indicator */}
        {openFile && (
          <div className="mx-3 mb-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
            <FileCode className="w-3 h-3 text-blue-400 flex-shrink-0" />
            <span className="text-[11px] text-blue-300 truncate flex-1 font-mono">{openFile.path}</span>
            <span className="text-[10px] text-blue-400/60">{openFile.lines}L</span>
            {openFile.modified && <Badge variant="outline" className="text-[9px] h-4 text-yellow-400 border-yellow-400/40">*معدّل</Badge>}
          </div>
        )}

        {/* Input */}
        <div className="px-3 pb-3 flex gap-2 items-end flex-shrink-0">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={
              openFile
                ? `اسألني عن ${openFile.path.split("/").pop()} أو قل "أضف ميزة..." (Enter للإرسال)`
                : "قل: أضف أمر /rank ... أو افتح ملف واسألني عنه"
            }
            className="flex-1 min-h-[42px] max-h-28 resize-none text-sm border-border/50 bg-background/50"
            rows={1} disabled={isStreaming}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            size="sm"
            className="h-[42px] px-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:opacity-90 text-white border-0"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ── RIGHT: Code / Terminal / Fix ─────────────────────────────────────── */}
      <div className="w-[400px] flex-shrink-0 flex flex-col">
        <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as any)} className="flex flex-col h-full">
          <TabsList className="mx-2 mt-2 flex-shrink-0 grid grid-cols-3 h-8">
            <TabsTrigger value="code" className="text-[11px] gap-1 h-7">
              <FileCode className="w-3 h-3" /> الكود
            </TabsTrigger>
            <TabsTrigger value="terminal" className="text-[11px] gap-1 h-7">
              <Terminal className="w-3 h-3" /> Terminal
              {runningCmd && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
            </TabsTrigger>
            <TabsTrigger value="fix" className="text-[11px] gap-1 h-7">
              <Wrench className="w-3 h-3" /> إصلاح
            </TabsTrigger>
          </TabsList>

          {/* ── Code viewer/editor ── */}
          <TabsContent value="code" className="flex-1 flex flex-col m-0 min-h-0 px-2 pb-2 mt-1">
            {openFile ? (
              <>
                <div className="flex items-center justify-between px-1 py-1">
                  <span className="text-[10px] text-muted-foreground font-mono truncate">{openFile.path}</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost"
                      onClick={() => sendMessage(`اشرح لي الكود في ${openFile.path}`)}
                      disabled={isStreaming}
                      className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground">
                      <Bot className="w-2.5 h-2.5" /> شرح
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => sendMessage(`راجع ${openFile.path} وابحث عن أخطاء أو تحسينات`)}
                      disabled={isStreaming}
                      className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground">
                      <Bug className="w-2.5 h-2.5" /> مراجعة
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={saveFile}
                      disabled={!openFile.modified}
                      className={cn("h-5 px-1.5 text-[10px] gap-1", openFile.modified && "text-yellow-400 border-yellow-400/40")}>
                      <Save className="w-2.5 h-2.5" />
                      {openFile.modified ? "حفظ*" : "محفوظ"}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 rounded-md border border-border/50 overflow-hidden">
                  <textarea
                    className="w-full h-full bg-black/40 text-[11px] font-mono p-2.5 text-green-200 resize-none focus:outline-none leading-relaxed"
                    value={openFile.content}
                    onChange={(e) => setOpenFile((f) => f
                      ? { ...f, content: e.target.value, modified: e.target.value !== f.savedContent }
                      : f)}
                    spellCheck={false}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3">
                <FolderOpen className="w-10 h-10 text-muted-foreground/20" />
                <div>
                  <p className="text-sm text-muted-foreground">افتح ملفاً من المستكشف</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">اضغط على أي ملف .ts لتعرضه وتعديله</p>
                </div>
                <div className="text-xs text-muted-foreground/40 space-y-1">
                  <p>💡 أمثلة سريعة:</p>
                  <button onClick={() => sendMessage("أضف أمر Discord جديد باسم /rank يعرض ترتيب اللاعب في PvP")}
                    className="block w-full px-2 py-1 rounded bg-secondary/40 hover:bg-secondary/60 transition-colors text-[10px] text-right">
                    👉 أضف أمر /rank
                  </button>
                  <button onClick={() => sendMessage("كيف يعمل نظام الـ stamina في البوت؟")}
                    className="block w-full px-2 py-1 rounded bg-secondary/40 hover:bg-secondary/60 transition-colors text-[10px] text-right">
                    👉 اشرح نظام الـ stamina
                  </button>
                  <button onClick={() => sendMessage("ما هي الملفات المهمة في البوت وماذا تفعل كل منها؟")}
                    className="block w-full px-2 py-1 rounded bg-secondary/40 hover:bg-secondary/60 transition-colors text-[10px] text-right">
                    👉 اشرح هيكل المشروع
                  </button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Terminal ── */}
          <TabsContent value="terminal" className="flex-1 flex flex-col m-0 min-h-0 px-2 pb-2 mt-1">
            <div className="flex items-center gap-2 px-1 py-1">
              <Terminal className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {cmdOut ? cmdOut.cmd : "نتيجة الأمر"}
              </span>
              {cmdOut && (
                <Badge variant="outline" className={cn("text-[9px] h-4 mr-auto",
                  cmdOut.ok ? "text-green-400 border-green-400/40" : "text-red-400 border-red-400/40")}>
                  {cmdOut.ok ? <CheckCircle className="w-2.5 h-2.5 mr-1 inline" /> : <XCircle className="w-2.5 h-2.5 mr-1 inline" />}
                  {cmdOut.ok ? "نجح" : "فشل"}
                </Badge>
              )}
            </div>
            <div className="flex-1 min-h-0 rounded-md border border-border/50 bg-black/50 overflow-auto p-3 font-mono text-[11px] leading-relaxed">
              {runningCmd
                ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> جاري التنفيذ...</div>
                : cmdOut
                  ? <>
                      <p className="text-blue-400 mb-2">$ {cmdOut.cmd}</p>
                      {cmdOut.stdout && <pre className="text-green-300 whitespace-pre-wrap">{cmdOut.stdout}</pre>}
                      {cmdOut.stderr && <pre className="text-red-400 whitespace-pre-wrap mt-1">{cmdOut.stderr}</pre>}
                    </>
                  : <p className="text-muted-foreground/40">اضغط على أمر من الأوامر السريعة يساراً</p>
              }
            </div>
            {/* If there's an error, offer to auto-fix */}
            {cmdOut && !cmdOut.ok && cmdOut.stderr && openFile && (
              <Button variant="outline" size="sm"
                onClick={() => { setAutoFixErr(cmdOut.stderr); setRightTab("fix"); }}
                className="mt-2 w-full h-7 text-[11px] gap-1.5 text-orange-400 border-orange-400/40 hover:bg-orange-500/10">
                <Zap className="w-3 h-3" /> إصلاح تلقائي بالـ AI
              </Button>
            )}
            {cmdOut?.ok && cmdOut.cmd === "إعادة تشغيل البوت" && (
              <p className="text-center text-[10px] text-muted-foreground mt-2">
                ✅ البوت توقف — سيُعاد تشغيله تلقائياً خلال ثوانٍ
              </p>
            )}
          </TabsContent>

          {/* ── Auto Fix ── */}
          <TabsContent value="fix" className="flex-1 flex flex-col m-0 min-h-0 px-2 pb-2 mt-1">
            <div className="flex items-center gap-1.5 px-1 py-1">
              <Wrench className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] text-muted-foreground">إصلاح تلقائي — الصق الخطأ والـ AI يصلحه</span>
            </div>
            {!openFile && (
              <div className="mx-0 mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                <span className="text-[11px] text-yellow-400">افتح الملف المتسبب في الخطأ أولاً</span>
              </div>
            )}
            <Textarea
              value={autoFixErr}
              onChange={(e) => setAutoFixErr(e.target.value)}
              placeholder="الصق رسالة الخطأ هنا أو اشرح المشكلة بالتفصيل..."
              className="flex-1 min-h-0 font-mono text-[11px] resize-none border-border/50 bg-black/20"
              disabled={isStreaming}
            />
            <Button
              onClick={runAutoFix}
              disabled={!openFile || !autoFixErr.trim() || isStreaming}
              className="mt-2 w-full h-8 text-xs gap-2 bg-orange-600 hover:bg-orange-700 text-white border-0"
            >
              {isStreaming
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري الإصلاح...</>
                : <><Zap className="w-3.5 h-3.5" /> إصلاح تلقائي وكتابة الكود</>
              }
            </Button>
            <p className="text-center text-[10px] text-muted-foreground/50 mt-1.5">
              بعد الرد، اضغط "تطبيق الكود" في المحادثة لتطبيق الإصلاح مباشرة
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
