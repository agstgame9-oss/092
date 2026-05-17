import { pgTable, serial, text, integer, real, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rarityEnum = pgEnum("rarity", ["D", "C", "B", "A", "S", "SS", "SSS", "SSS+"]);
export const elementEnum = pgEnum("element", ["Fire", "Water", "Earth", "Wind", "Lightning", "Ice", "Light", "Dark", "Chaos", "Order", "Space", "Time"]);

export const skillSchema = z.object({
  name: z.string(),
  description: z.string(),
  energyCost: z.number(),
  cooldown: z.number(),
  damage: z.number(),
  element: z.string().optional(),
  type: z.enum(["damage", "heal", "buff", "debuff", "ultimate"]),
  target: z.enum(["single", "all", "self"]),
  effect: z.object({
    type: z.string().optional(),
    chance: z.number().optional(),
    duration: z.number().optional(),
    value: z.number().optional(),
    stat: z.string().optional(),
    multiplier: z.number().optional(),
  }).optional(),
});

export const passiveSchema = z.object({
  name: z.string(),
  description: z.string(),
  trigger: z.enum(["hp_below", "hp_above", "turn_start", "on_hit", "on_kill", "battle_start", "fury_full", "always"]),
  triggerValue: z.number().optional(),
  effect: z.object({
    stat: z.string().optional(),
    multiplier: z.number().optional(),
    healPercent: z.number().optional(),
    energyRegen: z.number().optional(),
    type: z.string().optional(),
    value: z.number().optional(),
  }),
});

export const charactersTable = pgTable("characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  animeSource: text("anime_source").notNull(),
  rarity: rarityEnum("rarity").notNull(),
  element1: elementEnum("element1").notNull(),
  element2: elementEnum("element2"),
  baseHp: integer("base_hp").notNull(),
  baseAtk: integer("base_atk").notNull(),
  baseDef: integer("base_def").notNull(),
  baseSpd: integer("base_spd").notNull(),
  baseCrit: real("base_crit").notNull().default(0.05),
  baseCritDmg: real("base_crit_dmg").notNull().default(1.5),
  skill1: jsonb("skill1").notNull().$type<z.infer<typeof skillSchema>>(),
  skill2: jsonb("skill2").notNull().$type<z.infer<typeof skillSchema>>(),
  skill3: jsonb("skill3").notNull().$type<z.infer<typeof skillSchema>>(),
  passive: jsonb("passive").notNull().$type<z.infer<typeof passiveSchema>>(),
  imageUrl: text("image_url"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCharacterSchema = createInsertSchema(charactersTable).omit({ id: true, createdAt: true });
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof charactersTable.$inferSelect;
