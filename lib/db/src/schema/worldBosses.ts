import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const worldBossSessionsTable = pgTable("world_boss_sessions", {
  id: serial("id").primaryKey(),
  bossId: integer("boss_id").notNull(),
  guildServerId: text("guild_server_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  bossName: text("boss_name").notNull(),
  totalHp: integer("total_hp").notNull(),
  currentHp: integer("current_hp").notNull(),
  isDefeated: boolean("is_defeated").notNull().default(false),
  participantCount: integer("participant_count").notNull().default(0),
  totalDamageDealt: integer("total_damage_dealt").notNull().default(0),
  lootDistributed: boolean("loot_distributed").notNull().default(false),
  endsAt: timestamp("ends_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const worldBossDamageTable = pgTable("world_boss_damage", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => worldBossSessionsTable.id),
  discordId: text("discord_id").notNull(),
  username: text("username").notNull(),
  damageDealt: integer("damage_dealt").notNull().default(0),
  attackCount: integer("attack_count").notNull().default(0),
  lastAttackAt: timestamp("last_attack_at").notNull().defaultNow(),
});

export const abyssProgressTable = pgTable("abyss_progress", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  currentFloor: integer("current_floor").notNull().default(0),
  maxFloor: integer("max_floor").notNull().default(0),
  currentBossHp: integer("current_boss_hp"),
  floorStartedAt: timestamp("floor_started_at"),
  totalClears: integer("total_clears").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WorldBossSession = typeof worldBossSessionsTable.$inferSelect;
export type WorldBossDamage = typeof worldBossDamageTable.$inferSelect;
export type AbyssProgress = typeof abyssProgressTable.$inferSelect;
