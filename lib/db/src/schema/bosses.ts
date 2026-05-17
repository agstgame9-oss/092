import { pgTable, serial, text, integer, real, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { rarityEnum, elementEnum } from "./characters";

export const bossPhaseSchema = z.object({
  threshold: z.number(),
  name: z.string(),
  atkMultiplier: z.number(),
  defMultiplier: z.number(),
  spdMultiplier: z.number(),
  mechanic: z.string(),
  specialMove: z.object({
    name: z.string(),
    description: z.string(),
    damage: z.number(),
    effect: z.string().optional(),
  }),
});

export const bossesTable = pgTable("bosses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  animeSource: text("anime_source").notNull(),
  element1: elementEnum("element1").notNull(),
  element2: elementEnum("element2"),
  tier: text("tier").notNull().default("normal"),
  hp: integer("hp").notNull(),
  atk: integer("atk").notNull(),
  def: integer("def").notNull(),
  spd: integer("spd").notNull(),
  crit: real("crit").notNull().default(0.1),
  critDmg: real("crit_dmg").notNull().default(1.8),
  phases: jsonb("phases").notNull().$type<z.infer<typeof bossPhaseSchema>[]>(),
  weaknesses: jsonb("weaknesses").notNull().$type<string[]>(),
  resistances: jsonb("resistances").notNull().$type<string[]>(),
  immunities: jsonb("immunities").notNull().$type<string[]>(),
  skills: jsonb("skills").notNull().$type<Array<{ name: string; description: string; damage: number; energyCost: number; cooldown: number; effect?: string }>>(),
  passive: text("passive").notNull(),
  lootTable: jsonb("loot_table").notNull().$type<Array<{ itemType: string; itemName: string; chance: number; quantity: number }>>(),
  xpReward: integer("xp_reward").notNull(),
  goldReward: integer("gold_reward").notNull(),
  imageUrl: text("image_url"),
  isWorldBoss: boolean("is_world_boss").notNull().default(false),
  isAbyssBoss: boolean("is_abyss_boss").notNull().default(false),
  abyssFloor: integer("abyss_floor"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBossSchema = createInsertSchema(bossesTable).omit({ id: true, createdAt: true });
export type InsertBoss = z.infer<typeof insertBossSchema>;
export type Boss = typeof bossesTable.$inferSelect;
