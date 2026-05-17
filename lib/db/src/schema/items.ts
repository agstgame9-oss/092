import { pgTable, serial, text, integer, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const itemTypeEnum = pgEnum("item_type", ["weapon", "armor", "accessory", "consumable", "material", "summon_ticket", "currency", "key", "special"]);

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  type: itemTypeEnum("type").notNull(),
  rarity: text("rarity").notNull().default("C"),
  baseValue: integer("base_value").notNull().default(100),
  stats: jsonb("stats").$type<Record<string, number>>(),
  effects: jsonb("effects").$type<Array<{ type: string; value: number; duration?: number }>>(),
  isStackable: boolean("is_stackable").notNull().default(true),
  isTradeable: boolean("is_tradeable").notNull().default(true),
  maxStack: integer("max_stack").notNull().default(999),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inventoryTable = pgTable("inventory", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  itemId: integer("item_id").notNull().references(() => itemsTable.id),
  quantity: integer("quantity").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertItemSchema = createInsertSchema(itemsTable).omit({ id: true, createdAt: true });
export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, updatedAt: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof itemsTable.$inferSelect;
export type Inventory = typeof inventoryTable.$inferSelect;
