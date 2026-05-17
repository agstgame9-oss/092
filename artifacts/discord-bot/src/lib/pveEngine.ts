// ── PvE Engine: Zones, Dungeons, Expeditions, Bounties ───────────────────────

export interface Zone {
  id: number;
  name: string;
  element: string;
  emoji: string;
  color: number;
  floorStart: number;
  floorEnd: number;
  enemies: string[];
  bossName: string;
  bossTitle: string;
  unlockFloor: number;
  dropBonus: string;
  statMult: number;
}

export const ZONES: Zone[] = [
  {
    id: 1, name: "ساحة التدريب", element: "Neutral", emoji: "⚔️", color: 0x95a5a6,
    floorStart: 1, floorEnd: 20, unlockFloor: 0,
    enemies: ["محارب مبتدئ", "حارس الميدان", "فارس مدرب", "وحش صغير", "قاطع طريق"],
    bossName: "بطل الميدان", bossTitle: "الاختبار الأول",
    dropBonus: "ذهب إضافي", statMult: 1.0,
  },
  {
    id: 2, name: "غابة النار", element: "Fire", emoji: "🔥", color: 0xe74c3c,
    floorStart: 21, floorEnd: 40, unlockFloor: 20,
    enemies: ["ذئب اللهب", "قرد ناري", "تنين صغير", "بركاني مجنون", "مارد النار"],
    bossName: "سوكا", bossTitle: "سيد اللهب المحترق",
    dropBonus: "مواد نارية", statMult: 1.3,
  },
  {
    id: 3, name: "أعماق المحيط", element: "Water", emoji: "🌊", color: 0x2980b9,
    floorStart: 41, floorEnd: 60, unlockFloor: 40,
    enemies: ["تمساح البحر", "حورية مقاتلة", "أخطبوط عملاق", "سمكة قرش سوداء", "حارس المحيط"],
    bossName: "أرلونج", bossTitle: "ملك البحار الغاضب",
    dropBonus: "لآلئ المحيط", statMult: 1.7,
  },
  {
    id: 4, name: "مرتفعات الرعد", element: "Thunder", emoji: "⚡", color: 0xf39c12,
    floorStart: 61, floorEnd: 80, unlockFloor: 60,
    enemies: ["عقاب البرق", "جبار الغيوم", "محارب العاصفة", "رعاد السماء", "وحش البرق"],
    bossName: "إيجي أوب", bossTitle: "ملك الرعد والصاعقة",
    dropBonus: "بلورات الرعد", statMult: 2.1,
  },
  {
    id: 5, name: "كهف الجليد الأبدي", element: "Ice", emoji: "❄️", color: 0x74b9ff,
    floorStart: 81, floorEnd: 100, unlockFloor: 80,
    enemies: ["ذئب الجليد", "أفعى جليدية", "تمثال الثلج", "عفريت الجليد", "دب الشمال"],
    bossName: "إيسدياث", bossTitle: "إمبراطورة الجليد الأبدي",
    dropBonus: "شظايا جليدية", statMult: 2.6,
  },
  {
    id: 6, name: "درب العواصف", element: "Wind", emoji: "🌪️", color: 0x00b894,
    floorStart: 101, floorEnd: 120, unlockFloor: 100,
    enemies: ["روح الريح", "محارب السماء", "طائر العاصفة", "عملاق الهواء", "شيطان الإعصار"],
    bossName: "إنيل", bossTitle: "إله السماء الهادر",
    dropBonus: "ريش العاصفة", statMult: 3.2,
  },
  {
    id: 7, name: "هاوية الظلام", element: "Dark", emoji: "🌑", color: 0x2d3436,
    floorStart: 121, floorEnd: 140, unlockFloor: 120,
    enemies: ["شبح الظلام", "عفريت الليل", "محارب الظل", "وحش الكابوس", "سيد العتمة"],
    bossName: "زيالدرون", bossTitle: "أمير الظلام الأزلي",
    dropBonus: "بلورات الظلام", statMult: 4.0,
  },
  {
    id: 8, name: "معبد النور الأبدي", element: "Light", emoji: "✨", color: 0xfdcb6e,
    floorStart: 141, floorEnd: 160, unlockFloor: 140,
    enemies: ["حارس النور", "ملاك محارب", "ساحر الضوء", "فارس الفجر", "بطل المعبد"],
    bossName: "كاغويا", bossTitle: "أميرة القمر الإلهية",
    dropBonus: "شظايا النور", statMult: 5.0,
  },
  {
    id: 9, name: "بوابة الفوضى", element: "Chaos", emoji: "🌀", color: 0x6c5ce7,
    floorStart: 161, floorEnd: 180, unlockFloor: 160,
    enemies: ["كيان الفوضى", "مارد الكون", "محارب الأبعاد", "شيطان عابر", "حارس البوابة"],
    bossName: "مالومال", bossTitle: "ملك الفوضى العابر",
    dropBonus: "طاقة الفوضى", statMult: 6.5,
  },
  {
    id: 10, name: "مملكة الآلهة", element: "Order", emoji: "👑", color: 0xe17055,
    floorStart: 181, floorEnd: 200, unlockFloor: 180,
    enemies: ["مقاتل الإله", "حارس الأبدية", "سيد الكون", "حكيم الآلهة", "محارب الإرادة"],
    bossName: "زينو", bossTitle: "ملك كل الملوك — الإله المطلق",
    dropBonus: "جوهرة الأبدية", statMult: 8.0,
  },
];

export function getZoneForFloor(floor: number): Zone {
  return ZONES.find(z => floor >= z.floorStart && floor <= z.floorEnd) ?? ZONES[0];
}

export function getZoneByFloor(maxFloor: number): Zone[] {
  return ZONES.filter(z => maxFloor >= z.unlockFloor);
}

// ── Dungeon Templates ─────────────────────────────────────────────────────────

export interface DungeonTemplate {
  id: string;
  name: string;
  element: string;
  emoji: string;
  difficulty: "easy" | "medium" | "hard";
  staminaCost: number;
  totalFloors: number;
  enemies: string[];
  bossName: string;
  rewardGold: number;
  rewardXp: number;
  rewardFragments: number;
  ticketChance: number;
  statMult: number;
  color: number;
}

export const DUNGEON_TEMPLATES: DungeonTemplate[] = [
  {
    id: "dungeon_training", name: "متاهة المحاربين", element: "Neutral", emoji: "⚔️",
    difficulty: "easy", staminaCost: 15, totalFloors: 5,
    enemies: ["محارب مبتدئ", "فارس مدرب", "حارس القلعة"],
    bossName: "بطل المتاهة الأسطوري",
    rewardGold: 1000, rewardXp: 200, rewardFragments: 1, ticketChance: 8,
    statMult: 1.0, color: 0x95a5a6,
  },
  {
    id: "dungeon_fire", name: "زنزانة اللهب", element: "Fire", emoji: "🔥",
    difficulty: "easy", staminaCost: 20, totalFloors: 5,
    enemies: ["وحش اللهب الصغير", "ذئب ناري", "بركاني محترق"],
    bossName: "ملك النار الغاضب",
    rewardGold: 1500, rewardXp: 300, rewardFragments: 1, ticketChance: 10,
    statMult: 1.2, color: 0xe74c3c,
  },
  {
    id: "dungeon_water", name: "برج المحيط", element: "Water", emoji: "🌊",
    difficulty: "medium", staminaCost: 25, totalFloors: 6,
    enemies: ["حارس المحيط", "سمكة قرش الظلام", "تنين البحر"],
    bossName: "إله البحار القديم",
    rewardGold: 2500, rewardXp: 600, rewardFragments: 2, ticketChance: 20,
    statMult: 1.5, color: 0x2980b9,
  },
  {
    id: "dungeon_thunder", name: "برج الرعد", element: "Thunder", emoji: "⚡",
    difficulty: "medium", staminaCost: 25, totalFloors: 6,
    enemies: ["رعاد السماء", "وحش الغيوم الكثيفة", "عاصفة كائنة"],
    bossName: "سيد العاصفة الخالد",
    rewardGold: 2800, rewardXp: 550, rewardFragments: 2, ticketChance: 18,
    statMult: 1.4, color: 0xf39c12,
  },
  {
    id: "dungeon_ice", name: "معقل الجليد", element: "Ice", emoji: "❄️",
    difficulty: "medium", staminaCost: 25, totalFloors: 6,
    enemies: ["ذئب الجليد الجبار", "تمثال الثلج الحي", "عفريت الجليد المسحور"],
    bossName: "ملك الجليد الأزلي",
    rewardGold: 3000, rewardXp: 700, rewardFragments: 2, ticketChance: 22,
    statMult: 1.6, color: 0x74b9ff,
  },
  {
    id: "dungeon_wind", name: "قلعة الريح", element: "Wind", emoji: "🌪️",
    difficulty: "medium", staminaCost: 25, totalFloors: 6,
    enemies: ["روح الريح الغاضبة", "محارب السماء الهائج", "إعصار عملاق"],
    bossName: "إله العواصف المحطم",
    rewardGold: 2600, rewardXp: 500, rewardFragments: 2, ticketChance: 15,
    statMult: 1.45, color: 0x00b894,
  },
  {
    id: "dungeon_dark", name: "قلعة الظلام", element: "Dark", emoji: "🌑",
    difficulty: "hard", staminaCost: 30, totalFloors: 7,
    enemies: ["شيطان الظلام المستيقظ", "وحش الكابوس الأزلي", "عفريت اللعنة"],
    bossName: "الإمبراطور المظلم الأسطوري",
    rewardGold: 5000, rewardXp: 1200, rewardFragments: 3, ticketChance: 35,
    statMult: 2.0, color: 0x2d3436,
  },
  {
    id: "dungeon_light", name: "معبد الفجر", element: "Light", emoji: "✨",
    difficulty: "hard", staminaCost: 30, totalFloors: 7,
    enemies: ["حارس النور الأبدي", "ملاك محارب السماء", "ساحر الضوء الخالد"],
    bossName: "حاكم النور الإلهي المطلق",
    rewardGold: 4500, rewardXp: 1100, rewardFragments: 3, ticketChance: 30,
    statMult: 1.9, color: 0xfdcb6e,
  },
  {
    id: "dungeon_chaos", name: "بوابة الفوضى", element: "Chaos", emoji: "🌀",
    difficulty: "hard", staminaCost: 35, totalFloors: 7,
    enemies: ["كيان الفوضى المتجسد", "محارب الأبعاد الضائع", "مارد الكون"],
    bossName: "سيد الفوضى المطلقة الكوني",
    rewardGold: 6000, rewardXp: 1500, rewardFragments: 4, ticketChance: 40,
    statMult: 2.2, color: 0x6c5ce7,
  },
];

export function getDailyDungeons(): DungeonTemplate[] {
  const dayOfYear = Math.floor(Date.now() / 86_400_000);
  const easy = DUNGEON_TEMPLATES.filter(d => d.difficulty === "easy");
  const medium = DUNGEON_TEMPLATES.filter(d => d.difficulty === "medium");
  const hard = DUNGEON_TEMPLATES.filter(d => d.difficulty === "hard");
  return [
    easy[dayOfYear % easy.length],
    medium[dayOfYear % medium.length],
    hard[dayOfYear % hard.length],
  ].filter(Boolean) as DungeonTemplate[];
}

export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Expedition System ─────────────────────────────────────────────────────────

export interface MissionType {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const MISSION_TYPES: MissionType[] = [
  { id: "patrol",      name: "دورية",      emoji: "🛡️", description: "حراسة المنطقة والقضاء على التهديدات الصغيرة" },
  { id: "raid",        name: "غارة",       emoji: "⚔️", description: "الهجوم المباغت على وكر الأعداء وسرقة كنوزهم" },
  { id: "scout",       name: "استطلاع",    emoji: "🔍", description: "رصد تحركات الأعداء وجمع المعلومات الحساسة" },
  { id: "investigate", name: "تحقيق",      emoji: "🕵️", description: "التحقيق في ظاهرة غامضة وكشف أسرارها" },
  { id: "infiltrate",  name: "تسلل",       emoji: "🌙", description: "التسلل إلى مقر العدو تحت جنح الظلام" },
];

export interface ExpeditionDifficulty {
  id: string;
  name: string;
  emoji: string;
  durationMinutes: number;
  goldBase: number;
  xpBase: number;
  fragmentBase: number;
  ticketChance: number;
}

export const EXPEDITION_DIFFICULTIES: ExpeditionDifficulty[] = [
  { id: "easy",    name: "سهلة",     emoji: "🟢", durationMinutes: 30,  goldBase: 500,   xpBase: 100,  fragmentBase: 0, ticketChance: 0  },
  { id: "medium",  name: "متوسطة",   emoji: "🟡", durationMinutes: 120, goldBase: 1500,  xpBase: 350,  fragmentBase: 1, ticketChance: 5  },
  { id: "hard",    name: "صعبة",     emoji: "🔴", durationMinutes: 360, goldBase: 4000,  xpBase: 900,  fragmentBase: 2, ticketChance: 15 },
  { id: "extreme", name: "قاتلة",    emoji: "💀", durationMinutes: 720, goldBase: 10000, xpBase: 2000, fragmentBase: 4, ticketChance: 30 },
];

export function calcExpeditionRewards(
  missionId: string,
  difficulty: ExpeditionDifficulty,
  avgLevel: number,
): { gold: number; xp: number; fragments: number; items: string[] } {
  const levelBonus = 1 + (avgLevel - 1) * 0.05;
  const gold = Math.floor(difficulty.goldBase * levelBonus * (0.85 + Math.random() * 0.3));
  const xp = Math.floor(difficulty.xpBase * levelBonus * (0.85 + Math.random() * 0.3));
  const fragments = difficulty.fragmentBase + (Math.random() * 100 < difficulty.ticketChance ? 1 : 0);

  const itemPools: Record<string, string[]> = {
    patrol:      ["درع مكسور", "سيف صدئ", "دواء صغير"],
    raid:        ["كنز مسروق", "مفتاح قديم", "خاتم محارب"],
    scout:       ["خريطة سرية", "بلورة رصد", "ورقة معلومات"],
    investigate: ["نبتة نادرة", "حجر لغز", "وثيقة مشفرة"],
    infiltrate:  ["مادة متفجرة", "قفل مكسور", "معلومات استخباراتية"],
  };
  const pool = itemPools[missionId] ?? itemPools["patrol"];
  const items = Math.random() > 0.6 ? [pool[Math.floor(Math.random() * pool.length)]] : [];
  return { gold, xp, fragments, items };
}

// ── Bounty Templates ──────────────────────────────────────────────────────────

export interface BountyTemplate {
  key: string;
  emoji: string;
  name: string;
  descTemplate: string;
  minTarget: number;
  maxTarget: number;
  rewardGold: number;
  rewardXp: number;
  rewardGems: number;
}

export const BOUNTY_TEMPLATES: BountyTemplate[] = [
  { key: "explore_floors",    emoji: "🗺️", name: "مستكشف",          descTemplate: "امسح {count} طابق في الاستكشاف",           minTarget: 5,  maxTarget: 15, rewardGold: 1000, rewardXp: 200, rewardGems: 0 },
  { key: "explore_wins",      emoji: "⚔️", name: "محارب النهار",    descTemplate: "اهزم {count} عدو في الاستكشاف",             minTarget: 3,  maxTarget: 10, rewardGold: 800,  rewardXp: 150, rewardGems: 0 },
  { key: "pvp_wins",          emoji: "🏆", name: "مقاتل الساحة",    descTemplate: "فز بـ {count} معارك PvP",                  minTarget: 1,  maxTarget: 5,  rewardGold: 2000, rewardXp: 500, rewardGems: 2 },
  { key: "streak",            emoji: "🔥", name: "تسلسل الانتصار",  descTemplate: "حقق {count} انتصارات متتالية في الاستكشاف", minTarget: 5,  maxTarget: 15, rewardGold: 1500, rewardXp: 300, rewardGems: 1 },
  { key: "expedition",        emoji: "⛺", name: "قائد البعثات",    descTemplate: "أكمل {count} بعثة واحصل على غنائمها",       minTarget: 1,  maxTarget: 3,  rewardGold: 1200, rewardXp: 250, rewardGems: 0 },
  { key: "dungeon_complete",  emoji: "🏰", name: "فاتح الزنازين",   descTemplate: "أكمل {count} زنزانة يومية",                 minTarget: 1,  maxTarget: 3,  rewardGold: 2500, rewardXp: 600, rewardGems: 3 },
  { key: "boss_kill",         emoji: "👹", name: "قاتل الزعماء",    descTemplate: "اهزم {count} زعيم في الاستكشاف",            minTarget: 1,  maxTarget: 3,  rewardGold: 3000, rewardXp: 800, rewardGems: 2 },
  { key: "summon_rarity",     emoji: "💎", name: "صياد النجوم",     descTemplate: "استدع شخصية بمرتبة S أو أعلى {count} مرة",  minTarget: 1,  maxTarget: 3,  rewardGold: 500,  rewardXp: 100, rewardGems: 5 },
];

export function getDailyBounties(seed: number = 0): BountyTemplate[] {
  const dayOfYear = Math.floor(Date.now() / 86_400_000) + seed;
  const picks: BountyTemplate[] = [];
  const indices = new Set<number>();
  let i = 0;
  while (picks.length < 5) {
    const idx = (dayOfYear * 7 + i * 13 + seed) % BOUNTY_TEMPLATES.length;
    if (!indices.has(idx)) {
      indices.add(idx);
      picks.push(BOUNTY_TEMPLATES[idx]);
    }
    i++;
  }
  return picks;
}

export function getBountyTarget(template: BountyTemplate, seed: number = 0): number {
  const range = template.maxTarget - template.minTarget + 1;
  const dayOfYear = Math.floor(Date.now() / 86_400_000);
  return template.minTarget + ((dayOfYear * 3 + seed * 7) % range);
}

// ── Random Explore Events ─────────────────────────────────────────────────────

export interface RandomEvent {
  type: "treasure" | "fragment" | "bonus_xp" | "gem" | "elite" | "rest";
  emoji: string;
  title: string;
  desc: string;
  goldBonus: number;
  xpBonus: number;
  gemBonus: number;
  fragmentBonus: number;
}

export function rollRandomEvent(): RandomEvent | null {
  const roll = Math.random() * 100;
  if (roll > 22) return null;

  const events: RandomEvent[] = [
    { type: "treasure",  emoji: "💰", title: "كنز مخفي!",        desc: "وجدت صندوقاً دفيناً مليئاً بالذهب!",      goldBonus: 2.0,  xpBonus: 0,    gemBonus: 0, fragmentBonus: 0 },
    { type: "treasure",  emoji: "💰", title: "غرفة الكنوز!",      desc: "طابق مليء بالثروات! الذهب يتضاعف!",        goldBonus: 1.5,  xpBonus: 0,    gemBonus: 0, fragmentBonus: 0 },
    { type: "bonus_xp",  emoji: "✨", title: "فيض طاقة!",         desc: "موجة خبرة تصطدم بك! XP يتضاعف!",           goldBonus: 0,    xpBonus: 2.0,  gemBonus: 0, fragmentBonus: 0 },
    { type: "fragment",  emoji: "🌟", title: "شظية استدعاء!",     desc: "عثرت على شظية استدعاء نادرة! اجمع 10 لتحصل على استدعاء مجاني!", goldBonus: 0, xpBonus: 0, gemBonus: 0, fragmentBonus: 1 },
    { type: "fragment",  emoji: "🌟", title: "كنز الاستدعاء!",    desc: "شظيتان نادرتان في نفس الوقت!",             goldBonus: 0,    xpBonus: 0,    gemBonus: 0, fragmentBonus: 2 },
    { type: "gem",       emoji: "💎", title: "أحجار كريمة!",      desc: "جوهرة مضيئة تسقط من يد عدوك!",            goldBonus: 0,    xpBonus: 0,    gemBonus: 2, fragmentBonus: 0 },
    { type: "rest",      emoji: "⚡", title: "طاقة تعافٍ!",       desc: "منطقة تعافٍ سحرية! XP مضاعف وذهب إضافي!", goldBonus: 1.3,  xpBonus: 1.5,  gemBonus: 0, fragmentBonus: 0 },
  ];

  const weights = [25, 20, 20, 12, 8, 5, 10];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < events.length; i++) {
    r -= weights[i];
    if (r <= 0) return events[i];
  }
  return events[0];
}

// ── Streak Bonuses ────────────────────────────────────────────────────────────

export function getStreakBonus(streak: number): { goldMult: number; label: string } {
  if (streak >= 25) return { goldMult: 1.5,  label: "🔥🔥🔥 **×25 تسلسل** — ذهب ×1.5!" };
  if (streak >= 15) return { goldMult: 1.35, label: "🔥🔥 **×15 تسلسل** — ذهب ×1.35!" };
  if (streak >= 10) return { goldMult: 1.25, label: "🔥🔥 **×10 تسلسل** — ذهب ×1.25!" };
  if (streak >= 5)  return { goldMult: 1.15, label: "🔥 **×5 تسلسل** — ذهب ×1.15!" };
  return { goldMult: 1.0, label: "" };
}

export function getStreakMilestoneGems(streak: number): number {
  if (streak === 25) return 3;
  if (streak === 50) return 10;
  if (streak === 100) return 25;
  return 0;
}
