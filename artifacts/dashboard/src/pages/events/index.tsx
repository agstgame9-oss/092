import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Plus, Play, Square, Trash2, CalendarDays } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ServerEvent {
  id: number;
  name: string;
  description: string;
  type: string;
  status: string;
  guildServerId: string;
  rewardGold: number;
  rewardGems: number;
  rewardXp: number;
  bonusMultiplier: number;
  maxParticipants: number;
  participantCount: number;
  createdAt: string;
  endsAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  ended: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

const TYPE_EMOJI: Record<string, string> = {
  boss_rush: "👹", gold_rush: "💰", xp_boost: "✨",
  summon_rate_up: "💎", pvp_tournament: "⚔️", custom: "🎪",
};

export default function Events() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", type: "custom", guildServerId: "global",
    rewardGold: "", rewardGems: "", rewardXp: "", bonusMultiplier: "1", maxParticipants: "50",
  });

  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: ServerEvent[]; total: number; page: number; totalPages: number }>({
    queryKey: ["events", page],
    queryFn: () => fetch(`/api/events?page=${page}&limit=20`).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { toast.success("Event created!"); setCreateOpen(false); qc.invalidateQueries({ queryKey: ["events"] }); },
    onError: () => toast.error("Failed to create event"),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/events/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: () => { toast.success("Event updated!"); qc.invalidateQueries({ queryKey: ["events"] }); },
    onError: () => toast.error("Failed to update event"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/events/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { toast.success("Event deleted!"); qc.invalidateQueries({ queryKey: ["events"] }); },
    onError: () => toast.error("Failed to delete event"),
  });

  const handleCreate = () => {
    if (!form.name.trim() || !form.description.trim()) { toast.error("Name and description are required"); return; }
    createMut.mutate({
      name: form.name, description: form.description, type: form.type,
      guildServerId: form.guildServerId || "global",
      rewardGold: Number(form.rewardGold) || 0,
      rewardGems: Number(form.rewardGems) || 0,
      rewardXp: Number(form.rewardXp) || 0,
      bonusMultiplier: Number(form.bonusMultiplier) || 1,
      maxParticipants: Number(form.maxParticipants) || 50,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-8 h-8 text-primary" />
            Events
          </h1>
          <p className="text-muted-foreground mt-1">Manage server events and activities.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Create Event
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All Events</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Rewards</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                    </TableRow>
                  ))
                ) : data?.data?.length ? (
                  data.data.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <div className="font-medium">{ev.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{ev.description}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-lg">{TYPE_EMOJI[ev.type] ?? "🎪"}</span>
                        <span className="text-xs text-muted-foreground ml-1">{ev.type}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[ev.status] ?? ""}>
                          {ev.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{ev.participantCount} / {ev.maxParticipants}</TableCell>
                      <TableCell className="text-xs">
                        {ev.rewardGold > 0 && <div>💰 {ev.rewardGold.toLocaleString()}</div>}
                        {ev.rewardGems > 0 && <div>💎 {ev.rewardGems}</div>}
                        {ev.rewardXp > 0 && <div>✨ {ev.rewardXp.toLocaleString()}</div>}
                      </TableCell>
                      <TableCell>
                        {ev.bonusMultiplier > 1 ? <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">🔥 {ev.bonusMultiplier}x</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {ev.status === "upcoming" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-green-500 border-green-500/30"
                              onClick={() => statusMut.mutate({ id: ev.id, status: "active" })}>
                              <Play className="w-3 h-3" /> Start
                            </Button>
                          )}
                          {ev.status === "active" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-red-500 border-red-500/30"
                              onClick={() => statusMut.mutate({ id: ev.id, status: "ended" })}>
                              <Square className="w-3 h-3" /> End
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 px-2 text-destructive border-destructive/30"
                            onClick={() => { if (confirm("Delete this event?")) deleteMut.mutate(ev.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No events found. Create one to get started!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground px-2">{page} / {data.totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>🎪 Create New Event</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Event Name *</Label>
              <Input placeholder="Golden Week Festival" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Textarea placeholder="Describe the event..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">🎪 Custom</SelectItem>
                    <SelectItem value="gold_rush">💰 Gold Rush</SelectItem>
                    <SelectItem value="xp_boost">✨ XP Boost</SelectItem>
                    <SelectItem value="boss_rush">👹 Boss Rush</SelectItem>
                    <SelectItem value="summon_rate_up">💎 Summon Rate Up</SelectItem>
                    <SelectItem value="pvp_tournament">⚔️ PvP Tournament</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Server ID</Label>
                <Input placeholder="guild_server_id" value={form.guildServerId} onChange={e => setForm(f => ({ ...f, guildServerId: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>💰 Gold Reward</Label>
                <Input type="number" placeholder="5000" value={form.rewardGold} onChange={e => setForm(f => ({ ...f, rewardGold: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>💎 Gems Reward</Label>
                <Input type="number" placeholder="20" value={form.rewardGems} onChange={e => setForm(f => ({ ...f, rewardGems: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>✨ XP Reward</Label>
                <Input type="number" placeholder="1000" value={form.rewardXp} onChange={e => setForm(f => ({ ...f, rewardXp: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>🔥 Bonus Multiplier</Label>
                <Input type="number" placeholder="1" value={form.bonusMultiplier} onChange={e => setForm(f => ({ ...f, bonusMultiplier: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>👥 Max Participants</Label>
                <Input type="number" placeholder="50" value={form.maxParticipants} onChange={e => setForm(f => ({ ...f, maxParticipants: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
