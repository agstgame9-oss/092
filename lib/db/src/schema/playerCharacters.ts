import { pgTable, serial, integer, timestamp, boolean, text, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";
import { charactersTable } from "./characters";

export const playerCharactersTable = pgTable("player_characters", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  characterId: integer("character_id").notNull().references(() => charactersTable.id),
  level: integer("level").notNull().default(1),
  ascension: integer("ascension").notNull().default(0),
  copies: integer("copies").notNull().default(1),
  isLocked: boolean("is_locked").notNull().default(false),
  isOnParty: boolean("is_on_party").notNull().default(false),
  currentHp: integer("current_hp"),
  currentEnergy: integer("current_energy").notNull().default(0),
  skill1Cooldown: integer("skill1_cooldown").notNull().default(0),
  skill2Cooldown: integer("skill2_cooldown").notNull().default(0),
  skill3Cooldown: integer("skill3_cooldown").notNull().default(0),
  totalDamageDealt: integer("total_damage_dealt").notNull().default(0),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
});

export const insertPlayerCharacterSchema = createInsertSchema(playerCharactersTable).omit({ id: true, acquiredAt: true });
export type InsertPlayerCharacter = z.infer<typeof insertPlayerCharacterSchema>;
export type PlayerCharacter = typeof playerCharactersTable.$inferSelect;
