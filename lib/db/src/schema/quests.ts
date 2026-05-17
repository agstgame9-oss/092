import { pgTable, serial, text, integer, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const questTypeEnum = pgEnum("quest_type", ["daily", "weekly"]);
export const questCategoryEnum = pgEnum("quest_category", ["combat", "exploration", "social", "collection", "special"]);

export const playerQuestsTable = pgTable("player_quests", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  questKey: text("quest_key").notNull(),
  questType: questTypeEnum("quest_type").notNull().default("daily"),
  progress: integer("progress").notNull().default(0),
  goal: integer("goal").notNull().default(1),
  isCompleted: boolean("is_completed").notNull().default(false),
  isClaimed: boolean("is_claimed").notNull().default(false),
  rewardGold: integer("reward_gold").notNull().default(0),
  rewardGems: integer("reward_gems").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PlayerQuest = typeof playerQuestsTable.$inferSelect;
