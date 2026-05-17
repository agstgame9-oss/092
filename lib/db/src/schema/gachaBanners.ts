import { pgTable, serial, text, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const gachaBannersTable = pgTable("gacha_banners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  bannerType: text("banner_type").notNull().default("limited"),
  featuredCharacterIds: jsonb("featured_character_ids").$type<number[]>().default([]),
  rateOverrides: jsonb("rate_overrides").$type<Record<string, number>>().default({}),
  costPerPull: integer("cost_per_pull").notNull().default(10),
  costPer10Pull: integer("cost_per_10_pull").notNull().default(90),
  currency: text("currency").notNull().default("gems"),
  pityAt: integer("pity_at").notNull().default(80),
  guaranteedRarity: text("guaranteed_rarity").notNull().default("SSS"),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  isActive: boolean("is_active").notNull().default(false),
  imageUrl: text("image_url").notNull().default(""),
  totalPulls: integer("total_pulls").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type GachaBanner = typeof gachaBannersTable.$inferSelect;
export type NewGachaBanner = typeof gachaBannersTable.$inferInsert;
