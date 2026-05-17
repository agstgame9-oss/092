import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cooldownsTable = pgTable("cooldowns", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  command: text("command").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminLogsTable = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminDiscordId: text("admin_discord_id").notNull(),
  adminUsername: text("admin_username").notNull(),
  guildServerId: text("guild_server_id").notNull(),
  action: text("action").notNull(),
  targetDiscordId: text("target_discord_id"),
  targetUsername: text("target_username"),
  details: text("details"),
  reason: text("reason"),
  reversible: boolean("reversible").notNull().default(true),
  wasReversed: boolean("was_reversed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stocksTable = pgTable("stocks", {
  id: serial("id").primaryKey(),
  franchiseName: text("franchise_name").notNull().unique(),
  currentPrice: integer("current_price").notNull().default(1000),
  previousPrice: integer("previous_price").notNull().default(1000),
  priceHistory: text("price_history").notNull().default("[]"),
  activityScore: integer("activity_score").notNull().default(0),
  totalVolume: integer("total_volume").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const playerStocksTable = pgTable("player_stocks", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  franchiseName: text("franchise_name").notNull(),
  shares: integer("shares").notNull().default(0),
  avgBuyPrice: integer("avg_buy_price").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const playerTitlesTable = pgTable("player_titles", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  title: text("title").notNull(),
  statBonus: text("stat_bonus").notNull().default("{}"),
  isActive: boolean("is_active").notNull().default(false),
  challengeable: boolean("challengeable").notNull().default(false),
  currentHolderId: text("current_holder_id"),
  earnedAt: timestamp("earned_at").notNull().defaultNow(),
});

export const scheduledEventsTable = pgTable("scheduled_events", {
  id: serial("id").primaryKey(),
  guildServerId: text("guild_server_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: text("config").notNull().default("{}"),
  channelId: text("channel_id"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(false),
  isRepeating: boolean("is_repeating").notNull().default(false),
  repeatIntervalHours: integer("repeat_interval_hours"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const gameEventsTable = pgTable("game_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  element: text("element"),
  bonusMultiplier: text("bonus_multiplier").notNull().default("{}"),
  specialDrops: text("special_drops").notNull().default("[]"),
  associatedBossId: integer("associated_boss_id"),
  durationHours: integer("duration_hours").notNull().default(24),
  isEnabled: boolean("is_enabled").notNull().default(true),
});

export type Cooldown = typeof cooldownsTable.$inferSelect;
export type AdminLog = typeof adminLogsTable.$inferSelect;
export type Stock = typeof stocksTable.$inferSelect;
export type GameEvent = typeof gameEventsTable.$inferSelect;
