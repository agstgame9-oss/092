import { pgTable, serial, text, integer, boolean, jsonb, timestamp, real } from "drizzle-orm/pg-core";

export const expeditionsTable = pgTable("expeditions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  discordId: text("discord_id").notNull(),
  guildServerId: text("guild_server_id").notNull(),
  missionType: text("mission_type").notNull(),
  difficulty: text("difficulty").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  characterIds: jsonb("character_ids").notNull().$type<number[]>().default([]),
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  completesAt: timestamp("completes_at").notNull(),
  rewards: jsonb("rewards").$type<{ gold: number; xp: number; fragments: number; items: string[] }>(),
  isClaimed: boolean("is_claimed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dungeonRunsTable = pgTable("dungeon_runs", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  discordId: text("discord_id").notNull(),
  dungeonId: text("dungeon_id").notNull(),
  dungeonDate: text("dungeon_date").notNull(),
  floorsCleared: integer("floors_cleared").notNull().default(0),
  isComplete: boolean("is_complete").notNull().default(false),
  rewardsClaimed: boolean("rewards_claimed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerBountiesTable = pgTable("player_bounties", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  discordId: text("discord_id").notNull(),
  bountyKey: text("bounty_key").notNull(),
  bountyDate: text("bounty_date").notNull(),
  targetCount: integer("target_count").notNull(),
  currentCount: integer("current_count").notNull().default(0),
  isComplete: boolean("is_complete").notNull().default(false),
  rewardClaimed: boolean("reward_claimed").notNull().default(false),
  rewardGold: integer("reward_gold").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(0),
  rewardGems: integer("reward_gems").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
