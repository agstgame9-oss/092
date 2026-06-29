import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Send, Trash2, Sparkles, Zap, BarChart2,
  FileText, Sword, ShoppingBag, Cpu, RefreshCw,
  Users, Castle, Swords, Activity, ChevronRight,
  Copy, Check, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface GameContext {
  players: number;
  characters: number;
  guilds: number;
  totalBattles: number;
  battlesToday: number;
  activeBoss: { name: string; hp: number; total: number } | null;
  topPlayers: { username: string; level: number; pvpRating: number; gold: number }[];
  topGuilds: { name: string; level: number; treasury: number }[];
}

const QUICK_ACTIONS = [
  { type: "balance",    label: "تحليل التوازن",     icon: BarChart2,  color: "text-blue-400" },
  { type: "patch_note", label: "كتابة Patch Notes", icon: FileText,   color: "text-green-400" },
  { type: "new_char",   label: "شخصية جديدة",        icon: Sword,      color: "text-purple-400" },
  { type: "new_event",  label: "تصميم حدث",           icon: Sparkles,   color: "text-yellow-400" },
  { type: "economy",    label: "تحليل الاقتصاد",     icon: ShoppingBag, color: "text-orange-400" },
  { type: "boss",       label: "وحش عالمي جديد",     icon: Globe,      color: "text-red-400" },
];

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-sm font-mono">$1</code>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1 text-foreground">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold mt-2 mb-1 text-muted-foreground">$1</h4>')
    .replace(/^- (.+)$/gm, '<li class="mr-4 text-sm">• $1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="mr-4 text-sm list-decimal">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function MessageBubble({ msg, onCopy }: { msg: Message; onCopy: (text: string) => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1",
        isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-violet-600 to-blue-600 text-white"
      )}>
        {isUser ? "أنت" : <Bot className="w-4 h-4" />}
      </div>
      <div className={cn("max-w-[80%] space-y-1", isUser ? "items-end flex flex-col" : "")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-secondary text-foreground rounded-tl-sm"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div
              className="prose-sm"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
            />
          )}
          {msg.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current ml-1 animate-pulse rounded-sm" />
          )}
        </div>
        <div className={cn("flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity", isUser ? "flex-row-reverse" : "")}>
          <span className="text-[10px] text-muted-foreground">
            {msg.timestamp.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && !msg.isStreaming && (
            <button
              onClick={() => onCopy(msg.content)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIEngineer() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "مرحباً! أنا **AI Engineer** الخاص بلعبة Anime Multiverse Arena 🎮\n\nأقدر أساعدك في:\n- تحليل بيانات اللعبة وتوازنها\n- كتابة Patch Notes احترافية\n- اقتراح شخصيات وأحداث جديدة\n- تشخيص مشاكل الاقتصاد\n- تصميم وحوش عالمية\n\nاستخدم الأزرار السريعة أو اكتب سؤالك مباشرة! 🚀",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: context } = useQuery<GameContext>({
    queryKey: ["ai-context"],
    queryFn: () => fetch("/api/ai-engineer/context").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "✅ تم النسخ!" });
  }, [toast]);

  async function streamResponse(endpoint: string, body: object) {
    setIsLoading(true);
    const assistantId = `msg_${Date.now()}`;

    setMessages((prev) => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    }]);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.done) break;
            if (data.delta) {
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + data.delta }
                  : m
              ));
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      ));
      setIsLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    setMessages((prev) => [...prev, {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    }]);

    await streamResponse("/api/ai-engineer/chat", { message: text, sessionId });
    textareaRef.current?.focus();
  }

  async function runQuickAction(type: string) {
    if (isLoading) return;
    const action = QUICK_ACTIONS.find((a) => a.type === type);
    const label = action?.label ?? type;

    setMessages((prev) => [...prev, {
      id: `user_quick_${Date.now()}`,
      role: "user",
      content: `⚡ طلب سريع: ${label}`,
      timestamp: new Date(),
    }]);

    await streamResponse("/api/ai-engineer/quick", { type });
  }

  async function clearChat() {
    await fetch("/api/ai-engineer/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setMessages([{
      id: `welcome_${Date.now()}`,
      role: "assistant",
      content: "تم مسح المحادثة. كيف يمكنني مساعدتك؟ 🎮",
      timestamp: new Date(),
    }]);
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col gap-4 p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              AI Engineer
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Cpu className="w-2.5 h-2.5" /> GPT-4o mini
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">مهندس ذكاء اصطناعي متخصص في Anime Multiverse Arena</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="gap-2 text-muted-foreground">
          <Trash2 className="w-3.5 h-3.5" /> مسح المحادثة
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar — Live Stats */}
        <div className="w-52 flex-shrink-0 space-y-3 overflow-y-auto">
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                <Activity className="w-3 h-3" /> إحصائيات مباشرة
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {context ? (
                <>
                  <StatRow icon={Users} label="لاعبون" value={context.players} color="text-blue-400" />
                  <StatRow icon={Sword} label="شخصيات" value={context.characters} color="text-purple-400" />
                  <StatRow icon={Castle} label="نقابات" value={context.guilds} color="text-yellow-400" />
                  <StatRow icon={Swords} label="معارك اليوم" value={context.battlesToday} color="text-red-400" />
                  {context.activeBoss && (
                    <div className="pt-1 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground mb-1">🌋 وحش نشط</p>
                      <p className="text-xs font-medium text-red-400 truncate">{context.activeBoss.name}</p>
                      <div className="w-full bg-secondary rounded-full h-1 mt-1">
                        <div
                          className="bg-red-500 h-1 rounded-full"
                          style={{ width: `${Math.round(context.activeBoss.hp / context.activeBoss.total * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">جاري التحميل...</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                <Zap className="w-3 h-3" /> طلبات سريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3 space-y-1">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.type}
                    onClick={() => runQuickAction(action.type)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary transition-colors text-left disabled:opacity-50"
                  >
                    <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", action.color)} />
                    <span className="text-xs text-foreground">{action.label}</span>
                    <ChevronRight className="w-3 h-3 mr-auto text-muted-foreground" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 border border-border/50 rounded-xl overflow-hidden bg-background/50">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onCopy={handleCopy} />
            ))}
            {isLoading && messages[messages.length - 1]?.isStreaming === false && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <Separator />

          {/* Input */}
          <div className="p-3 flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="اكتب سؤالك... (Enter للإرسال، Shift+Enter لسطر جديد)"
              className="flex-1 min-h-[44px] max-h-32 resize-none text-sm border-border/50 focus-visible:ring-1"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="sm"
              className="h-11 px-4 gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white border-0"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("w-3 h-3", color)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-xs font-semibold tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}
