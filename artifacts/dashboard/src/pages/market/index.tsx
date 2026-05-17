import { useState } from "react";
import { useGetMarketListings, useGetMarketStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Store, ArrowUpRight, TrendingUp, Users } from "lucide-react";

const RARITY_COLORS: Record<string, string> = {
  Common: "text-muted-foreground",
  Uncommon: "text-emerald-500",
  Rare: "text-blue-500",
  Epic: "text-purple-500",
  Legendary: "text-amber-500",
  Mythic: "text-rose-500"
};

export default function Market() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("active");

  const { data, isLoading } = useGetMarketListings({
    page,
    limit: 20,
    status: status !== "all" ? status : undefined
  });

  const { data: statsData, isLoading: statsLoading } = useGetMarketStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Global Market</h1>
        <p className="text-muted-foreground mt-1">Player economy and trade network.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <TrendingUp className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold text-yellow-500">{statsData?.totalVolume.toLocaleString()}g</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <Store className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{statsData?.activeListings.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Sold Today</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{statsData?.soldToday.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Average Price</CardTitle>
            <Store className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{statsData?.avgPrice.toLocaleString()}g</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle>Trade Ledger</CardTitle>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-[80px] ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-[60px] ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : data?.data && data.data.length > 0 ? (
                    data.data.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell className="font-medium">
                          <span className={RARITY_COLORS[listing.itemRarity] || ""}>
                            {listing.itemName} {listing.quantity > 1 ? `x${listing.quantity}` : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{listing.sellerUsername}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs uppercase">{listing.itemType}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-yellow-500">
                          {listing.price.toLocaleString()}g
                        </TableCell>
                        <TableCell className="text-right">
                           {listing.status === 'active' ? (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">Active</Badge>
                          ) : listing.status === 'sold' ? (
                            <Badge variant="secondary">Sold</Badge>
                          ) : (
                            <Badge variant="destructive">Expired</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No market listings found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-end space-x-2 pt-4">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <div className="text-sm text-muted-foreground px-2">{page} / {data.totalPages}</div>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Top Merchants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : statsData?.topSellers && statsData.topSellers.length > 0 ? (
              <div className="space-y-4">
                {statsData.topSellers.map((seller, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <span className="font-medium text-sm">{seller.username}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{seller.salesCount} sales</span>
                  </div>
                ))}
              </div>
            ) : (
               <div className="text-center py-8 text-muted-foreground text-sm">No merchant data</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
