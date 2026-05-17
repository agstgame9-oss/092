import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "../../lib/db.js";
import { playersTable, inventoryTable, itemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, errorEmbed, successEmbed } from "../../lib/embeds.js";
import { mainMenuRow } from "../../lib/buttons.js";

export const data = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("🎒 عرض مخزون العناصر الخاص بك");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")], components: [] });

  const items = await db
    .select({ inv: inventoryTable, item: itemsTable })
    .from(inventoryTable)
    .innerJoin(itemsTable, eq(inventoryTable.itemId, itemsTable.id))
    .where(eq(inventoryTable.discordId, interaction.user.id));

  if (!items.length) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.warning)
        .setTitle("🎒 المخزون")
        .setDescription("مخزونك فارغ!\n\nيمكن الحصول على العناصر من الأحداث والمهام ومكافآت الزعماء.")],
      components: [mainMenuRow()],
    });
  }

  const TYPE_EMOJI: Record<string, string> = {
    weapon: "⚔️", armor: "🛡️", accessory: "💍", consumable: "🧪",
    material: "🪨", summon_ticket: "🎫", currency: "💰", key: "🗝️", special: "⭐",
  };

  const TYPE_AR: Record<string, string> = {
    weapon: "سلاح", armor: "درع", accessory: "إكسسوار", consumable: "مستهلك",
    material: "مادة", summon_ticket: "تذكرة استدعاء", currency: "عملة", key: "مفتاح", special: "خاص",
  };

  const rarityOrder = ["SSS+", "SSS", "SS", "S", "A", "B", "C", "D"];
  items.sort((a, b) => rarityOrder.indexOf(a.item.rarity) - rarityOrder.indexOf(b.item.rarity));

  const consumables = items.filter(({ item }) => item.type === "consumable" || item.type === "summon_ticket");

  const lines = items.map(({ inv, item }) => {
    const emoji = TYPE_EMOJI[item.type] ?? "📦";
    const rarity = RARITY_EMOJI[item.rarity] ?? item.rarity;
    const qty = inv.quantity > 1 ? ` (×${inv.quantity})` : "";
    const typeAr = TYPE_AR[item.type] ?? item.type;
    return `${emoji} ${rarity} **${item.name}**${qty} — *${typeAr}* | 💰 ${item.baseValue.toLocaleString()}`;
  });

  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const next = current ? current + "\n" + line : line;
    if (next.length > 900) { chunks.push(current); current = line; }
    else current = next;
  }
  if (current) chunks.push(current);

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`🎒 مخزون ${player.username} (${items.length} عنصر)`)
    .setDescription(chunks[0] ?? "فارغ")
    .setFooter({ text: "تُكتسب العناصر من الأحداث والمهام والزعماء" })
    .setTimestamp();

  const navButtons: ButtonBuilder[] = [
    new ButtonBuilder().setCustomId("act:profile").setLabel("👤 الملف الشخصي").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("quests:view").setLabel("📝 المهام").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Primary),
  ];

  // Add use-button for first available consumable
  if (consumables.length > 0) {
    const first = consumables[0]!;
    navButtons.push(
      new ButtonBuilder()
        .setCustomId(`inventory:use:${first.item.id}`)
        .setLabel(`🧪 استخدم: ${first.item.name}`)
        .setStyle(ButtonStyle.Success)
    );
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...navButtons);

  await interaction.editReply({ embeds: [embed], components: [navRow] });
}
