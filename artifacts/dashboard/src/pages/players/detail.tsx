import { useParams, useLocation } from "wouter";
import { 
  useGetPlayer, 
  useBanPlayer, 
  useModifyPlayer,
  getGetPlayerQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShieldBan, ShieldAlert, Coins, Gem, Swords, Trophy, Target } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function PlayerDetail() {
  const { discordId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetPlayer(discordId!, {
    query: {
      enabled: !!discordId,
      queryKey: getGetPlayerQueryKey(discordId!)
    }
  });

  const banMutation = useBanPlayer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(discordId!) });
        toast.success(`Player ${data?.player.isBanned ? 'unbanned' : 'banned'} successfully`);
        setBanDialogOpen(false);
      },
      onError: (err: any) => {
        toast.error(`Failed to modify ban status: ${err.message || 'Unknown error'}`);
      }
    }
  });

  const modifyMutation = useModifyPlayer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(discordId!) });
        toast.success("Player resources modified");
        setModifyDialogOpen(false);
      },
      onError: (err: any) => {
        toast.error(`Failed to modify resources: ${err.message || 'Unknown error'}`);
      }
    }
  });

  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState("");

  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [modifyForm, setModifyForm] = useState({ gold: "", gems: "", xp: "", reason: "" });

  if (!discordId) return null;

  const handleBanToggle = () => {
    banMutation.mutate({
      discordId,
      data: {
        ban: !data?.player.isBanned,
        reason: banReason || undefined
      }
    });
  };

  const handleModify = (e: React.FormEvent) => {
    e.preventDefault();
    const gold = modifyForm.gold ? parseInt(modifyForm.gold) : undefined;
    const gems = modifyForm.gems ? parseInt(modifyForm.gems) : undefined;
    const xp = modifyForm.xp ? parseInt(modifyForm.xp) : undefined;

    if (!gold && !gems && !xp) {
      toast.error("Please provide at least one resource to modify");
      return;
    }

    modifyMutation.mutate({
      discordId,
      data: {
        gold,
        gems,
        xp,
        reason: modifyForm.reason || undefined
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6 text-center py-12">
        <h2 className="text-2xl font-bold">Player not found</h2>
        <Link href="/players">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Players
          </Button>
        </Link>
      </div>
    );
  }

  const { player, characterCount, totalDamageDealt, maxAbyssFloor, stamina, maxStamina, currentTitle } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/players">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{player.username}</h1>
            {player.isBanned ? (
              <Badge variant="destructive">Banned</Badge>
            ) : (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/20">Active</Badge>
            )}
            {currentTitle && <Badge variant="secondary">{currentTitle}</Badge>}
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{player.discordId}</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                Modify Resources
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modify Player Resources</DialogTitle>
                <DialogDescription>
                  Add or remove resources from {player.username}. Use negative numbers to deduct.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleModify} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gold">Gold Adjustment</Label>
                    <Input 
                      id="gold" 
                      type="number" 
                      placeholder="+/- amount" 
                      value={modifyForm.gold}
                      onChange={e => setModifyForm(f => ({ ...f, gold: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gems">Gems Adjustment</Label>
                    <Input 
                      id="gems" 
                      type="number" 
                      placeholder="+/- amount"
                      value={modifyForm.gems}
                      onChange={e => setModifyForm(f => ({ ...f, gems: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="xp">XP Adjustment</Label>
                    <Input 
                      id="xp" 
                      type="number" 
                      placeholder="+/- amount"
                      value={modifyForm.xp}
                      onChange={e => setModifyForm(f => ({ ...f, xp: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Admin Reason (Logged)</Label>
                  <Input 
                    id="reason" 
                    placeholder="e.g. Compensation for bug"
                    value={modifyForm.reason}
                    onChange={e => setModifyForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setModifyDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={modifyMutation.isPending}>
                    {modifyMutation.isPending ? "Applying..." : "Apply Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
            <DialogTrigger asChild>
              <Button variant={player.isBanned ? "outline" : "destructive"}>
                {player.isBanned ? (
                  <><ShieldBan className="w-4 h-4 mr-2" /> Unban Player</>
                ) : (
                  <><ShieldAlert className="w-4 h-4 mr-2" /> Ban Player</>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{player.isBanned ? "Unban Player" : "Ban Player"}</DialogTitle>
                <DialogDescription>
                  {player.isBanned 
                    ? `Are you sure you want to unban ${player.username}? They will be able to access the game again.`
                    : `Are you sure you want to ban ${player.username}? They will be immediately blocked from all game commands.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="ban-reason">Reason (Optional)</Label>
                  <Input 
                    id="ban-reason" 
                    placeholder="Reason for this action..."
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setBanDialogOpen(false)}>Cancel</Button>
                <Button 
                  variant={player.isBanned ? "default" : "destructive"} 
                  onClick={handleBanToggle}
                  disabled={banMutation.isPending}
                >
                  {banMutation.isPending ? "Processing..." : (player.isBanned ? "Unban Player" : "Ban Player")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Level</CardTitle>
            <Trophy className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{player.level}</div>
            <p className="text-xs text-muted-foreground mt-1">World: {player.currentWorld}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Resources</CardTitle>
            <Coins className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-bold">{player.gold.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Gold</p>
              </div>
              <div className="w-px h-8 bg-border"></div>
              <div>
                <div className="text-2xl font-bold flex items-center gap-1">
                  {player.gems.toLocaleString()}
                  <Gem className="w-3 h-3 text-cyan-400" />
                </div>
                <p className="text-xs text-muted-foreground">Gems</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">PvP Stats</CardTitle>
            <Swords className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-bold">{player.pvpRating}</div>
                <p className="text-xs text-muted-foreground">Rating</p>
              </div>
              <div className="w-px h-8 bg-border"></div>
              <div>
                <div className="text-2xl font-bold">
                  <span className="text-emerald-500">{player.wins}</span><span className="text-muted-foreground text-sm mx-1">/</span><span className="text-destructive">{player.losses}</span>
                </div>
                <p className="text-xs text-muted-foreground">W/L Ratio</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Combat</CardTitle>
            <Target className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-bold">{totalDamageDealt > 1000000 ? `${(totalDamageDealt / 1000000).toFixed(1)}M` : totalDamageDealt.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Damage Dealt</p>
              </div>
              <div className="w-px h-8 bg-border"></div>
              <div>
                <div className="text-2xl font-bold">{maxAbyssFloor}</div>
                <p className="text-xs text-muted-foreground">Max Abyss</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-4 border-b border-border pb-2">
                <dt className="font-medium text-muted-foreground">Discord ID</dt>
                <dd className="col-span-2 font-mono">{player.discordId}</dd>
              </div>
              <div className="grid grid-cols-3 gap-4 border-b border-border pb-2">
                <dt className="font-medium text-muted-foreground">Created At</dt>
                <dd className="col-span-2">{new Date(player.createdAt).toLocaleString()}</dd>
              </div>
              <div className="grid grid-cols-3 gap-4 border-b border-border pb-2">
                <dt className="font-medium text-muted-foreground">Total Characters</dt>
                <dd className="col-span-2">{characterCount}</dd>
              </div>
              <div className="grid grid-cols-3 gap-4 border-b border-border pb-2">
                <dt className="font-medium text-muted-foreground">Stamina</dt>
                <dd className="col-span-2">{stamina} / {maxStamina}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
