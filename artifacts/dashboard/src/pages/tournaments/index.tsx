import { useState } from "react";
import { useGetTournaments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Trophy, Crown } from "lucide-react";

export default function Tournaments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading } = useGetTournaments({
    page,
    limit: 15,
    status: status !== "all" ? status : undefined
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tournaments</h1>
          <p className="text-muted-foreground mt-1">Official brackets and prize pools.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Tournament Events
          </CardTitle>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="registration">Registration</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border rounded-lg p-4 bg-card/50 flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((tourney) => (
                <div key={tourney.id} className="border border-border rounded-lg p-4 bg-secondary/20 hover:bg-secondary/40 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg">{tourney.name}</h3>
                      {tourney.status === 'active' && <Badge className="animate-pulse bg-primary">LIVE</Badge>}
                      {tourney.status === 'registration' && <Badge variant="outline" className="border-emerald-500 text-emerald-500">Signups Open</Badge>}
                      {tourney.status === 'completed' && <Badge variant="secondary">Finished</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-yellow-500" />
                        Prize: {tourney.prizePool.toLocaleString()}g
                      </span>
                      <span>Players: {tourney.size} Max</span>
                      {tourney.status !== 'completed' && <span>Round {tourney.currentRound} / {tourney.totalRounds}</span>}
                      {tourney.status === 'completed' && tourney.winnerUsername && (
                         <span className="flex items-center gap-1 text-emerald-500 font-medium">
                           <Crown className="w-3 h-3" /> Winner: {tourney.winnerUsername}
                         </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0 hidden md:block">
                    ID: #{tourney.id} <br/>
                    {new Date(tourney.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No tournaments found matching criteria.
              </div>
            )}
          </div>
          
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 pt-6">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <div className="text-sm text-muted-foreground px-4">{page} of {data.totalPages}</div>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
