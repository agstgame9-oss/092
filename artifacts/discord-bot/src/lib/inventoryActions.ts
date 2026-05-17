import { ButtonInteraction, EmbedBuilder } from "discord.js";
import { db, playersTable } from "./db.js";
import { inventoryTable, itemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, errorEmbed } from "./embeds.js";
import { mainMenuRow } from "./buttons.js";
import { addXP } from "./gameEngine.js";

type ItemEffect = { type: string; value: number; duration?: number };

export async function handleInventoryUse(interaction: ButtonInteraction, itemId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) { await interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] }); return; }
  if (player.isBanned) { await interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")] }); return; }

  const [invRow] = await db
    .select({ inv: inventoryTable, item: itemsTable })
    .from(inventoryTable)
    .innerJoin(itemsTable, eq(inventoryTable.itemId, itemsTable.id))
    .where(and(eq(inventoryTable.discordId, discordId), eq(inventoryTable.itemId, itemId)));

  if (!invRow) {
    await interaction.editReply({ embeds: [errorEmbed("هذا العنصر غير موجود في مخزونك.")] });
    return;
  }

  const { inv, item } = invRow;

  if (item.type !== "consumable" && item.type !== "summon_ticket") {
    await interaction.editReply({ embeds: [errorEmbed(`**${item.name}** لا يمكن استخدامه مباشرة.`)] });
    return;
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
    await interaction.editReply({ embeds: [errorEmbed(`**${item.name}** لا يملك تأثيرات قابلة للتطبيق حالياً.`)] });
    return;
  }

  updates.updatedAt = new Date();
  await db.update(playersTable).set(updates).where(eq(playersTable.discordId, discordId));

  if (xpToAdd > 0) await addXP(player.id, xpToAdd).catch(() => null);

  // Reduce quantity or remove
  if (inv.quantity > 1) {
    await db.update(inventoryTable).set({ quantity: inv.quantity - 1 }).where(eq(inventoryTable.id, inv.id));
  } else {
    await db.delete(inventoryTable).where(eq(inventoryTable.id, inv.id));
  }

  const rarity = RARITY_EMOJI[item.rarity] ?? item.rarity;
  const remaining = inv.quantity - 1;

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle(`🧪 تم استخدام: ${rarity} ${item.name}`)
      .setDescription(effectLines.join("\n") || "تم تطبيق التأثير.")
      .addFields({ name: "📦 المتبقي", value: `${remaining} قطعة`, inline: true })
      .setFooter({ text: item.description })
      .setTimestamp()],
    components: [mainMenuRow()],
  });
}

// ── Direct-use by item number from /inventory list ─────────────────────────────

export async function useItemBySlot(interaction: ButtonInteraction, slot: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) { await interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً.")] }); return; }

  const items = await db
    .select({ inv: inventoryTable, item: itemsTable })
    .from(inventoryTable)
    .innerJoin(itemsTable, eq(inventoryTable.itemId, itemsTable.id))
    .where(eq(inventoryTable.discordId, discordId));

  const rarityOrder = ["SSS+", "SSS", "SS", "S", "A", "B", "C", "D"];
  items.sort((a, b) => rarityOrder.indexOf(a.item.rarity) - rarityOrder.indexOf(b.item.rarity));

  const target = items[slot - 1];
  if (!target) {
    await interaction.editReply({ embeds: [errorEmbed(`رقم غير صالح! لديك ${items.length} عنصر.`)] });
    return;
  }

  return handleInventoryUse(interaction, target.item.id);
}
