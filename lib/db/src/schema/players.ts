import { pgTable, serial, text, integer, real, boolean, jsonb, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  guildId: text("guild_id").notNull(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  xpToNext: integer("xp_to_next").notNull().default(100),
  gold: integer("gold").notNull().default(1000),
  gems: integer("gems").notNull().default(10),
  stamina: integer("stamina").notNull().default(100),
  maxStamina: integer("max_stamina").notNull().default(100),
  staminaLastRegen: timestamp("stamina_last_regen").notNull().defaultNow(),
  activeParty: jsonb("active_party").notNull().$type<number[]>().default([]),
  currentWorld: text("current_world").notNull().default("Training Grounds"),
  currentFloor: integer("current_floor").notNull().default(0),
  maxAbyssFloor: integer("max_abyss_floor").notNull().default(0),
  furyMeter: integer("fury_meter").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  totalDamageDealt: bigint("total_damage_dealt", { mode: "number" }).notNull().default(0),
  guildMemberId: integer("guild_member_id"),
  currentTitle: text("current_title"),
  titleStatBonus: jsonb("title_stat_bonus").$type<Record<string, number>>(),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  freeRollLastUsed: timestamp("free_roll_last_used"),
  dailyLastClaimed: timestamp("daily_last_claimed"),
  weeklyLastClaimed: timestamp("weekly_last_claimed"),
  pvpRating: integer("pvp_rating").notNull().default(1000),
  worldBossContributions: integer("world_boss_contributions").notNull().default(0),
  summonFragments: integer("summon_fragments").notNull().default(0),
  exploreStreak: integer("explore_streak").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
