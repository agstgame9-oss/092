import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Bug, ShieldCheck, RefreshCw, Wrench, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, Database, Users, Swords, Trophy, Settings,
} from "lucide-react";

interface BugIssue {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  count: number;
  fixable: boolean;
  fixEndpoint?: string;
}

interface ScanResult {
  scannedAt: string;
  totalIssues: number;
  issues: BugIssue[];
}

const SEVERITY_CONFIG = {
  critical: { label: "حرج",   color: "destructive" as const, icon: XCircle,       bg: "bg-red-950/30 border-red-800" },
  high:     { label: "عالي",  color: "destructive" as const, icon: AlertTriangle,  bg: "bg-orange-950/30 border-orange-800" },
  medium:   { label: "متوسط", color: "secondary"  as const, icon: AlertTriangle,  bg: "bg-yellow-950/30 border-yellow-800" },
  low:      { label: "منخفض", color: "secondary"  as const, icon: ShieldCheck,    bg: "bg-blue-950/30 border-blue-800" },
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  "اللاعبون":      Users,
  "النقابات":      Trophy,
  "المعارك":       Swords,
  "قاعدة البيانات": Database,
  "الإنجازات":     Trophy,
};

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function BugFixer() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, string>>({});

  const { data: scan, isLoading, refetch, isFetching } = useQuery<ScanResult>({
    queryKey: ["bug-fixer-scan"],
    queryFn: () => apiFetch("/api/bug-fixer/scan"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  async function fixIssue(issue: BugIssue) {
    if (!issue.fixEndpoint) return;
    setFixingId(issue.id);
    try {
      const result = await apiFetch(issue.fixEndpoint, { method: "POST" });
      const msg = result.message ?? "تم الإصلاح!";
      setFixResults((prev) => ({ ...prev, [issue.id]: msg }));
      toast({ title: "✅ تم الإصلاح", description: msg });
      setTimeout(() => refetch(), 800);
    } catch (err: any) {
      toast({ title: "❌ فشل الإصلاح", description: err.message, variant: "destructive" });
    } finally {
      setFixingId(null);
    }
  }

  async function fixAll() {
    if (!scan) return;
    const fixable = scan.issues.filter((i) => i.fixable && i.fixEndpoint);
    for (const issue of fixable) {
      await fixIssue(issue);
    }
  }

  const criticalCount = scan?.issues.filter((i) => i.severity === "critical" || i.severity === "high").length ?? 0;
  const totalFixed = Object.keys(fixResults).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bug className="w-8 h-8 text-red-400" />
            أداة إصلاح الأخطاء المتقدمة
          </h1>
          <p className="text-muted-foreground mt-1">
            فحص تلقائي لمشاكل قاعدة البيانات وإصلاح دفعي في نقرة واحدة
          </p>
        </div>
        <div className="flex gap-2">
          {scan && scan.issues.some((i) => i.fixable) && (
            <Button
              variant="destructive"
              onClick={fixAll}
              disabled={isFetching || fixingId !== null}
              className="gap-2"
            >
              <Wrench className="w-4 h-4" />
              إصلاح الكل
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            إعادة الفحص
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {scan && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-red-400">{criticalCount}</div>
              <div className="text-xs text-muted-foreground mt-1">مشاكل حرجة/عالية</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-yellow-400">{scan.totalIssues}</div>
              <div className="text-xs text-muted-foreground mt-1">إجمالي المشاكل</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-400">{scan.issues.filter((i) => i.fixable).length}</div>
              <div className="text-xs text-muted-foreground mt-1">قابل للإصلاح التلقائي</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-blue-400">{totalFixed}</div>
              <div className="text-xs text-muted-foreground mt-1">تم إصلاحها في هذه الجلسة</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="py-16 text-center">
            <RefreshCw className="w-10 h-10 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">جاري فحص قاعدة البيانات...</p>
          </CardContent>
        </Card>
      )}

      {/* All Clear */}
      {scan && scan.totalIssues === 0 && (
        <Card className="border-green-800 bg-green-950/20">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-400">كل شيء على ما يرام!</h3>
            <p className="text-muted-foreground mt-1">لا توجد مشاكل مكتشفة في قاعدة البيانات.</p>
            <p className="text-xs text-muted-foreground mt-2">
              آخر فحص: {new Date(scan.scannedAt).toLocaleString("ar")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Issues List */}
      {scan && scan.issues.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>آخر فحص: {new Date(scan.scannedAt).toLocaleString("ar")}</span>
          </div>
          {scan.issues.map((issue) => {
            const cfg = SEVERITY_CONFIG[issue.severity];
            const SevIcon = cfg.icon;
            const CatIcon = CATEGORY_ICON[issue.category] ?? Settings;
            const isFixed = !!fixResults[issue.id];
            const isFixing = fixingId === issue.id;

            return (
              <Card
                key={issue.id}
                className={`border transition-all ${isFixed ? "border-green-800 bg-green-950/20 opacity-60" : cfg.bg}`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <SevIcon className={`w-4 h-4 flex-shrink-0 ${
                          issue.severity === "critical" || issue.severity === "high"
                            ? "text-red-400" : issue.severity === "medium" ? "text-yellow-400" : "text-blue-400"
                        }`} />
                        <span className="font-semibold">{issue.title}</span>
                        <Badge variant={isFixed ? "secondary" : cfg.color} className="text-[10px]">
                          {isFixed ? "تم الإصلاح ✓" : cfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <CatIcon className="w-3 h-3" />
                          {issue.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                      {issue.count > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          عدد السجلات المتأثرة: <span className="font-mono font-bold text-foreground">{issue.count.toLocaleString()}</span>
                        </p>
                      )}
                      {fixResults[issue.id] && (
                        <p className="text-xs text-green-400 mt-1">✓ {fixResults[issue.id]}</p>
                      )}
                    </div>
                    {issue.fixable && !isFixed && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => fixIssue(issue)}
                        disabled={isFixing || fixingId !== null}
                        className="flex-shrink-0 gap-1"
                      >
                        {isFixing ? (
                          <><RefreshCw className="w-3 h-3 animate-spin" /> إصلاح...</>
                        ) : (
                          <><Wrench className="w-3 h-3" /> إصلاح</>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            ماذا يفحص هذا الأداة؟
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3" /> لاعبون بأرصدة سالبة (ذهب، جواهر، طاقة)</li>
            <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3" /> سجلات cooldown منتهية الصلاحية تشغل مساحة</li>
            <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3" /> أعضاء نقابات يتيمون (نقاباتهم غير موجودة)</li>
            <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3" /> مراجع نقابة غير صحيحة في بيانات اللاعبين</li>
            <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3" /> معارك عالقة في حالة "قيد التنفيذ" لأكثر من ساعة</li>
            <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3" /> مؤشرات فريق غير متزامنة مع بيانات الشخصيات</li>
            <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3" /> طاقة تتجاوز الحد الأقصى المسموح به</li>
            <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3" /> إنجازات مكررة لنفس اللاعب</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
