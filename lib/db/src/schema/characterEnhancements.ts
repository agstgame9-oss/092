import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const characterEnhancementsTable = pgTable("character_enhancements", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  playerCharacterId: integer("player_character_id").notNull(),
  enhanceLevel: integer("enhance_level").notNull().default(0),
  totalGoldSpent: integer("total_gold_spent").notNull().default(0),
  totalGemsSpent: integer("total_gems_spent").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CharacterEnhancement = typeof characterEnhancementsTable.$inferSelect;
