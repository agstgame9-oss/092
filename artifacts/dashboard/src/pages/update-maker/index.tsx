import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wand2, Swords, ShieldAlert, Package, Coins, Gift, Megaphone,
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, CheckCircle2,
  XCircle, Loader2, ChevronDown, ChevronUp, Globe, Sparkles, Send,
  History, Star, Rocket, Zap, Shield, Radio, AlertTriangle,
  BookOpen, Bug, MoreHorizontal, CheckCheck, ServerCrash, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API = "/api/update-maker";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

const RARITIES = ["D", "C", "B", "A", "S", "SS", "SSS", "SSS+"];
const ELEMENTS = ["Fire", "Water", "Earth", "Wind", "Lightning", "Ice", "Light", "Dark", "Chaos", "Order", "Space", "Time"];
const ITEM_TYPES = ["weapon", "armor", "accessory", "consumable", "material", "summon_ticket", "currency", "key", "special"];

const RARITY_COLORS: Record<string, string> = {
  "D": "bg-zinc-500",
  "C": "bg-green-600",
  "B": "bg-blue-600",
  "A": "bg-violet-600",
  "S": "bg-yellow-500",
  "SS": "bg-orange-500",
  "SSS": "bg-red-500",
  "SSS+": "bg-pink-500",
};

// ─────────────────────────────────────────────
// CHARACTERS TAB
// ─────────────────────────────────────────────

function defaultCharacterForm() {
  return {
    name: "", animeSource: "", rarity: "C", element1: "Fire", element2: "",
    baseHp: 1000, baseAtk: 200, baseDef: 100, baseSpd: 100,
    baseCrit: 0.05, baseCritDmg: 1.5, imageUrl: "", isEnabled: true,
    skill1: { name: "Strike", description: "A basic attack.", energyCost: 20, cooldown: 0, damage: 1.0, type: "damage", target: "single", effect: {} },
    skill2: { name: "Blast", description: "A powerful attack.", energyCost: 40, cooldown: 1, damage: 1.8, type: "damage", target: "single", effect: {} },
    skill3: { name: "Ultimate", description: "The ultimate move.", energyCost: 80, cooldown: 3, damage: 3.0, type: "damage", target: "all", effect: {} },
    passive: { name: "Resolve", description: "Passive ability.", trigger: "battle_start", effect: { stat: "atk", multiplier: 1.05 } },
  };
}

function CharacterFormModal({ open, onClose, initial, onSave }: {
  open: boolean; onClose: () => void;
  initial?: Record<string, unknown> | null;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(initial ?? defaultCharacterForm() as unknown as Record<string, unknown>);
  const [saving, setSaving] = useState(false);

  function set(key: string, val: unknown) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Character" : "Add New Character"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={String(form.name ?? "")} onChange={e => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Anime Source</Label>
            <Input value={String(form.animeSource ?? "")} onChange={e => set("animeSource", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Rarity</Label>
            <Select value={String(form.rarity ?? "C")} onValueChange={v => set("rarity", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RARITIES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Element 1</Label>
            <Select value={String(form.element1 ?? "Fire")} onValueChange={v => set("element1", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ELEMENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Element 2 (optional)</Label>
            <Select value={String(form.element2 ?? "")} onValueChange={v => set("element2", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {ELEMENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Image URL</Label>
            <Input value={String(form.imageUrl ?? "")} onChange={e => set("imageUrl", e.target.value)} placeholder="https://..." />
          </div>

          <div className="col-span-2 border-t pt-3">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Base Stats</p>
            <div className="grid grid-cols-3 gap-3">
              {(["baseHp", "baseAtk", "baseDef", "baseSpd"] as const).map(stat => (
                <div key={stat} className="space-y-1">
                  <Label className="capitalize">{stat.replace("base", "")}</Label>
                  <Input type="number" value={Number(form[stat] ?? 0)} onChange={e => set(stat, Number(e.target.value))} />
                </div>
              ))}
              <div className="space-y-1">
                <Label>Crit %</Label>
                <Input type="number" step="0.01" value={Number(form.baseCrit ?? 0.05)} onChange={e => set("baseCrit", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Crit DMG</Label>
                <Input type="number" step="0.1" value={Number(form.baseCritDmg ?? 1.5)} onChange={e => set("baseCritDmg", Number(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="col-span-2 border-t pt-3">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Skills (JSON)</p>
            {(["skill1", "skill2", "skill3"] as const).map((sk, i) => (
              <div key={sk} className="space-y-1 mb-2">
                <Label>Skill {i + 1}</Label>
                <Textarea
                  className="font-mono text-xs"
                  rows={3}
                  value={typeof form[sk] === "string" ? String(form[sk]) : JSON.stringify(form[sk], null, 2)}
                  onChange={e => { try { set(sk, JSON.parse(e.target.value)); } catch { set(sk, e.target.value); } }}
                />
              </div>
            ))}
          </div>

          <div className="col-span-2 border-t pt-3">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Passive (JSON)</p>
            <Textarea
              className="font-mono text-xs"
              rows={3}
              value={typeof form.passive === "string" ? String(form.passive) : JSON.stringify(form.passive, null, 2)}
              onChange={e => { try { set("passive", JSON.parse(e.target.value)); } catch { set("passive", e.target.value); } }}
            />
          </div>

          <div className="col-span-2 flex items-center gap-3 border-t pt-3">
            <Switch checked={Boolean(form.isEnabled)} onCheckedChange={v => set("isEnabled", v)} />
            <Label>Enabled in summon pool</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initial ? "Save Changes" : "Create Character"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CharactersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; data: Record<string, unknown> | null }>({ open: false, data: null });
  const [search, setSearch] = useState("");

  const { data: characters = [], isLoading } = useQuery({
    queryKey: ["um-characters"],
    queryFn: () => apiFetch(`${API}/characters`),
  });

  const filtered = (characters as Record<string, unknown>[]).filter((c) =>
    search === "" ||
    String(c.name).toLowerCase().includes(search.toLowerCase()) ||
    String(c.animeSource).toLowerCase().includes(search.toLowerCase())
  );

  const saveMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data.id
        ? apiFetch(`${API}/characters/${data.id}`, { method: "PUT", body: JSON.stringify(data) })
        : apiFetch(`${API}/characters`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["um-characters"] });
      toast({ title: vars.id ? "Character updated" : "Character created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/characters/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-characters"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/characters/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["um-characters"] }); toast({ title: "Character deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search characters…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => setModal({ open: true, data: null })}>
          <Plus className="w-4 h-4 mr-2" /> Add Character
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No characters found. Add one to get started.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((char) => (
            <div key={String(char.id)} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
              {char.imageUrl ? (
                <img src={String(char.imageUrl)} alt={String(char.name)} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                  <Swords className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{String(char.name)}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold text-white", RARITY_COLORS[String(char.rarity)] ?? "bg-zinc-500")}>
                    {String(char.rarity)}
                  </span>
                  <Badge variant="outline" className="text-xs">{String(char.element1)}</Badge>
                  {Boolean(char.element2) && <Badge variant="outline" className="text-xs">{String(char.element2)}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{String(char.animeSource)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  HP: {Number(char.baseHp).toLocaleString()} · ATK: {Number(char.baseAtk)} · DEF: {Number(char.baseDef)} · SPD: {Number(char.baseSpd)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleMut.mutate(Number(char.id))}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={char.isEnabled ? "Disable" : "Enable"}
                >
                  {char.isEnabled
                    ? <ToggleRight className="w-6 h-6 text-green-500" />
                    : <ToggleLeft className="w-6 h-6" />}
                </button>
                <Button size="sm" variant="outline" onClick={() => setModal({ open: true, data: char })}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                  onClick={() => { if (confirm(`Delete ${char.name}?`)) deleteMut.mutate(Number(char.id)); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CharacterFormModal
        open={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        initial={modal.data}
        onSave={(data) => saveMut.mutateAsync({ ...modal.data, ...data })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// BOSSES TAB
// ─────────────────────────────────────────────

function defaultBossForm() {
  return {
    name: "", title: "", animeSource: "", element1: "Fire", element2: "",
    tier: "normal", hp: 50000, atk: 800, def: 400, spd: 120,
    crit: 0.1, critDmg: 1.8,
    phases: [], weaknesses: [], resistances: [], immunities: [],
    skills: [{ name: "Strike", description: "Boss attack", damage: 1.5, energyCost: 30, cooldown: 1 }],
    passive: "Boss passive ability.",
    lootTable: [{ itemType: "gold", itemName: "Gold", chance: 1.0, quantity: 500 }],
    xpReward: 500, goldReward: 300, imageUrl: "",
    isWorldBoss: false, isAbyssBoss: false, abyssFloor: null, isEnabled: true,
  };
}

function BossFormModal({ open, onClose, initial, onSave }: {
  open: boolean; onClose: () => void;
  initial?: Record<string, unknown> | null;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(initial ?? defaultBossForm() as unknown as Record<string, unknown>);
  const [saving, setSaving] = useState(false);

  function set(key: string, val: unknown) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave() {
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit Boss" : "Add New Boss"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Name</Label><Input value={String(form.name ?? "")} onChange={e => set("name", e.target.value)} /></div>
          <div className="space-y-1"><Label>Title</Label><Input value={String(form.title ?? "")} onChange={e => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label>Anime Source</Label><Input value={String(form.animeSource ?? "")} onChange={e => set("animeSource", e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Tier</Label>
            <Select value={String(form.tier ?? "normal")} onValueChange={v => set("tier", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["normal", "elite", "raid", "world", "abyss"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Element 1</Label>
            <Select value={String(form.element1 ?? "Fire")} onValueChange={v => set("element1", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ELEMENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Element 2</Label>
            <Select value={String(form.element2 ?? "")} onValueChange={v => set("element2", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {ELEMENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 border-t pt-3">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Stats</p>
            <div className="grid grid-cols-3 gap-3">
              {(["hp", "atk", "def", "spd", "xpReward", "goldReward"] as const).map(stat => (
                <div key={stat} className="space-y-1">
                  <Label className="capitalize">{stat.replace(/([A-Z])/g, " $1")}</Label>
                  <Input type="number" value={Number(form[stat] ?? 0)} onChange={e => set(stat, Number(e.target.value))} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1"><Label>Image URL</Label><Input value={String(form.imageUrl ?? "")} onChange={e => set("imageUrl", e.target.value)} placeholder="https://..." /></div>

          <div className="col-span-2 border-t pt-3 space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">JSON Fields</p>
            {(["skills", "phases", "lootTable", "weaknesses", "resistances", "immunities"] as const).map(field => (
              <div key={field} className="space-y-1">
                <Label className="capitalize">{field}</Label>
                <Textarea className="font-mono text-xs" rows={2}
                  value={typeof form[field] === "string" ? String(form[field]) : JSON.stringify(form[field], null, 2)}
                  onChange={e => { try { set(field, JSON.parse(e.target.value)); } catch { set(field, e.target.value); } }}
                />
              </div>
            ))}
            <div className="space-y-1"><Label>Passive (text)</Label><Input value={String(form.passive ?? "")} onChange={e => set("passive", e.target.value)} /></div>
          </div>

          <div className="col-span-2 border-t pt-3 flex flex-wrap gap-6">
            <div className="flex items-center gap-2"><Switch checked={Boolean(form.isWorldBoss)} onCheckedChange={v => set("isWorldBoss", v)} /><Label>World Boss</Label></div>
            <div className="flex items-center gap-2"><Switch checked={Boolean(form.isAbyssBoss)} onCheckedChange={v => set("isAbyssBoss", v)} /><Label>Abyss Boss</Label></div>
            <div className="flex items-center gap-2"><Switch checked={Boolean(form.isEnabled)} onCheckedChange={v => set("isEnabled", v)} /><Label>Enabled</Label></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initial ? "Save Changes" : "Create Boss"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BossesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; data: Record<string, unknown> | null }>({ open: false, data: null });

  const { data: bosses = [], isLoading } = useQuery({
    queryKey: ["um-bosses"],
    queryFn: () => apiFetch(`${API}/bosses`),
  });

  const saveMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data.id
        ? apiFetch(`${API}/bosses/${data.id}`, { method: "PUT", body: JSON.stringify(data) })
        : apiFetch(`${API}/bosses`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["um-bosses"] }); toast({ title: vars.id ? "Boss updated" : "Boss created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/bosses/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-bosses"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/bosses/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["um-bosses"] }); toast({ title: "Boss deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModal({ open: true, data: null })}>
          <Plus className="w-4 h-4 mr-2" /> Add Boss
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (bosses as Record<string, unknown>[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No bosses yet. Add one to get started.</div>
      ) : (
        <div className="grid gap-3">
          {(bosses as Record<string, unknown>[]).map(boss => (
            <div key={String(boss.id)} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
              {boss.imageUrl ? (
                <img src={String(boss.imageUrl)} alt={String(boss.name)} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{String(boss.name)}</span>
                  <Badge variant="outline" className="text-xs capitalize">{String(boss.tier)}</Badge>
                  {Boolean(boss.isWorldBoss) && <Badge className="text-xs bg-purple-600">World</Badge>}
                  {Boolean(boss.isAbyssBoss) && <Badge className="text-xs bg-red-700">Abyss</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{String(boss.title)} · {String(boss.animeSource)}</p>
                <p className="text-xs text-muted-foreground">HP: {Number(boss.hp).toLocaleString()} · ATK: {Number(boss.atk)} · XP: {Number(boss.xpReward)} · Gold: {Number(boss.goldReward)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleMut.mutate(Number(boss.id))}>
                  {boss.isEnabled ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                </button>
                <Button size="sm" variant="outline" onClick={() => setModal({ open: true, data: boss })}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                  onClick={() => { if (confirm(`Delete ${boss.name}?`)) deleteMut.mutate(Number(boss.id)); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <BossFormModal
        open={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        initial={modal.data}
        onSave={data => saveMut.mutateAsync({ ...modal.data, ...data })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// ITEMS TAB
// ─────────────────────────────────────────────

function ItemsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ name: "", description: "", type: "consumable", rarity: "C", baseValue: 100, isStackable: true, isTradeable: true, maxStack: 999, imageUrl: "" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["um-items"],
    queryFn: () => apiFetch(`${API}/items`),
  });

  function openAdd() { setEditing(null); setForm({ name: "", description: "", type: "consumable", rarity: "C", baseValue: 100, isStackable: true, isTradeable: true, maxStack: 999, imageUrl: "" }); setModal(true); }
  function openEdit(item: Record<string, unknown>) {
    setEditing(item);
    setForm({ name: String(item.name ?? ""), description: String(item.description ?? ""), type: String(item.type ?? "consumable"), rarity: String(item.rarity ?? "C"), baseValue: Number(item.baseValue ?? 100), isStackable: Boolean(item.isStackable ?? true), isTradeable: Boolean(item.isTradeable ?? true), maxStack: Number(item.maxStack ?? 999), imageUrl: String(item.imageUrl ?? "") });
    setModal(true);
  }

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? apiFetch(`${API}/items/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
        : apiFetch(`${API}/items`, { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["um-items"] }); setModal(false); toast({ title: editing ? "Item updated" : "Item created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/items/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["um-items"] }); toast({ title: "Item deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (items as Record<string, unknown>[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No items yet.</div>
      ) : (
        <div className="grid gap-3">
          {(items as Record<string, unknown>[]).map(item => (
            <div key={String(item.id)} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
              <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{String(item.name)}</span>
                  <Badge variant="outline" className="text-xs capitalize">{String(item.type)}</Badge>
                  <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold text-white", RARITY_COLORS[String(item.rarity)] ?? "bg-zinc-500")}>{String(item.rarity)}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{String(item.description)}</p>
                <p className="text-xs text-muted-foreground">Value: {Number(item.baseValue).toLocaleString()} gold</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                  onClick={() => { if (confirm(`Delete ${item.name}?`)) deleteMut.mutate(Number(item.id)); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modal} onOpenChange={v => !v && setModal(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Item" : "Add New Item"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rarity</Label>
              <Select value={form.rarity} onValueChange={v => setForm(f => ({ ...f, rarity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RARITIES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Base Value (gold)</Label><Input type="number" value={form.baseValue} onChange={e => setForm(f => ({ ...f, baseValue: Number(e.target.value) }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Image URL</Label><Input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Max Stack</Label><Input type="number" value={form.maxStack} onChange={e => setForm(f => ({ ...f, maxStack: Number(e.target.value) }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.isStackable} onCheckedChange={v => setForm(f => ({ ...f, isStackable: v }))} /><Label>Stackable</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isTradeable} onCheckedChange={v => setForm(f => ({ ...f, isTradeable: v }))} /><Label>Tradeable</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// ECONOMY TAB
// ─────────────────────────────────────────────

function EconomyTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingSettings, setEditingSettings] = useState<Record<string, unknown>>({});
  const [globalForm, setGlobalForm] = useState({ xpMultiplier: 1, goldMultiplier: 1, staminaRegenRate: 6, allowPvp: true, allowMarket: true, allowGuilds: true, allowTournaments: true, allowWorldBoss: true });

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["um-economy"],
    queryFn: () => apiFetch(`${API}/economy`),
  });

  const updateMut = useMutation({
    mutationFn: ({ guildId, settings }: { guildId: string; settings: Record<string, unknown> }) =>
      apiFetch(`${API}/economy/${guildId}`, { method: "PUT", body: JSON.stringify({ settings }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["um-economy"] }); toast({ title: "Server settings updated" }); setExpanded(null); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const applyAllMut = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      apiFetch(`${API}/economy/apply-all`, { method: "POST", body: JSON.stringify({ settings }) }),
    onSuccess: (data: Record<string, unknown>) => { qc.invalidateQueries({ queryKey: ["um-economy"] }); toast({ title: `Applied to ${data.updatedCount} server(s)` }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(config: Record<string, unknown>) {
    setExpanded(String(config.guildId));
    setEditingSettings({ ...(config.settings as object) });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> Apply to All Servers</CardTitle>
          <CardDescription>Push these settings to every server at once — ideal for global economy events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>XP Multiplier</Label>
              <Input type="number" step="0.1" min="0.1" max="10" value={globalForm.xpMultiplier}
                onChange={e => setGlobalForm(f => ({ ...f, xpMultiplier: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Gold Multiplier</Label>
              <Input type="number" step="0.1" min="0.1" max="10" value={globalForm.goldMultiplier}
                onChange={e => setGlobalForm(f => ({ ...f, goldMultiplier: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Stamina Regen (mins/pt)</Label>
              <Input type="number" min="1" max="60" value={globalForm.staminaRegenRate}
                onChange={e => setGlobalForm(f => ({ ...f, staminaRegenRate: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {(["allowPvp", "allowMarket", "allowGuilds", "allowTournaments", "allowWorldBoss"] as const).map(key => (
              <div key={key} className="flex items-center gap-2">
                <Switch checked={Boolean(globalForm[key])} onCheckedChange={v => setGlobalForm(f => ({ ...f, [key]: v }))} />
                <Label className="capitalize">{key.replace("allow", "")}</Label>
              </div>
            ))}
          </div>
          <Button onClick={() => applyAllMut.mutate(globalForm as unknown as Record<string, unknown>)} disabled={applyAllMut.isPending}>
            {applyAllMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Apply to All Servers
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="font-semibold mb-3">Per-Server Settings</h3>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (configs as Record<string, unknown>[]).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No servers configured yet. Players need to run /setup in their server.</div>
        ) : (
          <div className="space-y-2">
            {(configs as Record<string, unknown>[]).map(config => {
              const settings = (config.settings ?? {}) as Record<string, unknown>;
              const isOpen = expanded === String(config.guildId);
              return (
                <div key={String(config.guildId)} className="border border-border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/50 transition-colors"
                    onClick={() => isOpen ? setExpanded(null) : openEdit(config)}
                  >
                    <div>
                      <span className="font-medium">{String(config.guildName ?? config.guildId)}</span>
                      <span className="text-xs text-muted-foreground ml-2">ID: {String(config.guildId)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {Number(settings.xpMultiplier ?? 1)}x XP · {Number(settings.goldMultiplier ?? 1)}x Gold
                      </span>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border p-4 bg-card space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        {(["xpMultiplier", "goldMultiplier", "staminaRegenRate"] as const).map(k => (
                          <div key={k} className="space-y-1">
                            <Label className="text-xs">{k === "staminaRegenRate" ? "Stamina Regen (min)" : k === "xpMultiplier" ? "XP Mult" : "Gold Mult"}</Label>
                            <Input type="number" step="0.1" value={Number(editingSettings[k] ?? settings[k] ?? 1)}
                              onChange={e => setEditingSettings(s => ({ ...s, [k]: Number(e.target.value) }))} />
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {(["allowPvp", "allowMarket", "allowGuilds", "allowTournaments", "allowWorldBoss"] as const).map(k => (
                          <div key={k} className="flex items-center gap-2">
                            <Switch
                              checked={Boolean(editingSettings[k] !== undefined ? editingSettings[k] : settings[k])}
                              onCheckedChange={v => setEditingSettings(s => ({ ...s, [k]: v }))}
                            />
                            <Label className="text-sm capitalize">{k.replace("allow", "")}</Label>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateMut.mutate({ guildId: String(config.guildId), settings: editingSettings })} disabled={updateMut.isPending}>
                          {updateMut.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setExpanded(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REWARDS TAB
// ─────────────────────────────────────────────

function RewardsTab() {
  const { toast } = useToast();
  const [searchQ, setSearchQ] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Record<string, unknown> | null>(null);
  const [reward, setReward] = useState({ gold: 0, gems: 0, xp: 0, stamina: 0, reason: "" });
  const [success, setSuccess] = useState<Record<string, unknown> | null>(null);

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ["um-player-search", searchQ],
    queryFn: () => searchQ.length >= 2 ? apiFetch(`${API}/players/search?q=${encodeURIComponent(searchQ)}`) : Promise.resolve([]),
    enabled: searchQ.length >= 2,
  });

  const rewardMut = useMutation({
    mutationFn: () => apiFetch(`${API}/rewards`, {
      method: "POST",
      body: JSON.stringify({ discordId: selectedPlayer?.discordId, ...reward }),
    }),
    onSuccess: (data: Record<string, unknown>) => {
      setSuccess(data.player as Record<string, unknown>);
      setReward({ gold: 0, gems: 0, xp: 0, stamina: 0, reason: "" });
      toast({ title: `Rewards sent to ${(data.player as Record<string, unknown>)?.username}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">1. Find Player</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by username or Discord ID…" value={searchQ} onChange={e => { setSearchQ(e.target.value); setSelectedPlayer(null); setSuccess(null); }} />
          </div>
          {isFetching && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Searching…</div>}
          {(searchResults as Record<string, unknown>[]).length > 0 && !selectedPlayer && (
            <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
              {(searchResults as Record<string, unknown>[]).map(p => (
                <button key={String(p.discordId)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary text-left transition-colors"
                  onClick={() => setSelectedPlayer(p)}>
                  <div>
                    <span className="font-medium">{String(p.username)}</span>
                    <span className="text-xs text-muted-foreground ml-2">Lvl {Number(p.level)}</span>
                    {Boolean(p.isBanned) && <Badge variant="destructive" className="ml-2 text-xs">Banned</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{String(p.discordId)}</span>
                </button>
              ))}
            </div>
          )}
          {selectedPlayer && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30">
              <div>
                <span className="font-semibold">{String(selectedPlayer.username)}</span>
                <span className="text-sm text-muted-foreground ml-2">Level {Number(selectedPlayer.level)}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  💰 {Number(selectedPlayer.gold).toLocaleString()} gold · 💎 {Number(selectedPlayer.gems)} gems · ⚡ {Number(selectedPlayer.stamina)}/{Number(selectedPlayer.maxStamina)} stamina
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedPlayer(null); setSuccess(null); }}><XCircle className="w-4 h-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPlayer && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. Set Rewards</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>💰 Gold</Label><Input type="number" min="0" value={reward.gold} onChange={e => setReward(r => ({ ...r, gold: Number(e.target.value) }))} /></div>
              <div className="space-y-1"><Label>💎 Gems</Label><Input type="number" min="0" value={reward.gems} onChange={e => setReward(r => ({ ...r, gems: Number(e.target.value) }))} /></div>
              <div className="space-y-1"><Label>⭐ XP</Label><Input type="number" min="0" value={reward.xp} onChange={e => setReward(r => ({ ...r, xp: Number(e.target.value) }))} /></div>
              <div className="space-y-1"><Label>⚡ Stamina</Label><Input type="number" min="0" value={reward.stamina} onChange={e => setReward(r => ({ ...r, stamina: Number(e.target.value) }))} /></div>
            </div>
            <div className="space-y-1"><Label>Reason (optional)</Label><Input value={reward.reason} onChange={e => setReward(r => ({ ...r, reason: e.target.value }))} placeholder="Event reward, compensation, etc." /></div>
            <Button className="w-full" onClick={() => rewardMut.mutate()} disabled={rewardMut.isPending || (!reward.gold && !reward.gems && !reward.xp && !reward.stamina)}>
              {rewardMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
              Send Rewards
            </Button>
          </CardContent>
        </Card>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400">
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Rewards delivered to {String(success.username)}!</p>
            <p className="text-sm mt-1">New totals — 💰 {Number(success.gold).toLocaleString()} gold · 💎 {Number(success.gems)} gems · ⚡ {Number(success.stamina)} stamina</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ANNOUNCEMENTS TAB
// ─────────────────────────────────────────────

function AnnouncementsTab() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [type, setType] = useState("general");
  const [sent, setSent] = useState(false);

  const broadcastMut = useMutation({
    mutationFn: () => fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, type }),
    }).then(r => r.json()),
    onSuccess: () => { setSent(true); setMessage(""); toast({ title: "Announcement broadcast!" }); setTimeout(() => setSent(false), 4000); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5" /> Broadcast Announcement</CardTitle>
          <CardDescription>Send a message that gets logged as an admin broadcast across all servers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Announcement Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["general", "event", "maintenance", "update", "emergency"].map(t => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Message</Label>
            <Textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your announcement here…" />
          </div>
          <Button className="w-full" onClick={() => broadcastMut.mutate()} disabled={broadcastMut.isPending || !message.trim()}>
            {broadcastMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
            Broadcast
          </Button>
          {sent && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Announcement sent and logged successfully.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// GACHA BANNERS TAB
// ─────────────────────────────────────────────

const BANNER_TYPES = ["standard", "limited", "collab", "seasonal", "anniversary"];
const DEFAULT_RATES: Record<string, number> = {
  "D": 40, "C": 30, "B": 15, "A": 8, "S": 4, "SS": 2, "SSS": 0.5, "SSS+": 0.5,
};

function defaultBannerForm() {
  return {
    name: "", description: "", bannerType: "limited",
    featuredCharacterIds: [] as number[],
    rateOverrides: {} as Record<string, number>,
    costPerPull: 10, costPer10Pull: 90, currency: "gems",
    pityAt: 80, guaranteedRarity: "SSS",
    startAt: "", endAt: "", imageUrl: "", isActive: false,
  };
}

function BannerFormModal({ open, onClose, initial, characters, onSave }: {
  open: boolean; onClose: () => void;
  initial?: Record<string, unknown> | null;
  characters: Record<string, unknown>[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState(() => ({
    ...defaultBannerForm(),
    ...(initial ? {
      name: String(initial.name ?? ""),
      description: String(initial.description ?? ""),
      bannerType: String(initial.bannerType ?? "limited"),
      featuredCharacterIds: (initial.featuredCharacterIds as number[]) ?? [],
      rateOverrides: (initial.rateOverrides as Record<string, number>) ?? {},
      costPerPull: Number(initial.costPerPull ?? 10),
      costPer10Pull: Number(initial.costPer10Pull ?? 90),
      currency: String(initial.currency ?? "gems"),
      pityAt: Number(initial.pityAt ?? 80),
      guaranteedRarity: String(initial.guaranteedRarity ?? "SSS"),
      startAt: initial.startAt ? String(initial.startAt).slice(0, 16) : "",
      endAt: initial.endAt ? String(initial.endAt).slice(0, 16) : "",
      imageUrl: String(initial.imageUrl ?? ""),
      isActive: Boolean(initial.isActive ?? false),
    } : {}),
  }));
  const [saving, setSaving] = useState(false);

  function toggleChar(id: number) {
    setForm(f => ({
      ...f,
      featuredCharacterIds: f.featuredCharacterIds.includes(id)
        ? f.featuredCharacterIds.filter(x => x !== id)
        : [...f.featuredCharacterIds, id],
    }));
  }

  function setRate(rarity: string, val: number) {
    setForm(f => ({ ...f, rateOverrides: { ...f.rateOverrides, [rarity]: val } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        ...form,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Banner" : "New Gacha Banner"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Banner Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Summer Collab Banner" /></div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.bannerType} onValueChange={v => setForm(f => ({ ...f, bannerType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BANNER_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1"><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Limited time banner featuring..." /></div>
            <div className="space-y-1"><Label>Image URL</Label><Input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." /></div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="gems">Gems</SelectItem><SelectItem value="tickets">Tickets</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Single Pull Cost</Label><Input type="number" value={form.costPerPull} onChange={e => setForm(f => ({ ...f, costPerPull: Number(e.target.value) }))} /></div>
            <div className="space-y-1"><Label>10-Pull Cost</Label><Input type="number" value={form.costPer10Pull} onChange={e => setForm(f => ({ ...f, costPer10Pull: Number(e.target.value) }))} /></div>
            <div className="space-y-1"><Label>Pity Threshold</Label><Input type="number" value={form.pityAt} onChange={e => setForm(f => ({ ...f, pityAt: Number(e.target.value) }))} /></div>
            <div className="space-y-1">
              <Label>Guaranteed Rarity at Pity</Label>
              <Select value={form.guaranteedRarity} onValueChange={v => setForm(f => ({ ...f, guaranteedRarity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RARITIES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Start Date (optional)</Label><Input type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} /></div>
            <div className="space-y-1"><Label>End Date (optional)</Label><Input type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} /></div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Drop Rate Overrides (leave blank to use defaults)</p>
            <div className="grid grid-cols-4 gap-2">
              {RARITIES.map(r => (
                <div key={r} className="space-y-1">
                  <Label className={cn("text-xs font-bold", RARITY_COLORS[r]?.replace("bg-", "text-") ?? "")}>{r}</Label>
                  <div className="flex items-center gap-1">
                    <Input type="number" step="0.1" min="0" max="100" className="h-8 text-xs"
                      placeholder={String(DEFAULT_RATES[r] ?? "")}
                      value={form.rateOverrides[r] !== undefined ? form.rateOverrides[r] : ""}
                      onChange={e => setRate(r, Number(e.target.value))} />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Featured Characters ({form.featuredCharacterIds.length} selected)</p>
            <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1">
              {characters.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No characters yet. Add some in the Characters tab.</p>
              ) : characters.map(c => (
                <label key={String(c.id)} className="flex items-center gap-3 p-1.5 rounded hover:bg-secondary/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.featuredCharacterIds.includes(Number(c.id))}
                    onChange={() => toggleChar(Number(c.id))}
                    className="rounded"
                  />
                  <span className={cn("px-1 rounded text-xs font-bold text-white", RARITY_COLORS[String(c.rarity)] ?? "bg-zinc-500")}>{String(c.rarity)}</span>
                  <span className="text-sm font-medium">{String(c.name)}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{String(c.animeSource)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 border-t pt-4">
            <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
            <Label>Active (visible to players)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initial ? "Save Changes" : "Create Banner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GachaBannersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; data: Record<string, unknown> | null }>({ open: false, data: null });

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["um-banners"],
    queryFn: () => apiFetch(`${API}/banners`),
  });
  const { data: characters = [] } = useQuery({
    queryKey: ["um-characters"],
    queryFn: () => apiFetch(`${API}/characters`),
  });

  const saveMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data.id
        ? apiFetch(`${API}/banners/${data.id}`, { method: "PUT", body: JSON.stringify(data) })
        : apiFetch(`${API}/banners`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["um-banners"] }); toast({ title: vars.id ? "Banner updated" : "Banner created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/banners/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-banners"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/banners/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["um-banners"] }); toast({ title: "Banner deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const charMap = new Map((characters as Record<string, unknown>[]).map(c => [Number(c.id), c]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure gacha banners with featured characters and custom drop rates.</p>
        <Button onClick={() => setModal({ open: true, data: null })}>
          <Plus className="w-4 h-4 mr-2" /> New Banner
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (banners as Record<string, unknown>[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No banners yet. Create your first gacha banner.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {(banners as Record<string, unknown>[]).map(banner => {
            const featIds = (banner.featuredCharacterIds as number[]) ?? [];
            const featChars = featIds.map(id => charMap.get(id)).filter(Boolean) as Record<string, unknown>[];
            const now = Date.now();
            const startAt = banner.startAt ? new Date(String(banner.startAt)).getTime() : null;
            const endAt = banner.endAt ? new Date(String(banner.endAt)).getTime() : null;
            const isLive = Boolean(banner.isActive) && (!startAt || now >= startAt) && (!endAt || now <= endAt);

            return (
              <div key={String(banner.id)} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-violet-600 to-purple-900 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {banner.imageUrl ? (
                    <img src={String(banner.imageUrl)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Sparkles className="w-7 h-7 text-white/80" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{String(banner.name)}</span>
                    <Badge variant="outline" className="text-xs capitalize">{String(banner.bannerType)}</Badge>
                    {isLive ? (
                      <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30"><Radio className="w-3 h-3 mr-1" />LIVE</Badge>
                    ) : banner.isActive ? (
                      <Badge variant="secondary" className="text-xs">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                    )}
                  </div>
                  {Boolean(banner.description) && <p className="text-sm text-muted-foreground mt-0.5 truncate">{String(banner.description)}</p>}
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span>💎 {Number(banner.costPerPull)} / {Number(banner.costPer10Pull)} (10x)</span>
                    <span>🎯 Pity: {Number(banner.pityAt)} pulls</span>
                    {featChars.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400" />
                        {featChars.map(c => String(c.name)).join(", ")}
                      </span>
                    )}
                  </div>
                  {(startAt || endAt) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {startAt ? `From ${new Date(startAt).toLocaleDateString()}` : ""}
                      {startAt && endAt ? " → " : ""}
                      {endAt ? new Date(endAt).toLocaleDateString() : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleMut.mutate(Number(banner.id))} className="text-muted-foreground hover:text-foreground transition-colors" title={banner.isActive ? "Deactivate" : "Activate"}>
                    {banner.isActive ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <Button size="sm" variant="outline" onClick={() => setModal({ open: true, data: banner })}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Delete "${banner.name}"?`)) deleteMut.mutate(Number(banner.id)); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BannerFormModal
        open={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        initial={modal.data}
        characters={characters as Record<string, unknown>[]}
        onSave={data => saveMut.mutateAsync(modal.data ? { ...modal.data, ...data } : data)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// SYSTEM TOGGLES TAB
// ─────────────────────────────────────────────

interface GlobalSettings {
  allowPvp: boolean;
  allowMarket: boolean;
  allowGuilds: boolean;
  allowTournaments: boolean;
  allowWorldBoss: boolean;
  allowStocks: boolean;
  xpMultiplier: number;
  goldMultiplier: number;
  staminaRegenRate: number;
  maintenanceModeActive?: boolean;
  maintenanceMessage?: string;
  doubleXpActive?: boolean;
  doubleXpMultiplier?: number;
  eventBuffActive?: boolean;
  eventBuffName?: string;
  eventBuffMultiplier?: number;
}

function ToggleCard({ icon: Icon, title, description, checked, onToggle, danger }: {
  icon: React.ElementType; title: string; description: string;
  checked: boolean; onToggle: () => void; danger?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-start justify-between p-4 rounded-lg border transition-colors",
      danger && checked ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", checked ? (danger ? "bg-red-500/20" : "bg-primary/20") : "bg-secondary")}>
          <Icon className={cn("w-4 h-4", checked ? (danger ? "text-red-400" : "text-primary") : "text-muted-foreground")} />
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

function SystemTogglesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["um-toggles"],
    queryFn: () => apiFetch(`${API}/toggles`),
  });

  const settings = ((config as Record<string, unknown>)?.settings ?? {}) as GlobalSettings;

  const updateMut = useMutation({
    mutationFn: (patch: Partial<GlobalSettings>) =>
      apiFetch(`${API}/toggles`, { method: "PUT", body: JSON.stringify(patch) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["um-toggles"] }); toast({ title: "Settings saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function toggle(key: keyof GlobalSettings) {
    updateMut.mutate({ [key]: !settings[key] });
  }

  function setNum(key: keyof GlobalSettings, val: number) {
    updateMut.mutate({ [key]: val });
  }

  function setStr(key: keyof GlobalSettings, val: string) {
    updateMut.mutate({ [key]: val });
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400" /> Critical Modes</h3>
        <ToggleCard
          icon={ServerCrash}
          title="Maintenance Mode"
          description="Disables all bot commands and shows a maintenance message to players."
          checked={Boolean(settings.maintenanceModeActive)}
          onToggle={() => toggle("maintenanceModeActive")}
          danger
        />
        {settings.maintenanceModeActive && (
          <div className="space-y-1 ml-12">
            <Label className="text-xs">Maintenance Message</Label>
            <Input
              className="h-8 text-sm"
              defaultValue={String(settings.maintenanceMessage ?? "🔧 The bot is currently under maintenance. We'll be back soon!")}
              onBlur={e => setStr("maintenanceMessage", e.target.value)}
              placeholder="Message shown to players..."
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> Active Events</h3>
        <ToggleCard
          icon={Zap}
          title="Double XP Event"
          description="Multiply XP gained from all activities."
          checked={Boolean(settings.doubleXpActive)}
          onToggle={() => toggle("doubleXpActive")}
        />
        {settings.doubleXpActive && (
          <div className="ml-12 flex items-center gap-3">
            <Label className="text-xs text-nowrap">XP Multiplier:</Label>
            <Input type="number" step="0.5" min="1" max="10" className="h-8 w-24 text-sm"
              defaultValue={settings.doubleXpMultiplier ?? 2}
              onBlur={e => setNum("doubleXpMultiplier", Number(e.target.value))} />
            <span className="text-xs text-muted-foreground">x</span>
          </div>
        )}
        <ToggleCard
          icon={Star}
          title="Event Buff"
          description="A named special event buff applied to all players."
          checked={Boolean(settings.eventBuffActive)}
          onToggle={() => toggle("eventBuffActive")}
        />
        {settings.eventBuffActive && (
          <div className="ml-12 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Buff Name</Label>
              <Input className="h-8 text-sm" defaultValue={String(settings.eventBuffName ?? "Anniversary Celebration")}
                onBlur={e => setStr("eventBuffName", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gold Multiplier</Label>
              <Input type="number" step="0.5" min="1" max="10" className="h-8 text-sm"
                defaultValue={settings.eventBuffMultiplier ?? 2}
                onBlur={e => setNum("eventBuffMultiplier", Number(e.target.value))} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-blue-400" /> Feature Flags</h3>
        <div className="grid grid-cols-1 gap-2">
          <ToggleCard icon={Swords} title="PvP Battles" description="Allow players to challenge each other." checked={Boolean(settings.allowPvp)} onToggle={() => toggle("allowPvp")} />
          <ToggleCard icon={Package} title="Market" description="Allow player-to-player trading and market listings." checked={Boolean(settings.allowMarket)} onToggle={() => toggle("allowMarket")} />
          <ToggleCard icon={Globe} title="Guilds" description="Allow creation and management of guilds." checked={Boolean(settings.allowGuilds)} onToggle={() => toggle("allowGuilds")} />
          <ToggleCard icon={BookOpen} title="Tournaments" description="Allow competitive tournament events." checked={Boolean(settings.allowTournaments)} onToggle={() => toggle("allowTournaments")} />
          <ToggleCard icon={ShieldAlert} title="World Bosses" description="Allow world boss spawns and raid events." checked={Boolean(settings.allowWorldBoss)} onToggle={() => toggle("allowWorldBoss")} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Coins className="w-4 h-4 text-yellow-400" /> Economy Rates</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>XP Multiplier</Label>
            <Input type="number" step="0.1" min="0.1" max="20" defaultValue={settings.xpMultiplier ?? 1}
              onBlur={e => setNum("xpMultiplier", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Gold Multiplier</Label>
            <Input type="number" step="0.1" min="0.1" max="20" defaultValue={settings.goldMultiplier ?? 1}
              onBlur={e => setNum("goldMultiplier", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Stamina Regen (min/pt)</Label>
            <Input type="number" step="1" min="1" max="120" defaultValue={settings.staminaRegenRate ?? 6}
              onBlur={e => setNum("staminaRegenRate", Number(e.target.value))} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">These are applied globally to all servers. Click outside the field to save.</p>
      </div>

      {updateMut.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Saving...
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PUBLISH UPDATE TAB
// ─────────────────────────────────────────────

type ChangelogKey = "newCharacters" | "balanceChanges" | "newBanners" | "systemChanges" | "bugFixes" | "other";

interface ChangelogSection {
  key: ChangelogKey;
  label: string;
  icon: React.ElementType;
  placeholder: string;
  color: string;
}

const CHANGELOG_SECTIONS: ChangelogSection[] = [
  { key: "newCharacters",  label: "New Characters",  icon: Sparkles,     placeholder: "Added SSS+ character Goku (Dragon Ball)", color: "text-yellow-400" },
  { key: "balanceChanges", label: "Balance Changes",  icon: RefreshCw,    placeholder: "Naruto — increased skill damage by 15%",   color: "text-blue-400"   },
  { key: "newBanners",     label: "New Banners",      icon: Star,         placeholder: "Dragon Ball Legends banner (limited)",      color: "text-purple-400" },
  { key: "systemChanges",  label: "System Changes",   icon: Zap,          placeholder: "Double XP event started",                  color: "text-green-400"  },
  { key: "bugFixes",       label: "Bug Fixes",        icon: Bug,          placeholder: "Fixed battle crash on floor 50",           color: "text-red-400"    },
  { key: "other",          label: "Other",            icon: MoreHorizontal, placeholder: "Server maintenance completed",           color: "text-zinc-400"   },
];

function ChangelogSectionEditor({ section, items, onChange }: {
  section: ChangelogSection;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState("");
  const Icon = section.icon;

  function add() {
    const val = newItem.trim();
    if (!val) return;
    onChange([...items, val]);
    setNewItem("");
  }

  return (
    <div className="space-y-2">
      <p className={cn("text-sm font-semibold flex items-center gap-1.5", section.color)}>
        <Icon className="w-3.5 h-3.5" /> {section.label}
      </p>
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <span className="text-muted-foreground text-xs">•</span>
              <span className="text-sm flex-1">{item}</span>
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="h-8 text-sm"
          placeholder={section.placeholder}
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!newItem.trim()}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DiscordEmbedPreview({ version, title, changelog }: {
  version: string;
  title: string;
  changelog: Record<ChangelogKey, string[]>;
}) {
  const hasContent = Object.values(changelog).some(arr => arr.length > 0);
  return (
    <div className="rounded-lg overflow-hidden border border-border" style={{ borderLeft: "4px solid #7c3aed" }}>
      <div className="bg-[#2b2d31] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Swords className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs text-zinc-400">AMA Dashboard</span>
          <span className="text-xs bg-primary/20 text-primary px-1.5 rounded">BOT</span>
        </div>
        <div className="bg-[#1e1f22] rounded-md p-3 space-y-2">
          <p className="font-bold text-white text-sm">
            {title ? `🎮 ${title}` : "🎮 Patch Title"}
          </p>
          <p className="text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">{version || "v?.?.?"}</span> — Anime Multiverse Arena
          </p>
          {hasContent ? (
            <div className="space-y-2 pt-1">
              {CHANGELOG_SECTIONS.map(sec => {
                const items = changelog[sec.key];
                if (!items || items.length === 0) return null;
                return (
                  <div key={sec.key}>
                    <p className="text-xs font-semibold text-zinc-300">{sec.label}</p>
                    <div className="text-xs text-zinc-400 space-y-0.5">
                      {items.map((item, i) => <p key={i}>• {item}</p>)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">Changelog entries will appear here…</p>
          )}
          <p className="text-xs text-zinc-500 pt-1 border-t border-zinc-700">
            Published by AMA Dashboard • {new Date().toUTCString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function PublishTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [version, setVersion] = useState("v1.0.0");
  const [title, setTitle] = useState("");
  const [channelId, setChannelId] = useState("");
  const [changelog, setChangelog] = useState<Record<ChangelogKey, string[]>>({
    newCharacters: [], balanceChanges: [], newBanners: [],
    systemChanges: [], bugFixes: [], other: [],
  });
  const [publishResult, setPublishResult] = useState<Record<string, unknown> | null>(null);

  const { data: patches = [], isLoading: patchesLoading } = useQuery({
    queryKey: ["um-patches"],
    queryFn: () => apiFetch(`${API}/patches`),
  });

  const publishMut = useMutation({
    mutationFn: () => apiFetch(`${API}/publish`, {
      method: "POST",
      body: JSON.stringify({ version, title, changelog, discordChannelId: channelId || undefined }),
    }),
    onSuccess: (data: Record<string, unknown>) => {
      setPublishResult(data);
      qc.invalidateQueries({ queryKey: ["um-patches"] });
      toast({ title: `Patch ${version} published!` });
    },
    onError: (e: Error) => toast({ title: "Publish failed", description: e.message, variant: "destructive" }),
  });

  const hasChangelog = Object.values(changelog).some(arr => arr.length > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Rocket className="w-4 h-4 text-primary" /> Patch Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Version</Label>
                  <Input placeholder="v1.2.0" value={version} onChange={e => setVersion(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Patch Title</Label>
                  <Input placeholder="The Mythic Update" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Discord Patch Channel ID <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input placeholder="123456789012345678" value={channelId} onChange={e => setChannelId(e.target.value)} />
                <p className="text-xs text-muted-foreground">Right-click a Discord channel → Copy Channel ID. The bot will post the patch embed there.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Changelog</CardTitle>
              <CardDescription>Add entries for each section. Press Enter or + to add.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {CHANGELOG_SECTIONS.map(sec => (
                <ChangelogSectionEditor
                  key={sec.key}
                  section={sec}
                  items={changelog[sec.key]}
                  onChange={items => setChangelog(cl => ({ ...cl, [sec.key]: items }))}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Discord Embed Preview</CardTitle>
              <CardDescription>This is how the patch notes will appear in Discord.</CardDescription>
            </CardHeader>
            <CardContent>
              <DiscordEmbedPreview version={version} title={title} changelog={changelog} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Rocket className="w-4 h-4 text-primary" /> Publish</CardTitle>
              <CardDescription>This will save the patch, trigger a bot reload, and send the embed to Discord.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                size="lg"
                disabled={publishMut.isPending || !version.trim() || !title.trim()}
                onClick={() => publishMut.mutate()}
              >
                {publishMut.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing…</>
                  : <><Rocket className="w-4 h-4 mr-2" /> Publish {version}</>}
              </Button>

              {publishResult && (
                <div className="space-y-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm font-semibold text-green-400 flex items-center gap-2">
                    <CheckCheck className="w-4 h-4" /> Published successfully!
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={cn("flex items-center gap-1.5 p-2 rounded", publishResult.botReloaded ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400")}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      {publishResult.botReloaded ? "Bot reloaded" : "Bot offline"}
                    </div>
                    <div className={cn("flex items-center gap-1.5 p-2 rounded", publishResult.discordNotified ? "bg-green-500/10 text-green-400" : "bg-zinc-500/10 text-zinc-400")}>
                      <Send className="w-3.5 h-3.5" />
                      {publishResult.discordNotified ? "Discord notified" : channelId ? "Discord failed" : "No channel set"}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Patch History</CardTitle>
        </CardHeader>
        <CardContent>
          {patchesLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (patches as Record<string, unknown>[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No patches published yet.</p>
          ) : (
            <div className="space-y-2">
              {(patches as Record<string, unknown>[]).map(p => {
                const cl = (p.changelog as Record<ChangelogKey, string[]>) ?? {};
                const totalEntries = Object.values(cl).flat().length;
                return (
                  <div key={String(p.id)} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs">{String(p.version)}</Badge>
                      <span className="text-sm font-medium">{String(p.title)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{totalEntries} change{totalEntries !== 1 ? "s" : ""}</span>
                      <div className="flex items-center gap-1.5">
                        {p.botReloaded
                          ? <span className="text-green-400 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> reloaded</span>
                          : <span className="text-yellow-400 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> no reload</span>}
                        {p.discordNotified
                          ? <span className="text-green-400 flex items-center gap-1"><Send className="w-3 h-3" /> sent</span>
                          : <span className="text-zinc-500 flex items-center gap-1"><Send className="w-3 h-3" /> no embed</span>}
                      </div>
                      <span>{new Date(String(p.publishedAt)).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────

export default function UpdateMaker() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wand2 className="w-8 h-8 text-primary" /> Update Maker
          </h1>
          <p className="text-muted-foreground mt-1">
            Build, configure, and publish game updates — no code required.
          </p>
        </div>
      </div>

      <Tabs defaultValue="characters">
        <TabsList className="flex-wrap h-auto gap-1 mb-2">
          <TabsTrigger value="characters" className="gap-1.5"><Swords className="w-3.5 h-3.5" /> Characters</TabsTrigger>
          <TabsTrigger value="bosses" className="gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Bosses</TabsTrigger>
          <TabsTrigger value="items" className="gap-1.5"><Package className="w-3.5 h-3.5" /> Items</TabsTrigger>
          <TabsTrigger value="banners" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Gacha Banners</TabsTrigger>
          <TabsTrigger value="toggles" className="gap-1.5"><Radio className="w-3.5 h-3.5" /> System Toggles</TabsTrigger>
          <TabsTrigger value="economy" className="gap-1.5"><Coins className="w-3.5 h-3.5" /> Economy</TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5"><Gift className="w-3.5 h-3.5" /> Rewards</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1.5"><Megaphone className="w-3.5 h-3.5" /> Announce</TabsTrigger>
          <TabsTrigger value="publish" className="gap-1.5 bg-primary/10 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Rocket className="w-3.5 h-3.5" /> Publish Update
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters"><CharactersTab /></TabsContent>
        <TabsContent value="bosses"><BossesTab /></TabsContent>
        <TabsContent value="items"><ItemsTab /></TabsContent>
        <TabsContent value="banners"><GachaBannersTab /></TabsContent>
        <TabsContent value="toggles"><SystemTogglesTab /></TabsContent>
        <TabsContent value="economy"><EconomyTab /></TabsContent>
        <TabsContent value="rewards"><RewardsTab /></TabsContent>
        <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
        <TabsContent value="publish"><PublishTab /></TabsContent>
      </Tabs>
    </div>
  );
}
