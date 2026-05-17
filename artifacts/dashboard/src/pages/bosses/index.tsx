import { useState } from "react";
import { useGetBosses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ShieldAlert, Skull } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Bosses() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetBosses({ page, limit: 10 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Skull className="w-8 h-8 text-destructive" />
          World Bosses & Abyss
        </h1>
        <p className="text-muted-foreground mt-1">Manage global raid targets and abyss floors.</p>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
           Array.from({ length: 3 }).map((_, i) => (
             <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
           ))
        ) : data?.data && data.data.length > 0 ? (
          data.data.map(boss => (
            <Card key={boss.id} className={`overflow-hidden border-l-4 ${boss.isWorldBoss ? 'border-l-primary' : 'border-l-destructive'}`}>
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className="p-6 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold">{boss.name}</h2>
                      <Badge variant="outline" className="bg-secondary/50">{boss.title}</Badge>
                      {boss.isWorldBoss && <Badge className="bg-primary hover:bg-primary">World Raid</Badge>}
                      {boss.isAbyssBoss && <Badge variant="destructive">Abyss Floor {boss.tier}</Badge>}
                      {!boss.isEnabled && <Badge variant="secondary">Disabled</Badge>}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground mt-4">
                      <span>Source: <span className="text-foreground">{boss.animeSource}</span></span>
                      <span>Element: <Badge variant="outline" className="font-normal text-[10px] h-4 py-0 ml-1">{boss.element1}</Badge></span>
                    </div>
                  </div>
                  <div className="bg-secondary/30 p-6 md:w-[350px] flex flex-col justify-center border-t md:border-t-0 md:border-l border-border">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-muted-foreground">Base HP</span>
                      <span className="font-mono text-destructive">{boss.hp.toLocaleString()}</span>
                    </div>
                    {boss.isWorldBoss ? (
                      <div className="space-y-1">
                        <Progress value={100} className="h-2 bg-secondary [&>div]:bg-destructive" />
                        <p className="text-[10px] text-center text-muted-foreground mt-1">Spawns dynamically based on server config</p>
                      </div>
                    ) : (
                      <div className="text-xs text-center text-muted-foreground py-2 italic border border-dashed border-border rounded">
                        Static Instance
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card/50">
            No bosses found.
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <div className="text-sm text-muted-foreground px-4">{page} of {data.totalPages}</div>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
