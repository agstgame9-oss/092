import { useState } from "react";
import { Link } from "wouter";
import { useGetPlayers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
type PlayersSort = "level" | "gold" | "pvpRating" | "wins" | "createdAt";

export default function Players() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<PlayersSort>("level");
  
  const { data, isLoading } = useGetPlayers({
    page,
    limit: 20,
    search: search || undefined,
    sort,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor player accounts.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4">
          <div className="flex items-center w-full max-w-sm gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search players..."
                className="pl-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sort} onValueChange={(v) => setSort(v as PlayersSort)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="level">Level</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="pvpRating">PvP Rating</SelectItem>
                <SelectItem value="wins">Wins</SelectItem>
                <SelectItem value="createdAt">Join Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Gold</TableHead>
                  <TableHead>PvP Rating</TableHead>
                  <TableHead>W/L Ratio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[50px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data && data.data.length > 0 ? (
                  data.data.map((player) => (
                    <TableRow key={player.discordId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {player.username}
                          <span className="text-xs text-muted-foreground font-normal hidden md:inline">
                            {player.discordId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{player.level}</TableCell>
                      <TableCell>{player.gold.toLocaleString()}</TableCell>
                      <TableCell>{player.pvpRating}</TableCell>
                      <TableCell>
                        <span className="text-emerald-500">{player.wins}</span> / <span className="text-destructive">{player.losses}</span>
                      </TableCell>
                      <TableCell>
                        {player.isBanned ? (
                          <Badge variant="destructive">Banned</Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-500 border-emerald-500/20">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/players/${player.discordId}`}>
                          <Button variant="secondary" size="sm">Manage</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No players found.
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
