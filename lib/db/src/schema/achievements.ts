import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  requirement: integer("requirement").notNull().default(1),
  rewardGold: integer("reward_gold").notNull().default(0),
  rewardGems: integer("reward_gems").notNull().default(0),
  rewardTitle: text("reward_title"),
  emoji: text("emoji").notNull().default("🏆"),
  isSecret: boolean("is_secret").notNull().default(false),
});

export const playerAchievementsTable = pgTable("player_achievements", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  achievementKey: text("achievement_key").notNull(),
  progress: integer("progress").notNull().default(0),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  rewardClaimed: boolean("reward_claimed").notNull().default(false),
});

export type Achievement = typeof achievementsTable.$inferSelect;
export type PlayerAchievement = typeof playerAchievementsTable.$inferSelect;
