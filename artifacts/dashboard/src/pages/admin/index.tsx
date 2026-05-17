import { useState } from "react";
import { useGetAdminLogs, useBroadcastAnnouncement } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, ChevronRight, Megaphone, Terminal, AlertCircle,
  Users, Swords, Coins, Gem, Zap, Ban, ShieldCheck, RotateCcw, Gift, Plus
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type BroadcastType = "info" | "event" | "warning" | "maintenance";

interface Character { id: number; name: string; rarity: string; element1: string; isEnabled: boolean; }

function PlayerActionsTab() {
  const [discordId, setDiscordId] = useState("");
  const [giveType, setGiveType] = useState<"gold" | "gems" | "xp" | "stamina">("gold");
  const [giveAmount, setGiveAmount] = useState("");
  const [banReason, setBanReason] = useState("");
  const [giveCharOpen, setGiveCharOpen] = useState(false);
  const [charSearch, setCharSearch] = useState("");

  const qc = useQueryClient();

  const { data: chars } = useQuery<{ data: Character[] }>({
    queryKey: ["characters-list"],
    queryFn: () => fetch("/api/characters?limit=100").then(r => r.json()),
  });

  const giveMut = useMutation({
    mutationFn: ({ discordId, type, amount }: { discordId: string; type: string; amount: number }) =>
      fetch(`/api/admin/players/${discordId}/give`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: (_, v) => toast.success(`Gave ${v.amount} ${v.type} to player!`),
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const banMut = useMutation({
    mutationFn: ({ discordId, reason }: { discordId: string; reason: string }) =>
      fetch(`/api/admin/players/${discordId}/ban`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { toast.success("Player banned!"); setBanReason(""); },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const unbanMut = useMutation({
    mutationFn: (discordId: string) =>
      fetch(`/api/admin/players/${discordId}/unban`, { method: "POST" })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => toast.success("Player unbanned!"),
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const resetMut = useMutation({
    mutationFn: (discordId: string) =>
      fetch(`/api/admin/players/${discordId}/reset`, { method: "POST" })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => toast.success("Player reset!"),
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const giveCharMut = useMutation({
    mutationFn: ({ discordId, characterId }: { discordId: string; characterId: number }) =>
      fetch(`/api/admin/players/${discordId}/give-character`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: (data) => { toast.success(`Gave ${data.character} to player!`); setGiveCharOpen(false); },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const filteredChars = chars?.data?.filter(c => c.name.toLowerCase().includes(charSearch.toLowerCase())) ?? [];

  const RARITY_COLORS: Record<string, string> = {
    "D": "#6B7280", "C": "#10B981", "B": "#3B82F6", "A": "#8B5CF6",
    "S": "#F59E0B", "SS": "#F97316", "SSS": "#EF4444", "SSS+": "#EC4899",
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gift className="w-4 h-4" /> Give Resources</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Player Discord ID</Label>
              <Input placeholder="123456789012345678" value={discordId} onChange={e => setDiscordId(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={giveType} onValueChange={v => setGiveType(v as typeof giveType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">💰 Gold</SelectItem>
                    <SelectItem value="gems">💎 Gems</SelectItem>
                    <SelectItem value="xp">✨ XP</SelectItem>
                    <SelectItem value="stamina">⚡ Stamina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input type="number" placeholder="1000" value={giveAmount} onChange={e => setGiveAmount(e.target.value)} />
              </div>
            </div>
            <Button className="w-full gap-2" onClick={() => {
              if (!discordId.trim() || !giveAmount) { toast.error("Fill in all fields"); return; }
              giveMut.mutate({ discordId: discordId.trim(), type: giveType, amount: Number(giveAmount) });
            }} disabled={giveMut.isPending}>
              <Gift className="w-4 h-4" /> {giveMut.isPending ? "Sending..." : "Give to Player"}
            </Button>
            <Button className="w-full gap-2" variant="outline" onClick={() => {
              if (!discordId.trim()) { toast.error("Enter a Discord ID"); return; }
              setGiveCharOpen(true);
            }}>
              <Swords className="w-4 h-4" /> Give Character
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-destructive"><Ban className="w-4 h-4" /> Player Management</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Player Discord ID</Label>
              <Input placeholder="123456789012345678" value={discordId} onChange={e => setDiscordId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Ban Reason (optional)</Label>
              <Input placeholder="Cheating / harassment..." value={banReason} onChange={e => setBanReason(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="destructive" className="gap-1" size="sm" onClick={() => {
                if (!discordId.trim()) { toast.error("Enter a Discord ID"); return; }
                banMut.mutate({ discordId: discordId.trim(), reason: banReason || "No reason given" });
              }} disabled={banMut.isPending}>
                <Ban className="w-3 h-3" /> Ban
              </Button>
              <Button variant="outline" className="gap-1 text-green-500 border-green-500/30" size="sm" onClick={() => {
                if (!discordId.trim()) { toast.error("Enter a Discord ID"); return; }
                unbanMut.mutate(discordId.trim());
              }} disabled={unbanMut.isPending}>
                <ShieldCheck className="w-3 h-3" /> Unban
              </Button>
              <Button variant="outline" className="gap-1 text-orange-500 border-orange-500/30" size="sm" onClick={() => {
                if (!discordId.trim()) { toast.error("Enter a Discord ID"); return; }
                if (confirm("Reset this player to starting stats?")) resetMut.mutate(discordId.trim());
              }} disabled={resetMut.isPending}>
                <RotateCcw className="w-3 h-3" /> Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={giveCharOpen} onOpenChange={setGiveCharOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>🎭 Give Character to Player</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Search character..." value={charSearch} onChange={e => setCharSearch(e.target.value)} />
            <div className="max-h-64 overflow-y-auto space-y-1 rounded border p-2">
              {filteredChars.slice(0, 30).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-secondary cursor-pointer"
                  onClick={() => { if (!discordId.trim()) { toast.error("Enter a Discord ID first"); return; } giveCharMut.mutate({ discordId: discordId.trim(), characterId: c.id }); }}>
                  <span className="font-medium text-sm">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs" style={{ color: RARITY_COLORS[c.rarity] }}>{c.rarity}</Badge>
                    <span className="text-xs text-muted-foreground">{c.element1}</span>
                  </div>
                </div>
              ))}
              {filteredChars.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No characters found</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGiveCharOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CharacterManagementTab() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", animeSource: "", rarity: "S", element1: "Fire", element2: "" });

  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Character[]; totalPages: number }>({
    queryKey: ["admin-characters", page],
    queryFn: () => fetch(`/api/characters?page=${page}&limit=20`).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/characters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { toast.success("Character created!"); setCreateOpen(false); qc.invalidateQueries({ queryKey: ["admin-characters"] }); },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/characters/${id}/toggle`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { toast.success("Toggled!"); qc.invalidateQueries({ queryKey: ["admin-characters"] }); },
    onError: () => toast.error("Failed to toggle"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/characters/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { toast.success("Deleted!"); qc.invalidateQueries({ queryKey: ["admin-characters"] }); },
    onError: () => toast.error("Failed to delete"),
  });

  const RARITY_COLORS: Record<string, string> = {
    "D": "#6B7280", "C": "#10B981", "B": "#3B82F6", "A": "#8B5CF6",
    "S": "#F59E0B", "SS": "#F97316", "SSS": "#EF4444", "SSS+": "#EC4899",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Create Character</Button>
      </div>
      <Card>
        <CardContent className="pt-4">
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Rarity</TableHead>
                  <TableHead>Element</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                )) : data?.data?.length ? data.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{(c as any).animeSource}</TableCell>
                    <TableCell>
                      <Badge variant="outline" style={{ color: RARITY_COLORS[c.rarity], borderColor: `${RARITY_COLORS[c.rarity]}40`, backgroundColor: `${RARITY_COLORS[c.rarity]}10` }}>{c.rarity}</Badge>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.element1}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={c.isEnabled ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}>
                        {c.isEnabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => toggleMut.mutate(c.id)}>
                          {c.isEnabled ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-destructive border-destructive/30" onClick={() => { if (confirm("Delete this character?")) deleteMut.mutate(c.id); }}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No characters found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm text-muted-foreground">{page} / {data.totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>✨ Create New Character</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Character Name *</Label>
                <Input placeholder="Naruto Uzumaki" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Anime Source *</Label>
                <Input placeholder="Naruto Shippuden" value={form.animeSource} onChange={e => setForm(f => ({ ...f, animeSource: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Rarity</Label>
                <Select value={form.rarity} onValueChange={v => setForm(f => ({ ...f, rarity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["D","C","B","A","S","SS","SSS","SSS+"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Element 1</Label>
                <Select value={form.element1} onValueChange={v => setForm(f => ({ ...f, element1: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Fire","Water","Earth","Wind","Lightning","Ice","Light","Dark","Chaos","Order","Space","Time"].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Element 2</Label>
                <Select value={form.element2} onValueChange={v => setForm(f => ({ ...f, element2: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {["Fire","Water","Earth","Wind","Lightning","Ice","Light","Dark","Chaos","Order","Space","Time"].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Stats are auto-calculated based on rarity. Skills are auto-generated.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!form.name.trim() || !form.animeSource.trim()) { toast.error("Name and source required"); return; }
              createMut.mutate({ name: form.name, animeSource: form.animeSource, rarity: form.rarity, element1: form.element1, element2: form.element2 || undefined });
            }} disabled={createMut.isPending}>
              {createMut.isPending ? "Creating..." : "Create Character"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Admin() {
  const [logPage, setLogPage] = useState(1);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastType, setBroadcastType] = useState<BroadcastType>("info");

  const { data, isLoading } = useGetAdminLogs({ page: logPage, limit: 20 });
  const broadcastMutation = useBroadcastAnnouncement({
    mutation: {
      onSuccess: () => { toast.success("Announcement broadcasted!"); setBroadcastMsg(""); },
      onError: () => toast.error("Failed to broadcast"),
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
          <Terminal className="w-8 h-8" /> Admin Console
        </h1>
        <p className="text-muted-foreground mt-1">Full control panel — manage players, content, events, and more.</p>
      </div>

      <Tabs defaultValue="players">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="players" className="gap-1"><Users className="w-3.5 h-3.5" /> Players</TabsTrigger>
          <TabsTrigger value="characters" className="gap-1"><Swords className="w-3.5 h-3.5" /> Characters</TabsTrigger>
          <TabsTrigger value="broadcast" className="gap-1"><Megaphone className="w-3.5 h-3.5" /> Broadcast</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1"><AlertCircle className="w-3.5 h-3.5" /> Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-4">
          <PlayerActionsTab />
        </TabsContent>

        <TabsContent value="characters" className="mt-4">
          <CharacterManagementTab />
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4">
          <Card className="max-w-xl border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive"><Megaphone className="w-5 h-5" /> Global Broadcast</CardTitle>
              <CardDescription>Send an announcement to all connected servers immediately.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={e => { e.preventDefault(); if (!broadcastMsg.trim()) return; broadcastMutation.mutate({ data: { message: broadcastMsg, type: broadcastType } }); }} className="space-y-4">
                <div className="space-y-2">
                  <Select value={broadcastType} onValueChange={(v) => setBroadcastType(v as BroadcastType)}>
                    <SelectTrigger><SelectValue placeholder="Announcement Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">ℹ️ Information</SelectItem>
                      <SelectItem value="event">🎪 Event</SelectItem>
                      <SelectItem value="warning">⚠️ Warning</SelectItem>
                      <SelectItem value="maintenance">🔧 Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="Enter announcement message..." value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} />
                <Button type="submit" className="w-full" variant="destructive" disabled={!broadcastMsg.trim() || broadcastMutation.isPending}>
                  {broadcastMutation.isPending ? "Broadcasting..." : "Send to All Servers"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-muted-foreground" /> Audit Log</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto bg-black/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                    )) : data?.data && data.data.length > 0 ? (
                      data.data.map((log) => (
                        <TableRow key={log.id} className="font-mono text-xs">
                          <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="text-primary font-medium">@{log.adminUsername}</TableCell>
                          <TableCell><Badge variant="outline" className="bg-muted text-[10px]">{log.action}</Badge></TableCell>
                          <TableCell className="text-emerald-500">{log.targetUsername || "-"}</TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[200px]">{log.details || log.reason || "-"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No audit logs found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}><ChevronLeft className="h-4 w-4" /> Prev</Button>
                  <div className="text-sm text-muted-foreground px-2">{logPage} / {data.totalPages}</div>
                  <Button variant="outline" size="sm" onClick={() => setLogPage(p => Math.min(data.totalPages, p + 1))} disabled={logPage === data.totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
