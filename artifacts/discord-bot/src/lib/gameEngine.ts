import { db, playersTable, playerCharactersTable, charactersTable } from "./db.js";
import { eq } from "drizzle-orm";
import type { Player } from "./db.js";

export const RARITY_RATES: Record<string, number> = {
  "D": 40, "C": 25, "B": 15, "A": 10, "S": 6, "SS": 2.5, "SSS": 1, "SSS+": 0.5
};

export const RARITY_GEM_COST: Record<string, number> = {
  single: 10, ten: 90
};

export function rollRarity(): string {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const [rarity, rate] of Object.entries(RARITY_RATES)) {
    cumulative += rate;
    if (rand < cumulative) return rarity;
  }
  return "D";
}

export async function getOrCreatePlayer(discordId: string, username: string, guildId: string) {
  const [existing] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (existing) return { player: existing, isNew: false };

  const [player] = await db.insert(playersTable).values({
    discordId, username, guildId,
    level: 1, xp: 0, xpToNext: 100,
    gold: 1000, gems: 20,
    stamina: 100, maxStamina: 100,
    staminaLastRegen: new Date(),
    activeParty: [],
    currentWorld: "ساحة التدريب",
    currentFloor: 0,
    maxAbyssFloor: 0,
    furyMeter: 0,
    wins: 0, losses: 0, totalDamageDealt: 0,
    pvpRating: 1000,
    worldBossContributions: 0,
    isBanned: false,
    updatedAt: new Date(),
  }).returning();
  return { player, isNew: true };
}

export async function getPlayerWithCharacters(discordId: string) {
  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return null;

  const playerChars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  return { player, characters: playerChars };
}

export function calcXpForLevel(level: number): number {
  return Math.max(10, Math.floor(100 * Math.pow(1.15, level - 1)));
}

export async function addXP(playerId: number, amount: number) {
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) return null;

  let xp = player.xp + amount;
  let level = player.level;
  let xpToNext = player.xpToNext;
  let leveled = false;
  let safetyBreak = 0;

  while (xp >= xpToNext && safetyBreak < 100) {
    xp -= xpToNext;
    level++;
    xpToNext = calcXpForLevel(level);
    leveled = true;
    safetyBreak++;
  }

  await db.update(playersTable)
    .set({ xp, level, xpToNext, updatedAt: new Date() })
    .where(eq(playersTable.id, playerId));
  return { leveled, newLevel: level };
}

export async function applyStaminaRegen(player: Player, regenRateMinutes = 6): Promise<Player> {
  if (player.stamina >= player.maxStamina) return player;
  const now = new Date();
  const minutesSince = (now.getTime() - player.staminaLastRegen.getTime()) / 60000;
  const regenAmount = Math.floor(minutesSince / regenRateMinutes);
  if (regenAmount <= 0) return player;

  const newStamina = Math.min(player.maxStamina, player.stamina + regenAmount);
  // Advance staminaLastRegen by exactly the time consumed, preserving leftover fractional minutes
  const newRegenTime = new Date(player.staminaLastRegen.getTime() + regenAmount * regenRateMinutes * 60_000);
  await db.update(playersTable)
    .set({ stamina: newStamina, staminaLastRegen: newRegenTime })
    .where(eq(playersTable.id, player.id));
  return { ...player, stamina: newStamina, staminaLastRegen: newRegenTime };
}

// ── Element System ──────────────────────────────────────────────────────────

export const ELEMENT_ADVANTAGES: Record<string, string[]> = {
  Fire:      ["Wind", "Ice"],
  Water:     ["Fire", "Earth"],
  Earth:     ["Lightning", "Wind"],
  Wind:      ["Water", "Ice"],
  Lightning: ["Water", "Wind"],
  Ice:       ["Fire", "Earth"],
  Light:     ["Dark", "Chaos"],
  Dark:      ["Light", "Order"],
  Chaos:     ["Order", "Light"],
  Order:     ["Chaos", "Dark"],
  Space:     ["Lightning", "Time"],
  Time:      ["Space", "Fire"],
};

export function getElementMultiplier(attackerEl: string, defenderEl: string): number {
  return (ELEMENT_ADVANTAGES[attackerEl] ?? []).includes(defenderEl) ? 1.35 : 1.0;
}

// ── Turn-Based Battle ───────────────────────────────────────────────────────

export type Move = "attack" | "skill" | "defend" | "fury";

export interface RoundFighter {
  name: string;
  atk: number;
  def: number;
  crit: number;
  critDmg: number;
  element: string;
  fury: number;
  skillName: string;
  skillElement: string;
  skillDamage: number;
  skillCooldown: number;
}

export interface RoundResult {
  aHpDelta: number;
  bHpDelta: number;
  aFuryDelta: number;
  bFuryDelta: number;
  aSkillCd: number;
  bSkillCd: number;
  logA: string;
  logB: string;
  elementBonusA: boolean;
  elementBonusB: boolean;
}

export function resolveRound(
  aMove: Move,
  bMove: Move,
  a: RoundFighter,
  b: RoundFighter,
): RoundResult {

  function calcHit(
    attacker: RoundFighter,
    defenderEl: string,
    defenderDef: number,
    defenderDefending: boolean,
    move: Move,
  ): { dmg: number; hasBonus: boolean; isCrit: boolean; log: string } {
    if (move === "defend") {
      return { dmg: 0, hasBonus: false, isCrit: false, log: `🛡️ **${attacker.name}** يدافع!` };
    }

    const isSkill = move === "skill";
    const isFury = move === "fury";
    const atkEl = isSkill ? attacker.skillElement : attacker.element;
    const elMult = getElementMultiplier(atkEl, defenderEl);
    const hasBonus = elMult > 1;

    const baseMult = isFury ? 2.5 : isSkill ? attacker.skillDamage : 1.0;
    const isCrit = !isSkill && !isFury && Math.random() < attacker.crit;
    const critMult = isCrit ? attacker.critDmg : 1.0;
    const defenseReduction = defenderDefending ? 0.55 : 1.0;
    const furyCrush = isFury ? 0.5 : 1.0;

    const effectiveDef = defenderDef * 0.35 * furyCrush;
    const rawDmg = Math.max(1, attacker.atk * baseMult - effectiveDef);
    const variance = 0.88 + Math.random() * 0.24;
    const dmg = Math.max(1, Math.floor(rawDmg * variance * elMult * critMult * defenseReduction));

    const bonusLabel = hasBonus ? " ⚡**مكافأة العنصر!**" : "";
    const critLabel = isCrit ? " ✨**ضربة حرجة!**" : "";

    let log: string;
    if (isFury) {
      log = `💥 **${attacker.name}** يطلق **الغضب!** ← **${dmg} ضرر**${bonusLabel}`;
    } else if (isSkill) {
      log = `🌀 **${attacker.name}** يستخدم **${attacker.skillName}** ← **${dmg} ضرر**${bonusLabel}`;
    } else {
      log = `⚔️ **${attacker.name}** يهاجم ← **${dmg} ضرر**${critLabel}`;
    }

    return { dmg, hasBonus, isCrit, log };
  }

  const aActs = calcHit(a, b.element, b.def, bMove === "defend", aMove);
  const bActs = calcHit(b, a.element, a.def, aMove === "defend", bMove);

  const aFuryDelta = (() => {
    if (aMove === "fury") return -a.fury;
    let gain = 0;
    if (bActs.dmg > 0) gain += Math.min(15, 5 + Math.floor(bActs.dmg / 200));
    if (aActs.dmg > 0) gain += Math.min(10, Math.floor(aActs.dmg / 300));
    if (aMove === "defend") gain += 8;
    return Math.min(100 - a.fury, gain);
  })();

  const bFuryDelta = (() => {
    if (bMove === "fury") return -b.fury;
    let gain = 0;
    if (aActs.dmg > 0) gain += Math.min(15, 5 + Math.floor(aActs.dmg / 200));
    if (bActs.dmg > 0) gain += Math.min(10, Math.floor(bActs.dmg / 300));
    if (bMove === "defend") gain += 8;
    return Math.min(100 - b.fury, gain);
  })();

  return {
    aHpDelta: -bActs.dmg,
    bHpDelta: -aActs.dmg,
    aFuryDelta,
    bFuryDelta,
    aSkillCd: aMove === "skill" ? 3 : Math.max(0, a.skillCooldown - 1),
    bSkillCd: bMove === "skill" ? 3 : Math.max(0, b.skillCooldown - 1),
    logA: aActs.log,
    logB: bActs.log,
    elementBonusA: aActs.hasBonus,
    elementBonusB: bActs.hasBonus,
  };
}

export function pickEnemyMove(
  enemyFury: number,
  enemySkillCooldown: number,
  enemyHpPercent: number,
  playerHpPercent: number,
): Move {
  if (enemyFury >= 100 && Math.random() < 0.75) return "fury";

  if (enemyHpPercent < 0.25) {
    const r = Math.random();
    if (r < 0.55) return "attack";
    if (r < 0.80 && enemySkillCooldown === 0) return "skill";
    return "attack";
  }

  if (playerHpPercent < 0.3 && Math.random() < 0.65) return "attack";

  const r = Math.random();
  if (r < 0.40) return "attack";
  if (r < 0.62 && enemySkillCooldown === 0) return "skill";
  if (r < 0.80) return "defend";
  return "attack";
}

// ── Enemy element inference ─────────────────────────────────────────────────

function inferEnemyElement(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("fire") || n.includes("lava") || n.includes("flame") || n.includes("blaze")) return "Fire";
  if (n.includes("water") || n.includes("swamp") || n.includes("plague") || n.includes("tidal")) return "Water";
  if (n.includes("stone") || n.includes("iron") || n.includes("earth") || n.includes("golem") || n.includes("rock") || n.includes("cave")) return "Earth";
  if (n.includes("storm") || n.includes("wind") || n.includes("air") || n.includes("gale")) return "Wind";
  if (n.includes("thunder") || n.includes("lightning") || n.includes("static")) return "Lightning";
  if (n.includes("ice") || n.includes("frost") || n.includes("frozen") || n.includes("specter")) return "Ice";
  if (n.includes("shadow") || n.includes("dark") || n.includes("void") || n.includes("nightmare") || n.includes("phantom") || n.includes("cursed") || n.includes("soul") || n.includes("abyss")) return "Dark";
  if (n.includes("celestial") || n.includes("ancient") || n.includes("chaos") || n.includes("fracture") || n.includes("corrupt")) return "Chaos";
  const fallbacks = ["Earth", "Wind", "Fire", "Water", "Dark", "Lightning"];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ── Explore Enemies ─────────────────────────────────────────────────────────

export type BattleResult = {
  winner: "player" | "enemy";
  log: string[];
  damageDealt: number;
  xpEarned: number;
  goldEarned: number;
};

export function getExploreEnemy(floor: number): {
  name: string; hp: number; atk: number; def: number; spd: number; isBoss: boolean; element: string;
} {
  const isBoss = floor % 10 === 0 && floor > 0;

  const regularEnemies = [
    { name: "Training Dummy",        hp: 500,    atk: 80,    def: 30,   spd: 50  },
    { name: "Forest Goblin",         hp: 800,    atk: 120,   def: 50,   spd: 70  },
    { name: "Cave Bat",              hp: 700,    atk: 100,   def: 40,   spd: 90  },
    { name: "Stone Troll",           hp: 1200,   atk: 150,   def: 80,   spd: 45  },
    { name: "Wild Wolf Pack",        hp: 1000,   atk: 140,   def: 60,   spd: 100 },
    { name: "Swamp Lizard",          hp: 1400,   atk: 160,   def: 90,   spd: 65  },
    { name: "Skeleton Archer",       hp: 900,    atk: 180,   def: 50,   spd: 110 },
    { name: "Plague Rat Swarm",      hp: 1100,   atk: 130,   def: 55,   spd: 120 },
    { name: "Dark Imp",              hp: 1300,   atk: 170,   def: 70,   spd: 95  },
    { name: "Iron Golem",            hp: 1500,   atk: 180,   def: 100,  spd: 40  },
    { name: "Fire Salamander",       hp: 1800,   atk: 210,   def: 110,  spd: 75  },
    { name: "Ice Specter",           hp: 1600,   atk: 220,   def: 90,   spd: 105 },
    { name: "Thunder Hawk",          hp: 1400,   atk: 240,   def: 80,   spd: 130 },
    { name: "Earth Golem",           hp: 2200,   atk: 190,   def: 140,  spd: 50  },
    { name: "Venomfang Spider",      hp: 1700,   atk: 230,   def: 100,  spd: 115 },
    { name: "Shadow Wraith",         hp: 1900,   atk: 250,   def: 110,  spd: 125 },
    { name: "Cursed Knight",         hp: 2400,   atk: 260,   def: 130,  spd: 90  },
    { name: "Lava Elemental",        hp: 2000,   atk: 280,   def: 120,  spd: 85  },
    { name: "Shadow Drake",          hp: 2500,   atk: 280,   def: 150,  spd: 90  },
    { name: "Abyssal Serpent",       hp: 2800,   atk: 300,   def: 160,  spd: 100 },
    { name: "Void Leech",            hp: 2600,   atk: 320,   def: 145,  spd: 115 },
    { name: "Dark Paladin",          hp: 3000,   atk: 310,   def: 170,  spd: 95  },
    { name: "Phantom Assassin",      hp: 2400,   atk: 360,   def: 130,  spd: 150 },
    { name: "Corrupted Guardian",    hp: 3200,   atk: 330,   def: 180,  spd: 80  },
    { name: "Chaos Fiend",           hp: 2900,   atk: 350,   def: 165,  spd: 120 },
    { name: "Nightmare Stalker",     hp: 3100,   atk: 340,   def: 155,  spd: 135 },
    { name: "Storm Demon",           hp: 2700,   atk: 380,   def: 150,  spd: 140 },
    { name: "Abyssal Knight",        hp: 4000,   atk: 400,   def: 200,  spd: 110 },
    { name: "Celestial Predator",    hp: 4500,   atk: 430,   def: 220,  spd: 120 },
    { name: "Dread Revenant",        hp: 4200,   atk: 460,   def: 210,  spd: 130 },
    { name: "Void Warlord",          hp: 5000,   atk: 480,   def: 240,  spd: 115 },
    { name: "Ancient Lich",          hp: 4800,   atk: 500,   def: 230,  spd: 125 },
    { name: "Fracture Demon",        hp: 5200,   atk: 520,   def: 250,  spd: 140 },
    { name: "Black Titan",           hp: 5500,   atk: 540,   def: 270,  spd: 135 },
    { name: "Soul Reaper",           hp: 5800,   atk: 560,   def: 260,  spd: 150 },
    { name: "Abyss Sovereign",       hp: 6200,   atk: 580,   def: 280,  spd: 145 },
  ];

  const bossEnemies = [
    { name: "🏆 ملك الغوبلن",              hp: 3000,   atk: 200,   def: 100,  spd: 80  },
    { name: "🏆 التنين الحديدي",           hp: 8000,   atk: 350,   def: 200,  spd: 90  },
    { name: "🏆 سيد الظلام",               hp: 15000,  atk: 520,   def: 280,  spd: 110 },
    { name: "🏆 تيتان الفوضى",             hp: 28000,  atk: 750,   def: 380,  spd: 130 },
    { name: "🏆 إمبراطور الفراغ",           hp: 50000,  atk: 1000,  def: 500,  spd: 150 },
    { name: "🏆 إله التنانين القديم",        hp: 80000,  atk: 1400,  def: 700,  spd: 170 },
    { name: "🏆 تجسّد ملك الشياطين",         hp: 120000, atk: 1800,  def: 900,  spd: 190 },
    { name: "🏆 فجر الفراغ",               hp: 180000, atk: 2400,  def: 1200, spd: 210 },
    { name: "🏆 سيد الفوضى الأعظم",         hp: 260000, atk: 3200,  def: 1600, spd: 230 },
    { name: "🏆 مدمّر السماء",              hp: 400000, atk: 4500,  def: 2200, spd: 255 },
  ];

  if (isBoss) {
    const bossIdx = Math.min(Math.floor(floor / 10) - 1, bossEnemies.length - 1);
    const boss = bossEnemies[bossIdx];
    const scale = 1 + Math.max(0, (floor - (bossIdx + 1) * 10)) * 0.05;
    const bossNames = ["Earth", "Dark", "Fire", "Chaos", "Space", "Time", "Dark", "Chaos", "Order", "Space"];
    return {
      name: boss.name,
      hp: Math.floor(boss.hp * scale),
      atk: Math.floor(boss.atk * scale),
      def: Math.floor(boss.def * scale),
      spd: boss.spd,
      isBoss: true,
      element: bossNames[bossIdx] ?? "Dark",
    };
  }

  const regularIdx = Math.min(floor - 1, regularEnemies.length - 1);
  const base = regularEnemies[Math.max(0, regularIdx)];
  const tier = Math.floor(floor / 10);
  const scale = 1 + tier * 0.15 + (floor % 10) * 0.02;

  return {
    name: base.name,
    hp: Math.floor(base.hp * scale),
    atk: Math.floor(base.atk * scale),
    def: Math.floor(base.def * scale),
    spd: base.spd,
    isBoss: false,
    element: inferEnemyElement(base.name),
  };
}
