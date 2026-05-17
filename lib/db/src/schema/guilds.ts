import { pgTable, serial, text, integer, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guildRoleEnum = pgEnum("guild_role", ["leader", "officer", "member", "recruit"]);

export const guildsTable = pgTable("guilds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  tag: text("tag").notNull().unique(),
  description: text("description"),
  leaderDiscordId: text("leader_discord_id").notNull(),
  guildServerId: text("guild_server_id").notNull(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  treasury: integer("treasury").notNull().default(0),
  maxMembers: integer("max_members").notNull().default(30),
  totalWins: integer("total_wins").notNull().default(0),
  totalBossKills: integer("total_boss_kills").notNull().default(0),
  emblem: text("emblem").notNull().default("⚔️"),
  isOpen: boolean("is_open").notNull().default(true),
  guildBossCooldown: timestamp("guild_boss_cooldown"),
  activeGuildBossId: integer("active_guild_boss_id"),
  activeGuildBossHp: integer("active_guild_boss_hp"),
  perks: jsonb("perks").$type<Record<string, number>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guildMembersTable = pgTable("guild_members", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildsTable.id),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  role: guildRoleEnum("role").notNull().default("recruit"),
  contribution: integer("contribution").notNull().default(0),
  weeklyContribution: integer("weekly_contribution").notNull().default(0),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const guildApplicationsTable = pgTable("guild_applications", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildsTable.id),
  discordId: text("discord_id").notNull(),
  username: text("username").notNull(),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGuildSchema = createInsertSchema(guildsTable).omit({ id: true, createdAt: true });
export const insertGuildMemberSchema = createInsertSchema(guildMembersTable).omit({ id: true, joinedAt: true });
export type Guild = typeof guildsTable.$inferSelect;
export type GuildMember = typeof guildMembersTable.$inferSelect;
