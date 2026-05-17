import { useState } from "react";
import { useGetBattles, useGetBattleStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Swords } from "lucide-react";
import { Link } from "wouter";

export default function Battles() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading } = useGetBattles({
    page,
    limit: 20,
    type: type !== "all" ? type : undefined,
    status: status !== "all" ? status : undefined
  });

  const { data: statsData, isLoading: statsLoading } = useGetBattleStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Battles</h1>
        <p className="text-muted-foreground mt-1">Live and historical combat logs.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))
        ) : statsData ? (
          statsData.map((stat) => (
            <Card key={stat.type}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium capitalize">{stat.type} Battles</CardTitle>
                <Swords className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.count.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4">
          <CardTitle>Combat Log</CardTitle>
          <div className="flex gap-2">
            <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pve">PvE</SelectItem>
                <SelectItem value="pvp">PvP</SelectItem>
                <SelectItem value="boss">Boss</SelectItem>
                <SelectItem value="abyss">Abyss</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="forfeited">Forfeited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Combatants</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Turns</TableHead>
                  <TableHead>Rewards</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-[40px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[40px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[100px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data && data.data.length > 0 ? (
                  data.data.map((battle) => (
                    <TableRow key={battle.id}>
                      <TableCell className="font-mono text-muted-foreground text-xs">#{battle.id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="uppercase text-xs">{battle.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={`/players/${battle.player1DiscordId}`}>
                            <span className="hover:underline cursor-pointer text-primary">
                              {battle.player1DiscordId.substring(0,8)}
                            </span>
                          </Link>
                          {battle.player2DiscordId ? (
                            <>
                              <span className="text-muted-foreground text-xs">vs</span>
                              <Link href={`/players/${battle.player2DiscordId}`}>
                                <span className="hover:underline cursor-pointer text-destructive">
                                  {battle.player2DiscordId.substring(0,8)}
                                </span>
                              </Link>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">vs AI</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {battle.status === 'active' ? (
                          <Badge variant="outline" className="text-primary border-primary/20 animate-pulse">Active</Badge>
                        ) : battle.status === 'completed' ? (
                          <Badge variant="outline" className="text-muted-foreground border-border">Completed</Badge>
                        ) : (
                          <Badge variant="destructive">Forfeited</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono">{battle.turnNumber}</TableCell>
                      <TableCell>
                        {battle.status === 'completed' && (
                          <div className="flex flex-col gap-1 text-xs">
                            {battle.xpEarned ? <span className="text-primary">+{battle.xpEarned} XP</span> : null}
                            {battle.goldEarned ? <span className="text-yellow-500">+{battle.goldEarned}g</span> : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(battle.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No battles found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm text-muted-foreground px-4">
                Page {page} of {data.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
