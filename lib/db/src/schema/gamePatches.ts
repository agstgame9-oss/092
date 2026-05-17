import { pgTable, serial, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const gamePatchesTable = pgTable("game_patches", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  title: text("title").notNull(),
  changelog: jsonb("changelog").$type<{
    newCharacters: string[];
    balanceChanges: string[];
    newBanners: string[];
    systemChanges: string[];
    bugFixes: string[];
    other: string[];
  }>().default({
    newCharacters: [],
    balanceChanges: [],
    newBanners: [],
    systemChanges: [],
    bugFixes: [],
    other: [],
  }),
  discordChannelId: text("discord_channel_id"),
  discordMessageId: text("discord_message_id"),
  publishedBy: text("published_by").notNull().default("dashboard"),
  botReloaded: boolean("bot_reloaded").notNull().default(false),
  discordNotified: boolean("discord_notified").notNull().default(false),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
});

export type GamePatch = typeof gamePatchesTable.$inferSelect;
export type NewGamePatch = typeof gamePatchesTable.$inferInsert;
