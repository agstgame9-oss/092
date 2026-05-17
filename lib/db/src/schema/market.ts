import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listingTypeEnum = pgEnum("listing_type", ["fixed", "auction"]);
export const listingStatusEnum = pgEnum("listing_status", ["active", "sold", "cancelled", "expired"]);

export const marketListingsTable = pgTable("market_listings", {
  id: serial("id").primaryKey(),
  sellerDiscordId: text("seller_discord_id").notNull(),
  sellerUsername: text("seller_username").notNull(),
  listingType: listingTypeEnum("listing_type").notNull().default("fixed"),
  itemType: text("item_type").notNull(),
  itemId: integer("item_id"),
  characterId: integer("character_id"),
  playerCharId: integer("player_char_id"),
  itemName: text("item_name").notNull(),
  itemRarity: text("item_rarity").notNull(),
  animeSource: text("anime_source"),
  element: text("element"),
  quantity: integer("quantity").notNull().default(1),
  price: integer("price").notNull(),
  buyNowPrice: integer("buy_now_price"),
  currentBid: integer("current_bid"),
  highestBidderDiscordId: text("highest_bidder_discord_id"),
  highestBidderUsername: text("highest_bidder_username"),
  minBidIncrement: integer("min_bid_increment").notNull().default(100),
  status: listingStatusEnum("status").notNull().default("active"),
  buyerDiscordId: text("buyer_discord_id"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auctionBidsTable = pgTable("auction_bids", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => marketListingsTable.id),
  bidderDiscordId: text("bidder_discord_id").notNull(),
  bidderUsername: text("bidder_username").notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tradeOffersTable = pgTable("trade_offers", {
  id: serial("id").primaryKey(),
  initiatorDiscordId: text("initiator_discord_id").notNull(),
  targetDiscordId: text("target_discord_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  offeredItemsJson: text("offered_items_json").notNull(),
  requestedItemsJson: text("requested_items_json").notNull(),
  status: text("status").notNull().default("pending"),
  initiatorConfirmed: boolean("initiator_confirmed").notNull().default(false),
  targetConfirmed: boolean("target_confirmed").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMarketListingSchema = createInsertSchema(marketListingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuctionBidSchema = createInsertSchema(auctionBidsTable).omit({ id: true, createdAt: true });
export type MarketListing = typeof marketListingsTable.$inferSelect;
export type AuctionBid = typeof auctionBidsTable.$inferSelect;
export type TradeOffer = typeof tradeOffersTable.$inferSelect;
