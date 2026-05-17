import { useState } from "react";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Swords, Star, Target } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type LeaderboardType = "level" | "pvpRating" | "wins" | "totalDamageDealt";

export default function Leaderboard() {
  const [type, setType] = useState<LeaderboardType>("level");

  const { data, isLoading } = useGetLeaderboard({
    type,
    limit: 50
  });

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400 font-bold bg-yellow-400/10 border-yellow-400/20";
    if (rank === 2) return "text-slate-300 font-bold bg-slate-300/10 border-slate-300/20";
    if (rank === 3) return "text-amber-600 font-bold bg-amber-600/10 border-amber-600/20";
    return "text-muted-foreground border-transparent";
  };

  const getIcon = () => {
    switch (type) {
      case "level": return <Star className="w-5 h-5 text-primary" />;
      case "pvpRating": return <Swords className="w-5 h-5 text-destructive" />;
      case "wins": return <Trophy className="w-5 h-5 text-yellow-500" />;
      case "totalDamageDealt": return <Target className="w-5 h-5 text-emerald-500" />;
    }
  };

  const getValueLabel = () => {
    switch (type) {
      case "level": return "Level";
      case "pvpRating": return "Rating";
      case "wins": return "Wins";
      case "totalDamageDealt": return "Damage";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hall of Fame</h1>
        <p className="text-muted-foreground mt-1">Global player rankings across multiple disciplines.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Button 
          variant={type === "level" ? "default" : "outline"} 
          className="h-12"
          onClick={() => setType("level")}
        >
          <Star className="w-4 h-4 mr-2" /> Top Level
        </Button>
        <Button 
          variant={type === "pvpRating" ? "default" : "outline"} 
          className="h-12"
          onClick={() => setType("pvpRating")}
        >
          <Swords className="w-4 h-4 mr-2" /> Top PvP
        </Button>
        <Button 
          variant={type === "wins" ? "default" : "outline"} 
          className="h-12"
          onClick={() => setType("wins")}
        >
          <Trophy className="w-4 h-4 mr-2" /> Most Wins
        </Button>
        <Button 
          variant={type === "totalDamageDealt" ? "default" : "outline"} 
          className="h-12"
          onClick={() => setType("totalDamageDealt")}
        >
          <Target className="w-4 h-4 mr-2" /> Max Damage
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 uppercase tracking-wider text-sm text-muted-foreground">
            {getIcon()}
            Global Top 50 — {getValueLabel()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-black/20">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/50 hover:bg-transparent">
                  <TableHead className="w-[100px] text-center">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">{getValueLabel()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center"><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-[80px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data && data.length > 0 ? (
                  data.map((entry) => (
                    <TableRow key={entry.discordId} className="border-b border-border/10 hover:bg-secondary/30">
                      <TableCell className="text-center">
                        <div className={cn("inline-flex items-center justify-center w-8 h-8 rounded-full border text-sm", getRankColor(entry.rank))}>
                          #{entry.rank}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={`/players/${entry.discordId}`}>
                            <span className="font-bold text-lg hover:underline cursor-pointer">{entry.username}</span>
                          </Link>
                          {type !== "level" && (
                            <span className="text-xs text-muted-foreground ml-2">Lvl {entry.level}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xl font-medium text-primary">
                        {entry.value.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                      No leaderboard data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
