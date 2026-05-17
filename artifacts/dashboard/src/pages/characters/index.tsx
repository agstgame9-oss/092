import { useState } from "react";
import { useGetCharacters, useGetCharacterRarityDistribution } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const RARITY_COLORS: Record<string, string> = {
  Common: "hsl(240 5% 64.9%)",
  Uncommon: "hsl(142 70% 45%)",
  Rare: "hsl(217 91% 60%)",
  Epic: "hsl(270 100% 65%)",
  Legendary: "hsl(45 93% 47%)",
  Mythic: "hsl(346 87% 55%)"
};

export default function Characters() {
  const [page, setPage] = useState(1);
  const [rarity, setRarity] = useState<string>("all");
  const [element, setElement] = useState<string>("all");

  const { data, isLoading } = useGetCharacters({
    page,
    limit: 20,
    rarity: rarity !== "all" ? rarity : undefined,
    element: element !== "all" ? element : undefined
  });

  const { data: rarityData, isLoading: rarityLoading } = useGetCharacterRarityDistribution();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Characters</h1>
        <p className="text-muted-foreground mt-1">Global character roster and stats.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Rarity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center">
            {rarityLoading ? (
              <Skeleton className="w-full h-full rounded-full" />
            ) : rarityData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rarityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="rarity"
                  >
                    {rarityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={RARITY_COLORS[entry.rarity] || 'hsl(var(--muted))'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-muted-foreground text-sm">No data</span>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle>Character Database</CardTitle>
            <div className="flex gap-2">
              <Select value={rarity} onValueChange={(v) => { setRarity(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Rarity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rarities</SelectItem>
                  <SelectItem value="Common">Common</SelectItem>
                  <SelectItem value="Uncommon">Uncommon</SelectItem>
                  <SelectItem value="Rare">Rare</SelectItem>
                  <SelectItem value="Epic">Epic</SelectItem>
                  <SelectItem value="Legendary">Legendary</SelectItem>
                  <SelectItem value="Mythic">Mythic</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={element} onValueChange={(v) => { setElement(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Element" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Elements</SelectItem>
                  <SelectItem value="Fire">Fire</SelectItem>
                  <SelectItem value="Water">Water</SelectItem>
                  <SelectItem value="Earth">Earth</SelectItem>
                  <SelectItem value="Wind">Wind</SelectItem>
                  <SelectItem value="Light">Light</SelectItem>
                  <SelectItem value="Dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            <div className="rounded-md border flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Rarity</TableHead>
                    <TableHead>Elements</TableHead>
                    <TableHead className="text-right">Stats (H/A/D/S)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-[120px] ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : data?.data && data.data.length > 0 ? (
                    data.data.map((char) => (
                      <TableRow key={char.id}>
                        <TableCell className="font-medium">{char.name}</TableCell>
                        <TableCell className="text-muted-foreground">{char.animeSource}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            style={{ 
                              color: RARITY_COLORS[char.rarity] || 'inherit',
                              borderColor: RARITY_COLORS[char.rarity] ? `${RARITY_COLORS[char.rarity]}40` : undefined,
                              backgroundColor: RARITY_COLORS[char.rarity] ? `${RARITY_COLORS[char.rarity]}10` : undefined
                            }}
                          >
                            {char.rarity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="secondary" className="text-xs font-normal">{char.element1}</Badge>
                            {char.element2 && <Badge variant="secondary" className="text-xs font-normal">{char.element2}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono text-muted-foreground">
                          {char.baseHp} / {char.baseAtk} / {char.baseDef} / {char.baseSpd}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No characters found matching filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <div className="text-sm text-muted-foreground px-2">
                  {page} / {data.totalPages}
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
    </div>
  );
}
