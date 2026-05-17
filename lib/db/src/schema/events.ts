import { pgTable, serial, text, integer, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const eventStatusEnum = pgEnum("event_status", ["upcoming", "active", "ended", "cancelled"]);
export const eventTypeEnum = pgEnum("event_type", ["boss_rush", "gold_rush", "xp_boost", "summon_rate_up", "pvp_tournament", "custom"]);

export const serverEventsTable = pgTable("server_events", {
  id: serial("id").primaryKey(),
  guildServerId: text("guild_server_id").notNull(),
  organizerDiscordId: text("organizer_discord_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: eventTypeEnum("type").notNull().default("custom"),
  status: eventStatusEnum("status").notNull().default("upcoming"),
  channelId: text("channel_id"),
  maxParticipants: integer("max_participants").notNull().default(50),
  rewardGold: integer("reward_gold").notNull().default(0),
  rewardGems: integer("reward_gems").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(0),
  bonusMultiplier: integer("bonus_multiplier").notNull().default(1),
  extraData: jsonb("extra_data").$type<Record<string, unknown>>().default({}),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const eventParticipantsTable = pgTable("event_participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => serverEventsTable.id),
  discordId: text("discord_id").notNull(),
  username: text("username").notNull(),
  score: integer("score").notNull().default(0),
  rewardClaimed: boolean("reward_claimed").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export type ServerEvent = typeof serverEventsTable.$inferSelect;
export type EventParticipant = typeof eventParticipantsTable.$inferSelect;
