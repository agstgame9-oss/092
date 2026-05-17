import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const serverConfigTable = pgTable("server_config", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  guildName: text("guild_name"),
  isSetup: boolean("is_setup").notNull().default(false),
  setupCompletedAt: timestamp("setup_completed_at"),
  announcementChannelId: text("announcement_channel_id"),
  battleChannelId: text("battle_channel_id"),
  marketChannelId: text("market_channel_id"),
  adminRoleId: text("admin_role_id"),
  playerRoleId: text("player_role_id"),
  language: text("language").notNull().default("en"),
  prefix: text("prefix").notNull().default("/"),
  settings: jsonb("settings").$type<{
    allowPvp: boolean;
    allowMarket: boolean;
    allowGuilds: boolean;
    allowTournaments: boolean;
    allowWorldBoss: boolean;
    allowStocks: boolean;
    xpMultiplier: number;
    goldMultiplier: number;
    staminaRegenRate: number;
  }>().default({
    allowPvp: true,
    allowMarket: true,
    allowGuilds: true,
    allowTournaments: true,
    allowWorldBoss: true,
    allowStocks: true,
    xpMultiplier: 1,
    goldMultiplier: 1,
    staminaRegenRate: 6,
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ServerConfig = typeof serverConfigTable.$inferSelect;
