import { EmbedBuilder, ColorResolvable } from "discord.js";
export type { ColorResolvable };

export const COLORS = {
  primary: 0x7C3AED as ColorResolvable,
  success: 0x10B981 as ColorResolvable,
  danger: 0xEF4444 as ColorResolvable,
  warning: 0xF59E0B as ColorResolvable,
  info: 0x3B82F6 as ColorResolvable,
  gold: 0xF59E0B as ColorResolvable,
  fire: 0xFF4500 as ColorResolvable,
};

export const RARITY_COLORS: Record<string, ColorResolvable> = {
  "D": 0x6B7280,
  "C": 0x10B981,
  "B": 0x3B82F6,
  "A": 0x8B5CF6,
  "S": 0xF59E0B,
  "SS": 0xF97316,
  "SSS": 0xEF4444,
  "SSS+": 0xEC4899,
};

export const RARITY_EMOJI: Record<string, string> = {
  "D": "⬛",
  "C": "🟩",
  "B": "🟦",
  "A": "🟪",
  "S": "🟨",
  "SS": "🟧",
  "SSS": "🟥",
  "SSS+": "💎",
};

export const ELEMENT_EMOJI: Record<string, string> = {
  Fire: "🔥", Water: "💧", Earth: "🌿", Wind: "🌀",
  Lightning: "⚡", Ice: "❄️", Light: "✨", Dark: "🌑",
  Chaos: "☄️", Order: "⚖️", Space: "🌌", Time: "⏳",
};

export function errorEmbed(msg: string) {
  return new EmbedBuilder().setColor(COLORS.danger).setDescription(`❌ ${msg}`);
}

export function successEmbed(msg: string) {
  return new EmbedBuilder().setColor(COLORS.success).setDescription(`✅ ${msg}`);
}

export function infoEmbed(title: string, desc: string) {
  return new EmbedBuilder().setColor(COLORS.primary).setTitle(title).setDescription(desc);
}
