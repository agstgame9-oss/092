import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Send, Trash2, Cpu, RefreshCw, FolderOpen, File,
  FileCode, ChevronRight, ChevronDown, Copy, Terminal,
  Wrench, Play, CheckCircle, XCircle, Loader2, Save,
  AlertTriangle, Bug, Zap, FolderClosed,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
  size?: number;
  ext?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface OpenFile {
  path: string;
  content: string;
  lines: number;
  modified: boolean;
  savedContent: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const API = "/api/ai-engineer";

const FILE_ICONS: Record<string, string> = {
  ".ts": "text-blue-400", ".tsx": "text-cyan-400", ".js": "text-yellow-400",
  ".json": "text-green-400", ".md": "text-gray-400", ".sql": "text-orange-400",
  ".css": "text-pink-400", ".html": "text-red-400",
};

const SAFE_CMDS = [
  { label: "Typecheck (all)", cmd: "pnpm run typecheck" },
  { label: "Typecheck (bot)", cmd: "pnpm --filter @workspace/discord-bot run typecheck" },
  { label: "Typecheck (api)", cmd: "pnpm --filter @workspace/api-server run typecheck" },
  { label: "Build (all)", cmd: "pnpm run build" },
  { label: "DB Push", cmd: "pnpm --filter @workspace/db run push" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderMarkdown(text: string) {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="bg-black/40 border border-border/50 rounded-md p-3 my-2 overflow-x-auto text-xs font-mono text-green-300"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`)
    .replace(/`([^`]+)`/g, `<code class="bg-black/30 px-1 rounded text-xs font-mono text-yellow-300">$1</code>`)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^## (.+)$/gm, '<p class="text-sm font-bold mt-3 mb-1 text-foreground">$1</p>')
    .replace(/^### (.+)$/gm, '<p class="text-xs font-semibold mt-2 mb-1 text-muted-foreground uppercase tracking-wide">$1</p>')
    .replace(/^- (.+)$/gm, '<p class="text-sm mr-3 before:content-[\'•\'] before:mr-2 before:text-primary">$1</p>')
    .replace(/^\d+\. (.+)$/gm, '<p class="text-sm mr-3">$1</p>')
    .replace(/\n\n/g, '<div class="my-1"></div>')
    .replace(/\n/g, "<br/>");
}

async function streamFetch(
  url: string,
  body: object,
  onDelta: (d: string) => void,
  onDone: () => void,
  onError: (e: string) => void
) {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
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

// ── File Tree Node ────────────────────────────────────────────────────────────
function TreeNode({
  node, depth, selected, onSelect,
}: {
  node: FileNode; depth: number; selected: string | null; onSelect: (n: FileNode) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isSelected = node.path === selected;
  const iconColor = node.type === "file" ? (FILE_ICONS[node.ext ?? ""] ?? "text-gray-400") : "";

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1 w-full text-left px-2 py-0.5 rounded hover:bg-secondary/60 text-xs transition-colors",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
          {open ? <FolderOpen className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                : <FolderClosed className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
          <span className="text-muted-foreground truncate">{node.name}</span>
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
      className={cn(
        "flex items-center gap-1.5 w-full text-left px-2 py-0.5 rounded text-xs transition-colors",
        isSelected ? "bg-primary/20 text-primary" : "hover:bg-secondary/60 text-foreground/80"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <FileCode className={cn("w-3 h-3 flex-shrink-0", iconColor)} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AIEngineer() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome", role: "assistant", timestamp: new Date(),
    content: `مرحباً! أنا مهندس AI الخاص ببوتك 🤖\n\nأقدر أساعدك في:\n- **قراءة وتعديل** أي ملف في المشروع\n- **تشخيص وإصلاح** أخطاء TypeScript\n- **إضافة ميزات** جديدة للبوت\n- **شرح الكود** وتحليل المشاكل\n\nافتح أي ملف من المستكشف واسألني عنه! 🚀`,
  }]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [cmdOutput, setCmdOutput] = useState<{ cmd: string; stdout: string; stderr: string; ok: boolean } | null>(null);
  const [runningCmd, setRunningCmd] = useState(false);
  const [autoFixInput, setAutoFixInput] = useState("");
  const [rightTab, setRightTab] = useState<"code" | "terminal" | "fix">("code");
  const [sessionId] = useState(() => `s_${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingMsgId = useRef<string | null>(null);

  // File tree
  const { data: filesData, isLoading: filesLoading } = useQuery<{ tree: FileNode[] }>({
    queryKey: ["ai-files"],
    queryFn: () => fetch(`${API}/files`).then((r) => r.json()),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Open a file
  const handleSelectFile = useCallback(async (node: FileNode) => {
    if (node.type !== "file") return;
    try {
      const res = await fetch(`${API}/read-file?path=${encodeURIComponent(node.path)}`);
      const data = await res.json();
      if (data.error) { toast({ title: "خطأ", description: data.error, variant: "destructive" }); return; }
      setOpenFile({ path: node.path, content: data.content, lines: data.lines, modified: false, savedContent: data.content });
      setRightTab("code");
    } catch (e: any) {
      toast({ title: "خطأ في فتح الملف", description: e.message, variant: "destructive" });
    }
  }, [toast]);

  // Save file
  const saveFile = useCallback(async () => {
    if (!openFile) return;
    try {
      const res = await fetch(`${API}/write-file`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: openFile.path, content: openFile.content }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOpenFile((f) => f ? { ...f, modified: false, savedContent: f.content } : f);
      toast({ title: "✅ تم الحفظ", description: openFile.path });
    } catch (e: any) {
      toast({ title: "خطأ في الحفظ", description: e.message, variant: "destructive" });
    }
  }, [openFile, toast]);

  // Run command
  const runCmd = useCallback(async (cmd: string) => {
    setRunningCmd(true);
    setRightTab("terminal");
    setCmdOutput(null);
    try {
      const res = await fetch(`${API}/run-cmd`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd }),
      });
      const data = await res.json();
      setCmdOutput({ cmd, stdout: data.stdout, stderr: data.stderr, ok: data.success });
    } catch (e: any) {
      setCmdOutput({ cmd, stdout: "", stderr: e.message, ok: false });
    } finally {
      setRunningCmd(false);
    }
  }, []);

  // Send chat message
  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;
    setInput("");

    const userId = `u_${Date.now()}`;
    const aId = `a_${Date.now()}`;
    streamingMsgId.current = aId;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: msg, timestamp: new Date() },
      { id: aId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true },
    ]);
    setIsStreaming(true);

    const fileContext = openFile
      ? { path: openFile.path, content: openFile.content.slice(0, 8000) }
      : undefined;

    await streamFetch(
      `${API}/chat`,
      { message: msg, sessionId, fileContext },
      (delta) => setMessages((prev) =>
        prev.map((m) => m.id === aId ? { ...m, content: m.content + delta } : m)),
      () => {
        setMessages((prev) => prev.map((m) => m.id === aId ? { ...m, isStreaming: false } : m));
        setIsStreaming(false);
        streamingMsgId.current = null;
        inputRef.current?.focus();
      },
      (err) => {
        setMessages((prev) => prev.filter((m) => m.id !== aId));
        setIsStreaming(false);
        toast({ title: "خطأ", description: err, variant: "destructive" });
      }
    );
  }, [input, isStreaming, openFile, sessionId, toast]);

  // Auto-fix
  const runAutoFix = useCallback(async () => {
    if (!openFile || !autoFixInput.trim() || isStreaming) return;
    const aId = `a_fix_${Date.now()}`;
    streamingMsgId.current = aId;

    setMessages((prev) => [
      ...prev,
      { id: `u_fix_${Date.now()}`, role: "user", content: `🔧 طلب إصلاح تلقائي لـ \`${openFile.path}\`:\n${autoFixInput}`, timestamp: new Date() },
      { id: aId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true },
    ]);
    setIsStreaming(true);
    setAutoFixInput("");

    await streamFetch(
      `${API}/auto-fix`,
      { filePath: openFile.path, errorText: autoFixInput },
      (delta) => setMessages((prev) =>
        prev.map((m) => m.id === aId ? { ...m, content: m.content + delta } : m)),
      () => {
        setMessages((prev) => prev.map((m) => m.id === aId ? { ...m, isStreaming: false } : m));
        setIsStreaming(false);
      },
      (err) => {
        setMessages((prev) => prev.filter((m) => m.id !== aId));
        setIsStreaming(false);
        toast({ title: "خطأ", description: err, variant: "destructive" });
      }
    );
  }, [openFile, autoFixInput, isStreaming, toast]);

  const clearChat = useCallback(async () => {
    await fetch(`${API}/clear`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }),
    });
    setMessages([{ id: `w_${Date.now()}`, role: "assistant", content: "تم مسح المحادثة. كيف أساعدك؟ 🛠️", timestamp: new Date() }]);
  }, [sessionId]);

  const copyText = useCallback((t: string) => {
    navigator.clipboard.writeText(t);
    toast({ title: "✅ تم النسخ" });
  }, [toast]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-1rem)] gap-0 overflow-hidden rounded-xl border border-border/50 bg-background m-2">

      {/* ── Left: File Explorer ─────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 border-r border-border/50 flex flex-col">
        <div className="px-3 py-2.5 border-b border-border/50 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ملفات المشروع</span>
        </div>
        <ScrollArea className="flex-1 py-1">
          {filesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : (
            filesData?.tree.map((node) => (
              <TreeNode key={node.path} node={node} depth={0} selected={openFile?.path ?? null} onSelect={handleSelectFile} />
            ))
          )}
        </ScrollArea>
        {/* Quick commands */}
        <div className="border-t border-border/50 px-2 py-2 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-1 mb-1">أوامر سريعة</p>
          {SAFE_CMDS.map((c) => (
            <button
              key={c.cmd}
              onClick={() => runCmd(c.cmd)}
              disabled={runningCmd}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] hover:bg-secondary/60 transition-colors text-left disabled:opacity-50 text-foreground/70"
            >
              <Play className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />
              <span className="truncate">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Center: Chat ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">AI Engineer</p>
              <p className="text-[10px] text-muted-foreground">مهندس البوت الذكي</p>
            </div>
            <Badge variant="secondary" className="text-[9px] gap-1 ml-1">
              <Cpu className="w-2.5 h-2.5" /> GPT-4o mini
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={clearChat} className="h-7 px-2 text-[11px] text-muted-foreground gap-1">
            <Trash2 className="w-3 h-3" /> مسح
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-2 group", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-gradient-to-br from-violet-600 to-blue-600 text-white"
                )}>
                  {msg.role === "user" ? "أنت" : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={cn("max-w-[85%]", msg.role === "user" ? "items-end flex flex-col" : "")}>
                  <div className={cn(
                    "rounded-xl px-3 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-secondary/60 text-foreground rounded-tl-sm border border-border/30"
                  )}>
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    ) : (
                      <div
                        className="text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    )}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm opacity-70" />
                    )}
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                    msg.role === "user" ? "flex-row-reverse" : ""
                  )}>
                    <span className="text-[10px] text-muted-foreground">
                      {msg.timestamp.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {msg.role === "assistant" && !msg.isStreaming && (
                      <button onClick={() => copyText(msg.content)} className="text-muted-foreground hover:text-foreground">
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* File context indicator */}
        {openFile && (
          <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50">
            <FileCode className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1">{openFile.path}</span>
            <span className="text-[10px] text-muted-foreground">{openFile.lines} سطر</span>
            {openFile.modified && <Badge variant="outline" className="text-[9px] text-yellow-400 border-yellow-400/50">معدّل</Badge>}
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-3 flex gap-2 items-end flex-shrink-0">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={openFile
              ? `اسألني عن ${openFile.path.split("/").pop()}... (Enter للإرسال)`
              : "اسألني عن الكود أو أي مشكلة... (Enter للإرسال)"}
            className="flex-1 min-h-[42px] max-h-28 resize-none text-sm border-border/50"
            rows={1}
            disabled={isStreaming}
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

      {/* ── Right: Code + Terminal + Fix ───────────────────────────────── */}
      <div className="w-[420px] flex-shrink-0 flex flex-col">
        <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as any)} className="flex flex-col h-full">
          <TabsList className="mx-2 mt-2 flex-shrink-0 grid grid-cols-3">
            <TabsTrigger value="code" className="text-xs gap-1">
              <FileCode className="w-3 h-3" /> الكود
            </TabsTrigger>
            <TabsTrigger value="terminal" className="text-xs gap-1">
              <Terminal className="w-3 h-3" /> Terminal
              {runningCmd && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
            </TabsTrigger>
            <TabsTrigger value="fix" className="text-xs gap-1">
              <Wrench className="w-3 h-3" /> إصلاح
            </TabsTrigger>
          </TabsList>

          {/* Code viewer/editor */}
          <TabsContent value="code" className="flex-1 flex flex-col m-0 mt-0 min-h-0 px-2 pb-2">
            {openFile ? (
              <>
                <div className="flex items-center justify-between py-2 px-1">
                  <span className="text-[11px] text-muted-foreground font-mono truncate">{openFile.path}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveFile}
                    disabled={!openFile.modified}
                    className={cn("h-6 px-2 text-[11px] gap-1", openFile.modified ? "text-yellow-400 border-yellow-400/50" : "")}
                  >
                    <Save className="w-3 h-3" />
                    {openFile.modified ? "حفظ *" : "محفوظ"}
                  </Button>
                </div>
                <div className="flex-1 min-h-0 rounded-md border border-border/50 overflow-hidden">
                  <textarea
                    className="w-full h-full bg-black/40 text-xs font-mono p-3 text-green-200 resize-none focus:outline-none leading-relaxed"
                    value={openFile.content}
                    onChange={(e) => setOpenFile((f) => f ? {
                      ...f,
                      content: e.target.value,
                      modified: e.target.value !== f.savedContent
                    } : f)}
                    spellCheck={false}
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 text-xs gap-1.5 h-7"
                    onClick={() => sendMessage(`اشرح لي الكود في الملف: ${openFile.path}`)}
                    disabled={isStreaming}
                  >
                    <Bot className="w-3 h-3" /> اشرحه
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 text-xs gap-1.5 h-7"
                    onClick={() => sendMessage(`راجع الكود في ${openFile.path} وابحث عن أي مشاكل أو تحسينات ممكنة`)}
                    disabled={isStreaming}
                  >
                    <Bug className="w-3 h-3" /> راجع الأخطاء
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <FolderOpen className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">افتح ملفاً من المستكشف</p>
                <p className="text-xs text-muted-foreground/60 mt-1">اضغط على أي ملف .ts لعرضه وتعديله</p>
              </div>
            )}
          </TabsContent>

          {/* Terminal output */}
          <TabsContent value="terminal" className="flex-1 flex flex-col m-0 min-h-0 px-2 pb-2">
            <div className="flex items-center gap-2 py-2 px-1">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">نتيجة الأمر</span>
              {cmdOutput && (
                <Badge variant="outline" className={cn("text-[9px] mr-auto",
                  cmdOutput.ok ? "text-green-400 border-green-400/50" : "text-red-400 border-red-400/50"
                )}>
                  {cmdOutput.ok ? <CheckCircle className="w-2.5 h-2.5 mr-1" /> : <XCircle className="w-2.5 h-2.5 mr-1" />}
                  {cmdOutput.ok ? "نجح" : "فشل"}
                </Badge>
              )}
            </div>
            <div className="flex-1 min-h-0 rounded-md border border-border/50 bg-black/40 overflow-auto p-3 font-mono text-[11px] leading-relaxed">
              {runningCmd ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> جاري التنفيذ...
                </div>
              ) : cmdOutput ? (
                <>
                  <p className="text-blue-400 mb-2">$ {cmdOutput.cmd}</p>
                  {cmdOutput.stdout && <p className="text-green-300 whitespace-pre-wrap">{cmdOutput.stdout}</p>}
                  {cmdOutput.stderr && <p className="text-red-400 whitespace-pre-wrap mt-1">{cmdOutput.stderr}</p>}
                </>
              ) : (
                <p className="text-muted-foreground/50">اضغط على أمر من القائمة اليسرى لتشغيله</p>
              )}
            </div>
            {cmdOutput?.stderr && !cmdOutput.ok && openFile && (
              <Button
                variant="outline" size="sm"
                className="mt-2 w-full text-xs gap-1.5 h-7 text-orange-400 border-orange-400/50"
                onClick={() => {
                  setAutoFixInput(cmdOutput.stderr);
                  setRightTab("fix");
                }}
              >
                <Zap className="w-3 h-3" /> إصلاح تلقائي بالـ AI
              </Button>
            )}
          </TabsContent>

          {/* Auto Fix */}
          <TabsContent value="fix" className="flex-1 flex flex-col m-0 min-h-0 px-2 pb-2">
            <div className="flex items-center gap-2 py-2 px-1">
              <Wrench className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[11px] text-muted-foreground">إصلاح تلقائي بالـ AI</span>
            </div>

            {!openFile && (
              <div className="mx-1 mb-2 flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/30">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                <span className="text-xs text-yellow-400">افتح الملف المتسبب في الخطأ أولاً</span>
              </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <label className="text-[11px] text-muted-foreground px-1">الخطأ أو المشكلة:</label>
              <Textarea
                value={autoFixInput}
                onChange={(e) => setAutoFixInput(e.target.value)}
                placeholder="الصق رسالة الخطأ هنا أو اشرح المشكلة..."
                className="flex-1 min-h-0 font-mono text-xs resize-none border-border/50 bg-black/20"
                disabled={isStreaming}
              />
              <Button
                onClick={runAutoFix}
                disabled={!openFile || !autoFixInput.trim() || isStreaming}
                className="w-full h-8 text-xs gap-2 bg-orange-600 hover:bg-orange-700 text-white border-0"
              >
                {isStreaming
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري الإصلاح...</>
                  : <><Zap className="w-3.5 h-3.5" /> إصلاح تلقائي</>
                }
              </Button>
              <p className="text-[10px] text-muted-foreground text-center px-2">
                الـ AI سيقرأ الملف المفتوح ويقترح الكود المُصلَح
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
