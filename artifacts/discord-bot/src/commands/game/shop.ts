import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { db, playersTable } from "../../lib/db.js";
import { eq } from "drizzle-orm";
import { COLORS, errorEmbed, successEmbed } from "../../lib/embeds.js";
import { applyStaminaRegen } from "../../lib/gameEngine.js";

type ShopItem = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  goldCost: number;
  gemCost: number;
  stackable: boolean;
  effect: (player: typeof playersTable.$inferSelect, qty: number) => Partial<typeof playersTable.$inferSelect>;
  effectStr: (qty: number) => string;
};

const SHOP_ITEMS: ShopItem[] = [
  {
    id: "stamina_small",
    name: "جرعة الطاقة",
    description: "استعادة 50 طاقة فوراً",
    emoji: "⚡",
    goldCost: 500,
    gemCost: 0,
    stackable: true,
    effect: (p, qty) => ({ stamina: Math.min(p.maxStamina, p.stamina + 50 * qty) }),
    effectStr: (qty) => `+${50 * qty} ⚡ طاقة`,
  },
  {
    id: "stamina_large",
    name: "قارورة الطاقة",
    description: "استعادة 100 طاقة فوراً",
    emoji: "🧪",
    goldCost: 900,
    gemCost: 0,
    stackable: true,
    effect: (p, qty) => ({ stamina: Math.min(p.maxStamina, p.stamina + 100 * qty) }),
    effectStr: (qty) => `+${100 * qty} ⚡ طاقة`,
  },
  {
    id: "stamina_full",
    name: "إكسير الطاقة الكامل",
    description: "استعادة طاقتك بالكامل",
    emoji: "🌟",
    goldCost: 1500,
    gemCost: 0,
    stackable: false,
    effect: (p) => ({ stamina: p.maxStamina }),
    effectStr: () => "استعادة ⚡ طاقة كاملة",
  },
  {
    id: "gems_small",
    name: "كيس جواهر صغير",
    description: "احصل على 5 جواهر استدعاء",
    emoji: "💎",
    goldCost: 1500,
    gemCost: 0,
    stackable: true,
    effect: (p, qty) => ({ gems: p.gems + 5 * qty }),
    effectStr: (qty) => `+${5 * qty} 💎 جواهر`,
  },
  {
    id: "gems_medium",
    name: "حقيبة جواهر",
    description: "احصل على 15 جواهر استدعاء",
    emoji: "💎",
    goldCost: 4000,
    gemCost: 0,
    stackable: true,
    effect: (p, qty) => ({ gems: p.gems + 15 * qty }),
    effectStr: (qty) => `+${15 * qty} 💎 جواهر`,
  },
  {
    id: "gems_large",
    name: "صندوق جواهر",
    description: "احصل على 40 جواهر (4 سحبات ×10!)",
    emoji: "💎",
    goldCost: 10000,
    gemCost: 0,
    stackable: true,
    effect: (p, qty) => ({ gems: p.gems + 40 * qty }),
    effectStr: (qty) => `+${40 * qty} 💎 جواهر`,
  },
  {
    id: "gold_pack",
    name: "حزمة ذهب",
    description: "احصل على 2,000 ذهب فوراً",
    emoji: "🪙",
    goldCost: 0,
    gemCost: 5,
    stackable: true,
    effect: (p, qty) => ({ gold: p.gold + 2000 * qty }),
    effectStr: (qty) => `+${(2000 * qty).toLocaleString()} 🪙 ذهب`,
  },
  {
    id: "gold_vault",
    name: "خزينة الذهب",
    description: "احصل على 10,000 ذهب فوراً",
    emoji: "🏦",
    goldCost: 0,
    gemCost: 20,
    stackable: true,
    effect: (p, qty) => ({ gold: p.gold + 10000 * qty }),
    effectStr: (qty) => `+${(10000 * qty).toLocaleString()} 🪙 ذهب`,
  },
  {
    id: "stamina_expand",
    name: "توسيع الطاقة",
    description: "زيادة دائمة للحد الأقصى +10",
    emoji: "💪",
    goldCost: 5000,
    gemCost: 0,
    stackable: true,
    effect: (p, qty) => ({
      maxStamina: p.maxStamina + 10 * qty,
      stamina: Math.min(p.maxStamina + 10 * qty, p.stamina + 10 * qty),
    }),
    effectStr: (qty) => `+${10 * qty} ⚡ طاقة قصوى (دائم)`,
  },
  {
    id: "mystery_box",
    name: "صندوق الغموض",
    description: "مكافأة عشوائية: 1000-5000 ذهب أو 5-15 جواهر",
    emoji: "🎁",
    goldCost: 0,
    gemCost: 8,
    stackable: false,
    effect: (p) => {
      if (Math.random() < 0.5) {
        return { gold: p.gold + Math.floor(1000 + Math.random() * 4000) };
      } else {
        return { gems: p.gems + Math.floor(5 + Math.random() * 11) };
      }
    },
    effectStr: () => "مكافأة عشوائية!",
  },
];

function shopEmbed(player: typeof playersTable.$inferSelect): EmbedBuilder {
  const goldItems = SHOP_ITEMS.filter(i => i.goldCost > 0);
  const gemItems  = SHOP_ITEMS.filter(i => i.gemCost > 0);

  const goldLines = goldItems.map((i, idx) =>
    `**${idx + 1}.** ${i.emoji} **${i.name}** — ${i.goldCost.toLocaleString()} 🪙${i.stackable ? " *(قابل للتكديس)*" : ""}\n└ ${i.description}`
  ).join("\n");

  const gemLines = gemItems.map((i, idx) =>
    `**${goldItems.length + idx + 1}.** ${i.emoji} **${i.name}** — ${i.gemCost} 💎${i.stackable ? " *(قابل للتكديس)*" : ""}\n└ ${i.description}`
  ).join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle("🏪 متجر ساحة الكون الأنمي")
    .setDescription(`رصيدك: **${player.gold.toLocaleString()} 🪙** | **${player.gems} 💎**\n\nاستخدم \`/shop buy <رقم> [كمية]\` للشراء. *(قابل للتكديس = يمكن شراء أكثر من واحد!)*`)
    .addFields(
      { name: "🪙 متجر الذهب", value: goldLines },
      { name: "💎 متجر الجواهر", value: gemLines },
    )
    .setFooter({ text: "العناصر تُشترى فوراً — بدون فترة انتظار!" })
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("shop")
  .setDescription("🏪 تصفّح واشترِ عناصر من المتجر")
  .addSubcommand(sub =>
    sub.setName("view").setDescription("تصفّح المتجر")
  )
  .addSubcommand(sub =>
    sub.setName("buy")
      .setDescription("اشترِ عنصراً من المتجر")
      .addIntegerOption(o =>
        o.setName("item").setDescription("رقم العنصر من /shop view").setRequired(true).setMinValue(1).setMaxValue(SHOP_ITEMS.length)
      )
      .addIntegerOption(o =>
        o.setName("qty").setDescription("الكمية (1-20، افتراضي: 1)").setRequired(false).setMinValue(1).setMaxValue(20)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();

  let [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });
  if (player.isBanned) return interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")] });

  player = await applyStaminaRegen(player);

  const shopRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:summon_single").setLabel("💎 استدعاء").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:daily").setLabel("🎁 يومي").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:profile").setLabel("👤 الملف").setStyle(ButtonStyle.Secondary),
  );

  if (sub === "view") {
    return interaction.editReply({ embeds: [shopEmbed(player)], components: [shopRow] });
  }

  if (sub === "buy") {
    const itemNum = interaction.options.getInteger("item", true);
    const qty = interaction.options.getInteger("qty") ?? 1;
    const item = SHOP_ITEMS[itemNum - 1];
    if (!item) return interaction.editReply({ embeds: [errorEmbed(`رقم غير صالح. استخدم \`/shop view\` لعرض العناصر.`)] });

    if (!item.stackable && qty > 1) {
      return interaction.editReply({
        embeds: [errorEmbed(`**${item.name}** لا يمكن شراؤه أكثر من مرة في نفس الوقت.`)],
        components: [shopRow],
      });
    }

    const totalGoldCost = item.goldCost * qty;
    const totalGemCost  = item.gemCost  * qty;

    if (totalGoldCost > 0 && player.gold < totalGoldCost) {
      return interaction.editReply({
        embeds: [errorEmbed(`ذهب غير كافٍ!\nلديك **${player.gold.toLocaleString()} 🪙** وتحتاج **${totalGoldCost.toLocaleString()} 🪙** (${qty}×${item.goldCost.toLocaleString()}).`)],
        components: [shopRow],
      });
    }
    if (totalGemCost > 0 && player.gems < totalGemCost) {
      return interaction.editReply({
        embeds: [errorEmbed(`جواهر غير كافية!\nلديك **${player.gems} 💎** وتحتاج **${totalGemCost} 💎** (${qty}×${item.gemCost}).`)],
        components: [shopRow],
      });
    }

    const effectData = item.effect(player, qty);
    const now = new Date();

    const goldAfter = totalGoldCost > 0
      ? player.gold - totalGoldCost
      : (effectData.gold ?? player.gold);
    const gemsAfter = totalGemCost > 0
      ? player.gems - totalGemCost
      : (effectData.gems ?? player.gems);

    await db.update(playersTable).set({
      ...effectData,
      gold: goldAfter,
      gems: gemsAfter,
      updatedAt: now,
    }).where(eq(playersTable.id, player.id));

    const isMystery = item.id === "mystery_box";
    let bonusText = item.effectStr(qty);
    if (isMystery) {
      const goldGain = (effectData.gold ?? 0) - player.gold;
      const gemGain  = (effectData.gems ?? 0) - player.gems;
      bonusText = goldGain > 0 ? `+${goldGain.toLocaleString()} 🪙 ذهب` : `+${gemGain} 💎 جواهر`;
    }

    const title = qty > 1
      ? `${item.emoji} تم الشراء: ${item.name} ×${qty}!`
      : `${item.emoji} تم الشراء: ${item.name}!`;

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle(title)
        .setDescription(`**التأثير:** ${bonusText}`)
        .addFields(
          { name: "💰 الذهب", value: `${goldAfter.toLocaleString()} 🪙`, inline: true },
          { name: "💎 الجواهر", value: `${gemsAfter}`, inline: true },
          { name: "⚡ الطاقة", value: `${effectData.stamina ?? player.stamina}/${effectData.maxStamina ?? player.maxStamina}`, inline: true },
          ...(totalGoldCost > 0 ? [{ name: "🏷️ المدفوع", value: `${totalGoldCost.toLocaleString()} 🪙`, inline: true }] : []),
          ...(totalGemCost > 0  ? [{ name: "🏷️ المدفوع", value: `${totalGemCost} 💎`, inline: true }] : []),
        )
        .setFooter({ text: "تفضّل بزيارتنا مجدداً!" })
        .setTimestamp()],
      components: [shopRow],
    });
  }
}
