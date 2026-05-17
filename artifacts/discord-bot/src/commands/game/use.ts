import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { db, playersTable } from "../../lib/db.js";
import { inventoryTable, itemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, errorEmbed } from "../../lib/embeds.js";
import { mainMenuRow } from "../../lib/buttons.js";
import { addXP } from "../../lib/gameEngine.js";

type ItemEffect = { type: string; value: number; duration?: number };

export const data = new SlashCommandBuilder()
  .setName("use")
  .setDescription("🧪 استخدام عنصر من مخزونك")
  .addIntegerOption(o =>
    o.setName("slot").setDescription("رقم العنصر من /inventory").setRequired(true).setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });
  if (player.isBanned) return interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")] });

  const allItems = await db
    .select({ inv: inventoryTable, item: itemsTable })
    .from(inventoryTable)
    .innerJoin(itemsTable, eq(inventoryTable.itemId, itemsTable.id))
    .where(eq(inventoryTable.discordId, discordId));

  if (!allItems.length) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.warning)
        .setTitle("🎒 المخزون فارغ")
        .setDescription("لا توجد عناصر في مخزونك.\nاحصل على العناصر من الأحداث والمهام والزعماء!")],
      components: [mainMenuRow()],
    });
  }

  const rarityOrder = ["SSS+", "SSS", "SS", "S", "A", "B", "C", "D"];
  allItems.sort((a, b) => rarityOrder.indexOf(a.item.rarity) - rarityOrder.indexOf(b.item.rarity));

  const slot = interaction.options.getInteger("slot", true);
  const target = allItems[slot - 1];

  if (!target) {
    const inventoryList = allItems.slice(0, 10).map((it, i) => {
      const r = RARITY_EMOJI[it.item.rarity] ?? it.item.rarity;
      return `**${i + 1}.** ${r} ${it.item.name} (×${it.inv.quantity}) — ${it.item.type}`;
    }).join("\n");
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.warning)
        .setTitle("🎒 رقم غير صالح")
        .setDescription(`لديك **${allItems.length}** عنصر:\n\n${inventoryList}${allItems.length > 10 ? `\n...و ${allItems.length - 10} آخرين` : ""}`)
        .setFooter({ text: "استخدم /inventory لعرض القائمة كاملة" })],
    });
  }

  const { inv, item } = target;

  if (item.type !== "consumable" && item.type !== "summon_ticket") {
    return interaction.editReply({
      embeds: [errorEmbed(`**${item.name}** (${item.type}) لا يمكن استخدامه مباشرة.\nيمكن استخدام العناصر الاستهلاكية وتذاكر الاستدعاء فقط.`)],
    });
  }

  const effectsArr = item.effects as ItemEffect[] | null;
  const updates: Partial<typeof playersTable.$inferSelect> = {};
  const effectLines: string[] = [];
  let xpToAdd = 0;

  if (Array.isArray(effectsArr) && effectsArr.length > 0) {
    for (const effect of effectsArr) {
      switch (effect.type) {
        case "stamina_restore":
        case "stamina": {
          const newStam = Math.min(player.maxStamina, player.stamina + effect.value);
          updates.stamina = newStam;
          effectLines.push(`+${effect.value} ⚡ طاقة (${newStam}/${player.maxStamina})`);
          break;
        }
        case "stamina_full": {
          updates.stamina = player.maxStamina;
          effectLines.push(`⚡ استعادة طاقة كاملة (${player.maxStamina}/${player.maxStamina})`);
          break;
        }
        case "gold": {
          updates.gold = (updates.gold ?? player.gold) + effect.value;
          effectLines.push(`+${effect.value.toLocaleString()} 🪙 ذهب`);
          break;
        }
        case "gems": {
          updates.gems = (updates.gems ?? player.gems) + effect.value;
          effectLines.push(`+${effect.value} 💎 جواهر`);
          break;
        }
        case "xp": {
          xpToAdd += effect.value;
          effectLines.push(`+${effect.value.toLocaleString()} ✨ خبرة`);
          break;
        }
        case "max_stamina": {
          updates.maxStamina = (updates.maxStamina ?? player.maxStamina) + effect.value;
          effectLines.push(`+${effect.value} ⚡ طاقة قصوى دائمة`);
          break;
        }
      }
    }
  }

  if (Object.keys(updates).length === 0 && xpToAdd === 0) {
    return interaction.editReply({
      embeds: [errorEmbed(`**${item.name}** لا يملك تأثيرات قابلة للتطبيق.`)],
    });
  }

  updates.updatedAt = new Date();
  await db.update(playersTable).set(updates).where(eq(playersTable.discordId, discordId));
  if (xpToAdd > 0) await addXP(player.id, xpToAdd).catch(() => null);

  if (inv.quantity > 1) {
    await db.update(inventoryTable).set({ quantity: inv.quantity - 1 }).where(eq(inventoryTable.id, inv.id));
  } else {
    await db.delete(inventoryTable).where(eq(inventoryTable.id, inv.id));
  }

  const rarity = RARITY_EMOJI[item.rarity] ?? item.rarity;
  const remaining = inv.quantity - 1;

  const inventoryBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:profile").setLabel("👤 الملف الشخصي").setStyle(ButtonStyle.Secondary),
  );

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle(`🧪 تم استخدام: ${rarity} ${item.name}`)
      .setDescription(effectLines.join("\n") || "تم تطبيق التأثير.")
      .addFields(
        { name: "📦 المتبقي في مخزونك", value: remaining > 0 ? `${remaining} قطعة` : "نفدت الكمية", inline: true },
      )
      .setFooter({ text: item.description })
      .setTimestamp()],
    components: [inventoryBtn],
  });
}
