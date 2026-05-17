import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { itemsTable } from "./schema/items.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const items = [
  // ─── SUMMON TICKETS ─────────────────────────────────────────────────────────
  { name: "Basic Summon Ticket", description: "Perform a single standard summon", type: "summon_ticket" as const, rarity: "C", baseValue: 150, isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Premium Summon Ticket", description: "Perform a single premium summon with higher rare rates", type: "summon_ticket" as const, rarity: "A", baseValue: 500, isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "SSS Summon Ticket", description: "Guaranteed SSS or higher character summon", type: "summon_ticket" as const, rarity: "SSS", baseValue: 5000, isStackable: true, isTradeable: false, maxStack: 10 },
  { name: "Kaguya Fragment Ticket", description: "Guaranteed chance to summon a Naruto SSS+ character", type: "summon_ticket" as const, rarity: "SSS+", baseValue: 10000, isStackable: true, isTradeable: false, maxStack: 5 },
  { name: "Quincy Holy Ticket", description: "Guaranteed chance to summon a Bleach SSS character", type: "summon_ticket" as const, rarity: "SSS", baseValue: 8000, isStackable: true, isTradeable: false, maxStack: 5 },
  { name: "Slime Lord Ticket", description: "Guaranteed chance to summon a Tensura SSS character", type: "summon_ticket" as const, rarity: "SSS", baseValue: 8000, isStackable: true, isTradeable: false, maxStack: 5 },
  { name: "Cursed King Ticket", description: "Guaranteed chance to summon a JJK SSS character", type: "summon_ticket" as const, rarity: "SSS", baseValue: 8000, isStackable: true, isTradeable: false, maxStack: 5 },
  { name: "Demon King Ticket", description: "Guaranteed chance to summon Anos Voldigoad or equivalent", type: "summon_ticket" as const, rarity: "SSS+", baseValue: 12000, isStackable: true, isTradeable: false, maxStack: 5 },
  { name: "Omni-King Ticket", description: "An unfathomably rare ticket said to never actually exist", type: "summon_ticket" as const, rarity: "SSS+", baseValue: 99999, isStackable: true, isTradeable: false, maxStack: 1 },

  // ─── CONSUMABLES ────────────────────────────────────────────────────────────
  { name: "Stamina Potion", description: "Instantly restores 50 stamina", type: "consumable" as const, rarity: "C", baseValue: 500, effects: [{ type: "stamina_restore", value: 50 }], isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Stamina Flask", description: "Instantly restores 100 stamina", type: "consumable" as const, rarity: "B", baseValue: 900, effects: [{ type: "stamina_restore", value: 100 }], isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Max Stamina Elixir", description: "Fully restores your stamina to maximum", type: "consumable" as const, rarity: "A", baseValue: 1500, effects: [{ type: "stamina_restore", value: 999 }], isStackable: true, isTradeable: true, maxStack: 20 },
  { name: "Small HP Potion", description: "Restores 20% HP in battle", type: "consumable" as const, rarity: "D", baseValue: 100, effects: [{ type: "hp_restore", value: 0.20 }], isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Large HP Potion", description: "Restores 50% HP in battle", type: "consumable" as const, rarity: "C", baseValue: 400, effects: [{ type: "hp_restore", value: 0.50 }], isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Full Revival Elixir", description: "Fully restores HP in battle, usable once per fight", type: "consumable" as const, rarity: "A", baseValue: 2000, effects: [{ type: "hp_restore", value: 1.0 }], isStackable: true, isTradeable: true, maxStack: 10 },
  { name: "EXP Booster (Small)", description: "Doubles EXP gained for 1 hour", type: "consumable" as const, rarity: "B", baseValue: 800, effects: [{ type: "exp_boost", value: 2.0, duration: 60 }], isStackable: true, isTradeable: true, maxStack: 30 },
  { name: "EXP Booster (Large)", description: "Triples EXP gained for 3 hours", type: "consumable" as const, rarity: "A", baseValue: 3000, effects: [{ type: "exp_boost", value: 3.0, duration: 180 }], isStackable: true, isTradeable: true, maxStack: 10 },
  { name: "Gold Booster", description: "Doubles gold earned for 1 hour", type: "consumable" as const, rarity: "B", baseValue: 600, effects: [{ type: "gold_boost", value: 2.0, duration: 60 }], isStackable: true, isTradeable: true, maxStack: 30 },

  // ─── MATERIALS ──────────────────────────────────────────────────────────────
  { name: "Chakra Fruit Essence", description: "Extracted from the God Tree — used in high-tier crafting", type: "material" as const, rarity: "SSS", baseValue: 2000, isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Reishi Crystal", description: "Crystallized spiritual energy from Soul Society", type: "material" as const, rarity: "SS", baseValue: 1500, isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Magicule Crystal", description: "Condensed magical energy from Jura Tempest", type: "material" as const, rarity: "SS", baseValue: 1200, isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Cursed Energy Crystal", description: "Solidified cursed energy from sorcery battles", type: "material" as const, rarity: "SS", baseValue: 1400, isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Source Crystal", description: "A shard of the Source, the origin of all magic", type: "material" as const, rarity: "SSS+", baseValue: 5000, isStackable: true, isTradeable: false, maxStack: 10 },
  { name: "Hollow Mask Fragment", description: "A piece of a Hollow's mask, radiating dark energy", type: "material" as const, rarity: "A", baseValue: 600, isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Goblin Tusk", description: "A tusk from a powerful goblin warlord", type: "material" as const, rarity: "C", baseValue: 80, isStackable: true, isTradeable: true, maxStack: 99 },
  { name: "Monster Cell", description: "A cell that grants monster evolution potential", type: "material" as const, rarity: "S", baseValue: 800, isStackable: true, isTradeable: false, maxStack: 20 },
  { name: "King's Nen Crystal", description: "Crystallized Nen from a Royal Guard", type: "material" as const, rarity: "SS", baseValue: 1800, isStackable: true, isTradeable: true, maxStack: 50 },
  { name: "Sharingan Shard", description: "A fragment of a powerful Sharingan eye", type: "material" as const, rarity: "SS", baseValue: 2200, isStackable: true, isTradeable: false, maxStack: 20 },
  { name: "Espada Hierro Fragment", description: "A piece of an Espada's ultra-hard skin", type: "material" as const, rarity: "S", baseValue: 1000, isStackable: true, isTradeable: true, maxStack: 50 },
  { name: "Hogyoku Shard", description: "A fragment of the orb that breaks the boundary between Shinigami and Hollow", type: "material" as const, rarity: "SSS", baseValue: 8000, isStackable: true, isTradeable: false, maxStack: 5 },
  { name: "Dark Matter Crystal", description: "Compressed dark matter from the edge of the universe", type: "material" as const, rarity: "SSS", baseValue: 5000, isStackable: true, isTradeable: true, maxStack: 10 },
  { name: "Otsutsuki Kāma Seal", description: "A genetic backup of an Otsutsuki, extremely dangerous", type: "material" as const, rarity: "SSS+", baseValue: 15000, isStackable: true, isTradeable: false, maxStack: 3 },
  { name: "Universe Shard", description: "A remnant of an erased universe — near-limitless power", type: "material" as const, rarity: "SSS+", baseValue: 30000, isStackable: true, isTradeable: false, maxStack: 1 },

  // ─── WEAPONS ─────────────────────────────────────────────────────────────────
  { name: "Iron Sword", description: "A basic sword for beginning adventurers", type: "weapon" as const, rarity: "D", baseValue: 200, stats: { atk: 50 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Steel Blade", description: "A reliable steel blade with solid attack power", type: "weapon" as const, rarity: "C", baseValue: 600, stats: { atk: 120 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Mystic Blade", description: "A blade infused with elemental magic", type: "weapon" as const, rarity: "B", baseValue: 1500, stats: { atk: 250, crit: 5 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Spirit Katana", description: "A legendary katana that channels spiritual energy", type: "weapon" as const, rarity: "A", baseValue: 4000, stats: { atk: 500, spd: 30 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Cursed Blade", description: "A cursed weapon that drains enemy life force", type: "weapon" as const, rarity: "S", baseValue: 12000, stats: { atk: 900, crit: 10 }, effects: [{ type: "life_steal", value: 0.10 }], isStackable: false, isTradeable: false, maxStack: 1 },
  { name: "Divine Blade", description: "A blade blessed by divine forces, strikes with holy power", type: "weapon" as const, rarity: "SS", baseValue: 30000, stats: { atk: 1600, crit: 15, critDmg: 20 }, isStackable: false, isTradeable: false, maxStack: 1 },

  // ─── ARMOR ───────────────────────────────────────────────────────────────────
  { name: "Cloth Robe", description: "Basic cloth armor offering minimal protection", type: "armor" as const, rarity: "D", baseValue: 150, stats: { def: 30 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Leather Armor", description: "Light leather armor for mobile fighters", type: "armor" as const, rarity: "C", baseValue: 500, stats: { def: 80, hp: 200 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Chain Mail", description: "Interlocked metal rings offer good protection", type: "armor" as const, rarity: "B", baseValue: 1200, stats: { def: 180, hp: 500 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Battle Plate", description: "Heavy full-plate armor for tank fighters", type: "armor" as const, rarity: "A", baseValue: 3500, stats: { def: 350, hp: 1000 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Void Armor", description: "Armor made from void matter, absorbs energy attacks", type: "armor" as const, rarity: "S", baseValue: 10000, stats: { def: 600, hp: 2000 }, effects: [{ type: "energy_absorb", value: 0.15 }], isStackable: false, isTradeable: false, maxStack: 1 },

  // ─── ACCESSORIES ─────────────────────────────────────────────────────────────
  { name: "Lucky Charm", description: "A small charm said to bring good fortune in battle", type: "accessory" as const, rarity: "C", baseValue: 300, stats: { crit: 5 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Speed Ring", description: "A ring engraved with wind runes", type: "accessory" as const, rarity: "B", baseValue: 1000, stats: { spd: 40 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Power Bracelet", description: "Amplifies the wearer's physical strength", type: "accessory" as const, rarity: "A", baseValue: 2500, stats: { atk: 200 }, isStackable: false, isTradeable: true, maxStack: 1 },
  { name: "Gem Pouch", description: "A small enchanted pouch that generates summon gems", type: "accessory" as const, rarity: "S", baseValue: 5000, effects: [{ type: "gem_regen", value: 5 }], isStackable: false, isTradeable: false, maxStack: 1 },
  { name: "Amulet of the Void", description: "An amulet containing a fragment of the void — greatly enhances all stats", type: "accessory" as const, rarity: "SS", baseValue: 20000, stats: { atk: 300, def: 300, hp: 1500, spd: 50 }, isStackable: false, isTradeable: false, maxStack: 1 },

  // ─── KEYS ────────────────────────────────────────────────────────────────────
  { name: "Abyss Key", description: "Grants access to one Abyss dungeon run", type: "key" as const, rarity: "B", baseValue: 1000, isStackable: true, isTradeable: false, maxStack: 5 },
  { name: "World Boss Key", description: "Grants entry to a World Boss raid", type: "key" as const, rarity: "A", baseValue: 3000, isStackable: true, isTradeable: false, maxStack: 3 },
  { name: "Tournament Pass", description: "Entry ticket for the current season tournament", type: "key" as const, rarity: "S", baseValue: 5000, isStackable: true, isTradeable: false, maxStack: 2 },

  // ─── CURRENCY ────────────────────────────────────────────────────────────────
  { name: "Gold", description: "The standard currency of the Multiverse Arena", type: "currency" as const, rarity: "D", baseValue: 1, isStackable: true, isTradeable: false, maxStack: 9999999 },
  { name: "Gem", description: "Premium currency used for summons and special items", type: "currency" as const, rarity: "S", baseValue: 100, isStackable: true, isTradeable: false, maxStack: 999999 },

  // ─── SPECIAL ─────────────────────────────────────────────────────────────────
  { name: "Character Awakening Stone", description: "Used to awaken a character to their next form", type: "special" as const, rarity: "SS", baseValue: 15000, isStackable: true, isTradeable: false, maxStack: 10 },
  { name: "Skill Reset Orb", description: "Resets all skill upgrades on a character", type: "special" as const, rarity: "A", baseValue: 2000, isStackable: true, isTradeable: false, maxStack: 5 },
  { name: "Rename Card", description: "Allows you to change your in-game username", type: "special" as const, rarity: "B", baseValue: 500, isStackable: true, isTradeable: false, maxStack: 3 },
  { name: "Guild Creation Token", description: "Required to create a new guild", type: "special" as const, rarity: "A", baseValue: 5000, isStackable: true, isTradeable: false, maxStack: 1 },
];

async function seed() {
  console.log(`Seeding ${items.length} items...`);
  let inserted = 0;

  for (const item of items) {
    try {
      await db.insert(itemsTable).values(item as any).onConflictDoNothing();
      inserted++;
    } catch (err) {
      console.error(`  Failed: ${item.name}:`, err);
    }
  }

  console.log(`\n✅ Done! Seeded ${inserted} items.`);
  await pool.end();
}

seed().catch(err => { console.error(err); pool.end(); process.exit(1); });
