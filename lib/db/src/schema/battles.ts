import { pgTable, serial, text, integer, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const battleTypeEnum = pgEnum("battle_type", ["pvp", "pve_explore", "pve_abyss", "pve_world_boss", "pve_event", "pve_guild_boss", "pve_tournament"]);
export const battleStatusEnum = pgEnum("battle_status", ["active", "waiting", "finished", "abandoned", "paused"]);

export const combatantStateSchema = z.object({
  playerCharId: z.number(),
  characterId: z.number(),
  name: z.string(),
  currentHp: z.number(),
  maxHp: z.number(),
  atk: z.number(),
  def: z.number(),
  spd: z.number(),
  crit: z.number(),
  critDmg: z.number(),
  energy: z.number(),
  maxEnergy: z.number().default(100),
  furyMeter: z.number().default(0),
  skill1Cooldown: z.number().default(0),
  skill2Cooldown: z.number().default(0),
  skill3Cooldown: z.number().default(0),
  element1: z.string(),
  element2: z.string().optional(),
  statusEffects: z.array(z.object({
    type: z.string(),
    duration: z.number(),
    value: z.number(),
  })).default([]),
  isAlive: z.boolean().default(true),
});

export const battlesTable = pgTable("battles", {
  id: serial("id").primaryKey(),
  type: battleTypeEnum("type").notNull(),
  status: battleStatusEnum("status").notNull().default("active"),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  player1DiscordId: text("player1_discord_id").notNull(),
  player2DiscordId: text("player2_discord_id"),
  bossId: integer("boss_id"),
  player1State: jsonb("player1_state").$type<z.infer<typeof combatantStateSchema>[]>(),
  player2State: jsonb("player2_state").$type<z.infer<typeof combatantStateSchema>[]>(),
  bossState: jsonb("boss_state").$type<z.infer<typeof combatantStateSchema>>(),
  currentTurn: text("current_turn").notNull().default("player1"),
  turnNumber: integer("turn_number").notNull().default(1),
  turnOrder: jsonb("turn_order").$type<Array<{ id: string; spd: number; isPlayer: boolean }>>(),
  battleLog: jsonb("battle_log").notNull().$type<Array<{ turn: number; actor: string; action: string; damage?: number; effect?: string; timestamp: string }>>().default([]),
  winnerId: text("winner_id"),
  xpEarned: integer("xp_earned"),
  goldEarned: integer("gold_earned"),
  floorNumber: integer("floor_number"),
  worldName: text("world_name"),
  isPaused: boolean("is_paused").notNull().default(false),
  pausedByAdmin: boolean("paused_by_admin").notNull().default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBattleSchema = createInsertSchema(battlesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBattle = z.infer<typeof insertBattleSchema>;
export type Battle = typeof battlesTable.$inferSelect;
export type CombatantState = z.infer<typeof combatantStateSchema>;
