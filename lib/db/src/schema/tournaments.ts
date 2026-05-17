import { pgTable, serial, text, integer, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentStatusEnum = pgEnum("tournament_status", ["registration", "active", "finals", "completed", "cancelled"]);

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  guildServerId: text("guild_server_id").notNull(),
  channelId: text("channel_id").notNull(),
  organizerDiscordId: text("organizer_discord_id").notNull(),
  size: integer("size").notNull().default(16),
  currentRound: integer("current_round").notNull().default(0),
  totalRounds: integer("total_rounds").notNull().default(4),
  status: tournamentStatusEnum("status").notNull().default("registration"),
  bracket: jsonb("bracket").$type<Array<{ round: number; matchId: string; player1: string; player2: string | null; winner: string | null; battleId: string | null }>>().default([]),
  prizePool: integer("prize_pool").notNull().default(0),
  prizes: jsonb("prizes").$type<Array<{ rank: number; gold: number; gems: number; title?: string }>>().default([]),
  registrationDeadline: timestamp("registration_deadline"),
  spectatorBets: jsonb("spectator_bets").$type<Record<string, { discordId: string; username: string; betOn: string; amount: number }>>().default({}),
  winnerId: text("winner_id"),
  winnerUsername: text("winner_username"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tournamentParticipantsTable = pgTable("tournament_participants", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournamentsTable.id),
  discordId: text("discord_id").notNull(),
  username: text("username").notNull(),
  seed: integer("seed"),
  isEliminated: boolean("is_eliminated").notNull().default(false),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export type Tournament = typeof tournamentsTable.$inferSelect;
export type TournamentParticipant = typeof tournamentParticipantsTable.$inferSelect;
