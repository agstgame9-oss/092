import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
} from "discord.js";
import { db, playersTable, playerCharactersTable, charactersTable } from "../../lib/db.js";
import { eq, and } from "drizzle-orm";
import { tradeOffersTable } from "../../lib/db.js";
import { COLORS, RARITY_EMOJI, errorEmbed, successEmbed } from "../../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("trade")
  .setDescription("تبادل الشخصيات أو الذهب مع لاعبين آخرين")
  .addSubcommand(sub =>
    sub.setName("offer")
      .setDescription("أرسل عرض تبادل إلى لاعب آخر")
      .addUserOption(o => o.setName("player").setDescription("اللاعب المراد التبادل معه").setRequired(true))
      .addIntegerOption(o => o.setName("offer_gold").setDescription("الذهب الذي تعرضه (0 = لا شيء)").setRequired(false).setMinValue(0))
      .addIntegerOption(o => o.setName("offer_char").setDescription("رقم الشخصية من /characters التي تعرضها").setRequired(false).setMinValue(1))
      .addIntegerOption(o => o.setName("request_gold").setDescription("الذهب الذي تطلبه (0 = لا شيء)").setRequired(false).setMinValue(0))
      .addIntegerOption(o => o.setName("request_char").setDescription("رقم الشخصية من /characters الهدف التي تطلبها").setRequired(false).setMinValue(1))
  )
  .addSubcommand(sub =>
    sub.setName("accept")
      .setDescription("قبول عرض تبادل معلّق")
      .addIntegerOption(o => o.setName("trade_id").setDescription("رقم التبادل من /trade list").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("decline")
      .setDescription("رفض أو إلغاء عرض تبادل")
      .addIntegerOption(o => o.setName("trade_id").setDescription("رقم التبادل من /trade list").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("list")
      .setDescription("عرض عروض التبادل المعلّقة")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });
  if (player.isBanned) return interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")] });

  // ── LIST ────────────────────────────────────────────────────────────────
  if (sub === "list") {
    const now = new Date();
    const outgoing = await db.select().from(tradeOffersTable)
      .where(eq(tradeOffersTable.initiatorDiscordId, discordId));
    const incoming = await db.select().from(tradeOffersTable)
      .where(eq(tradeOffersTable.targetDiscordId, discordId));

    const allTrades = [...outgoing, ...incoming].filter(t => t.status === "pending" && t.expiresAt > now);

    if (!allTrades.length) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle("📦 عروض التبادل")
          .setDescription("لا توجد عروض معلّقة.\nاستخدم `/trade offer @لاعب` لإنشاء عرض جديد!")],
      });
    }

    const lines = allTrades.map(t => {
      const isInitiator = t.initiatorDiscordId === discordId;
      const offered = JSON.parse(t.offeredItemsJson) as { gold?: number; charName?: string };
      const requested = JSON.parse(t.requestedItemsJson) as { gold?: number; charName?: string };
      const direction = isInitiator ? "📤 أنت تعرض" : "📥 يعرضون";
      const offerStr = [offered.gold ? `${offered.gold.toLocaleString()} 🪙` : "", offered.charName ?? ""].filter(Boolean).join(" + ") || "لا شيء";
      const reqStr = [requested.gold ? `${requested.gold.toLocaleString()} 🪙` : "", requested.charName ?? ""].filter(Boolean).join(" + ") || "لا شيء";
      const expMin = Math.ceil((t.expiresAt.getTime() - now.getTime()) / 60000);
      return `**#${t.id}** ${direction}: **${offerStr}** مقابل **${reqStr}** — ⏰ ${expMin} دقيقة`;
    });

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle("📦 عروض التبادل المعلّقة")
        .setDescription(lines.join("\n"))
        .setFooter({ text: "استخدم /trade accept <ID> أو /trade decline <ID>" })],
    });
  }

  // ── DECLINE/CANCEL ───────────────────────────────────────────────────────
  if (sub === "decline") {
    const tradeId = interaction.options.getInteger("trade_id", true);
    const [trade] = await db.select().from(tradeOffersTable).where(eq(tradeOffersTable.id, tradeId));
    if (!trade) return interaction.editReply({ embeds: [errorEmbed("العرض غير موجود.")] });
    if (trade.initiatorDiscordId !== discordId && trade.targetDiscordId !== discordId) {
      return interaction.editReply({ embeds: [errorEmbed("هذا العرض لا يخصّك.")] });
    }
    if (trade.status !== "pending") {
      return interaction.editReply({ embeds: [errorEmbed("هذا العرض لم يعد معلّقاً.")] });
    }
    await db.update(tradeOffersTable).set({ status: "cancelled" }).where(eq(tradeOffersTable.id, tradeId));
    return interaction.editReply({ embeds: [successEmbed(`تم إلغاء العرض **#${tradeId}** بنجاح.`)] });
  }

  // ── ACCEPT ───────────────────────────────────────────────────────────────
  if (sub === "accept") {
    const tradeId = interaction.options.getInteger("trade_id", true);
    const [trade] = await db.select().from(tradeOffersTable).where(eq(tradeOffersTable.id, tradeId));
    if (!trade) return interaction.editReply({ embeds: [errorEmbed("العرض غير موجود.")] });
    if (trade.targetDiscordId !== discordId) return interaction.editReply({ embeds: [errorEmbed("هذا العرض لم يُرسل إليك.")] });
    if (trade.status !== "pending") return interaction.editReply({ embeds: [errorEmbed("هذا العرض لم يعد معلّقاً.")] });
    if (trade.expiresAt < new Date()) {
      await db.update(tradeOffersTable).set({ status: "expired" }).where(eq(tradeOffersTable.id, tradeId));
      return interaction.editReply({ embeds: [errorEmbed("انتهت صلاحية هذا العرض.")] });
    }

    const [initiator] = await db.select().from(playersTable).where(eq(playersTable.discordId, trade.initiatorDiscordId));
    const [target] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!initiator || !target) return interaction.editReply({ embeds: [errorEmbed("أحد طرفي التبادل لم يعد موجوداً.")] });

    const offered = JSON.parse(trade.offeredItemsJson) as { gold?: number; charId?: number; charName?: string };
    const requested = JSON.parse(trade.requestedItemsJson) as { gold?: number; charId?: number; charName?: string };

    // Validate gold balances
    if ((offered.gold ?? 0) > initiator.gold) {
      await db.update(tradeOffersTable).set({ status: "cancelled" }).where(eq(tradeOffersTable.id, tradeId));
      return interaction.editReply({ embeds: [errorEmbed("مُنشئ العرض لا يملك ذهباً كافياً. تم إلغاء العرض.")] });
    }
    if ((requested.gold ?? 0) > target.gold) {
      return interaction.editReply({ embeds: [errorEmbed(`ذهبك غير كافٍ! تحتاج **${(requested.gold ?? 0).toLocaleString()} 🪙** ولديك **${target.gold.toLocaleString()} 🪙**.`)] });
    }

    // Transfer offered character (initiator → target)
    if (offered.charId) {
      const [pc] = await db.select().from(playerCharactersTable)
        .where(and(eq(playerCharactersTable.playerId, initiator.id), eq(playerCharactersTable.characterId, offered.charId)));
      if (!pc) {
        await db.update(tradeOffersTable).set({ status: "cancelled" }).where(eq(tradeOffersTable.id, tradeId));
        return interaction.editReply({ embeds: [errorEmbed("مُنشئ العرض لم يعد يملك الشخصية المعروضة. تم الإلغاء.")] });
      }
      const [targetHas] = await db.select().from(playerCharactersTable)
        .where(and(eq(playerCharactersTable.playerId, target.id), eq(playerCharactersTable.characterId, offered.charId)));
      if (targetHas) {
        await db.update(playerCharactersTable).set({ copies: targetHas.copies + 1 }).where(eq(playerCharactersTable.id, targetHas.id));
      } else {
        await db.insert(playerCharactersTable).values({
          playerId: target.id, characterId: offered.charId,
          level: pc.level, ascension: pc.ascension, copies: 1, isLocked: false, isOnParty: false,
          currentEnergy: 0, skill1Cooldown: 0, skill2Cooldown: 0, skill3Cooldown: 0, totalDamageDealt: 0,
        });
      }
      if (pc.copies > 1) {
        await db.update(playerCharactersTable).set({ copies: pc.copies - 1 }).where(eq(playerCharactersTable.id, pc.id));
      } else {
        await db.delete(playerCharactersTable).where(eq(playerCharactersTable.id, pc.id));
      }
    }

    // Transfer requested character (target → initiator)
    if (requested.charId) {
      const [pc] = await db.select().from(playerCharactersTable)
        .where(and(eq(playerCharactersTable.playerId, target.id), eq(playerCharactersTable.characterId, requested.charId)));
      if (!pc) return interaction.editReply({ embeds: [errorEmbed("لم تعد تملك الشخصية المطلوبة.")] });
      const [initHas] = await db.select().from(playerCharactersTable)
        .where(and(eq(playerCharactersTable.playerId, initiator.id), eq(playerCharactersTable.characterId, requested.charId)));
      if (initHas) {
        await db.update(playerCharactersTable).set({ copies: initHas.copies + 1 }).where(eq(playerCharactersTable.id, initHas.id));
      } else {
        await db.insert(playerCharactersTable).values({
          playerId: initiator.id, characterId: requested.charId,
          level: pc.level, ascension: pc.ascension, copies: 1, isLocked: false, isOnParty: false,
          currentEnergy: 0, skill1Cooldown: 0, skill2Cooldown: 0, skill3Cooldown: 0, totalDamageDealt: 0,
        });
      }
      if (pc.copies > 1) {
        await db.update(playerCharactersTable).set({ copies: pc.copies - 1 }).where(eq(playerCharactersTable.id, pc.id));
      } else {
        await db.delete(playerCharactersTable).where(eq(playerCharactersTable.id, pc.id));
      }
    }

    // Gold transfer — single atomic calculation (no double-updates)
    const offeredGold = offered.gold ?? 0;
    const requestedGold = requested.gold ?? 0;
    if (offeredGold > 0 || requestedGold > 0) {
      await db.update(playersTable)
        .set({ gold: initiator.gold - offeredGold + requestedGold, updatedAt: new Date() })
        .where(eq(playersTable.id, initiator.id));
      await db.update(playersTable)
        .set({ gold: target.gold + offeredGold - requestedGold, updatedAt: new Date() })
        .where(eq(playersTable.id, target.id));
    }

    await db.update(tradeOffersTable).set({ status: "completed" }).where(eq(tradeOffersTable.id, tradeId));

    const offerStr = [offeredGold > 0 ? `${offeredGold.toLocaleString()} 🪙` : "", offered.charName ?? ""].filter(Boolean).join(" + ") || "لا شيء";
    const reqStr = [requestedGold > 0 ? `${requestedGold.toLocaleString()} 🪙` : "", requested.charName ?? ""].filter(Boolean).join(" + ") || "لا شيء";

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle("🤝 اكتمل التبادل!")
        .setDescription(`أعطيت: **${reqStr}**\nاستلمت: **${offerStr}**`)
        .setFooter({ text: `تبادل #${tradeId} اكتمل بنجاح` })
        .setTimestamp()],
    });
  }

  // ── OFFER ────────────────────────────────────────────────────────────────
  if (sub === "offer") {
    const targetUser = interaction.options.getUser("player", true);
    if (targetUser.id === discordId) return interaction.editReply({ embeds: [errorEmbed("لا يمكنك التبادل مع نفسك!")] });
    if (targetUser.bot) return interaction.editReply({ embeds: [errorEmbed("لا يمكنك التبادل مع بوت!")] });

    const [targetPlayer] = await db.select().from(playersTable).where(eq(playersTable.discordId, targetUser.id));
    if (!targetPlayer) return interaction.editReply({ embeds: [errorEmbed("هذا اللاعب لم يبدأ بعد!")] });

    const offerGold = interaction.options.getInteger("offer_gold") ?? 0;
    const offerCharSlot = interaction.options.getInteger("offer_char");
    const requestGold = interaction.options.getInteger("request_gold") ?? 0;
    const requestCharSlot = interaction.options.getInteger("request_char");

    if (offerGold === 0 && !offerCharSlot && requestGold === 0 && !requestCharSlot) {
      return interaction.editReply({ embeds: [errorEmbed("يجب تحديد شيء واحد على الأقل للعرض أو الطلب.")] });
    }
    if (offerGold > 0 && player.gold < offerGold) {
      return interaction.editReply({ embeds: [errorEmbed(`ذهبك غير كافٍ! لديك **${player.gold.toLocaleString()} 🪙** فقط.`)] });
    }

    const rarityOrder = ["SSS+", "SSS", "SS", "S", "A", "B", "C", "D"];
    const myChars = await db.select({ pc: playerCharactersTable, char: charactersTable })
      .from(playerCharactersTable).innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
      .where(eq(playerCharactersTable.playerId, player.id));
    myChars.sort((a, b) => rarityOrder.indexOf(a.char.rarity) - rarityOrder.indexOf(b.char.rarity));

    const theirChars = await db.select({ pc: playerCharactersTable, char: charactersTable })
      .from(playerCharactersTable).innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
      .where(eq(playerCharactersTable.playerId, targetPlayer.id));
    theirChars.sort((a, b) => rarityOrder.indexOf(a.char.rarity) - rarityOrder.indexOf(b.char.rarity));

    const offered: { gold?: number; charId?: number; charName?: string } = {};
    const requested: { gold?: number; charId?: number; charName?: string } = {};

    if (offerGold > 0) offered.gold = offerGold;
    if (requestGold > 0) requested.gold = requestGold;

    if (offerCharSlot) {
      const c = myChars[offerCharSlot - 1];
      if (!c) return interaction.editReply({ embeds: [errorEmbed(`رقم خانة غير صالح! لديك ${myChars.length} شخصية.`)] });
      if (c.pc.isLocked) return interaction.editReply({ embeds: [errorEmbed(`**${c.char.name}** مقفلة ولا يمكن تبادلها.`)] });
      offered.charId = c.char.id;
      offered.charName = `${RARITY_EMOJI[c.char.rarity]} ${c.char.name}`;
    }
    if (requestCharSlot) {
      const c = theirChars[requestCharSlot - 1];
      if (!c) return interaction.editReply({ embeds: [errorEmbed(`رقم خانة غير صالح! لديهم ${theirChars.length} شخصية.`)] });
      requested.charId = c.char.id;
      requested.charName = `${RARITY_EMOJI[c.char.rarity]} ${c.char.name}`;
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const [trade] = await db.insert(tradeOffersTable).values({
      initiatorDiscordId: discordId,
      targetDiscordId: targetUser.id,
      channelId: interaction.channelId,
      offeredItemsJson: JSON.stringify(offered),
      requestedItemsJson: JSON.stringify(requested),
      status: "pending",
      initiatorConfirmed: true,
      targetConfirmed: false,
      expiresAt,
    }).returning();

    const offerStr = [offered.gold ? `${offered.gold.toLocaleString()} 🪙` : "", offered.charName ?? ""].filter(Boolean).join(" + ") || "لا شيء";
    const reqStr = [requested.gold ? `${requested.gold.toLocaleString()} 🪙` : "", requested.charName ?? ""].filter(Boolean).join(" + ") || "لا شيء";

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`trade:accept:${trade.id}`).setLabel("✅ قبول").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`trade:decline:${trade.id}`).setLabel("❌ رفض").setStyle(ButtonStyle.Danger),
    );

    return interaction.editReply({
      content: `<@${targetUser.id}>`,
      embeds: [new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle("🤝 عرض تبادل جديد!")
        .setDescription(`**${interaction.user.username}** يريد التبادل معك!\n\n**يعرض:** ${offerStr}\n**يطلب:** ${reqStr}`)
        .addFields(
          { name: "🕐 ينتهي بعد", value: "30 دقيقة", inline: true },
          { name: "📋 رقم العرض", value: `#${trade.id}`, inline: true },
        )
        .setFooter({ text: "اضغط ✅ قبول أو ❌ رفض — أو استخدم /trade accept <ID>" })
        .setTimestamp()],
      components: [row],
    });
  }
}

// ── Button handlers (trade:accept:ID / trade:decline:ID) ──────────────────────

export async function handleTradeAcceptButton(interaction: ButtonInteraction, tradeId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const discordId = interaction.user.id;

  const [trade] = await db.select().from(tradeOffersTable).where(eq(tradeOffersTable.id, tradeId));
  if (!trade) { await interaction.editReply({ embeds: [errorEmbed("العرض غير موجود.")] }); return; }
  if (trade.targetDiscordId !== discordId) { await interaction.editReply({ embeds: [errorEmbed("هذا العرض لم يُرسل إليك.")] }); return; }
  if (trade.status !== "pending") { await interaction.editReply({ embeds: [errorEmbed("هذا العرض لم يعد معلّقاً.")] }); return; }
  if (trade.expiresAt < new Date()) {
    await db.update(tradeOffersTable).set({ status: "expired" }).where(eq(tradeOffersTable.id, tradeId));
    await interaction.editReply({ embeds: [errorEmbed("انتهت صلاحية هذا العرض.")] });
    return;
  }

  const [initiator] = await db.select().from(playersTable).where(eq(playersTable.discordId, trade.initiatorDiscordId));
  const [target] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!initiator || !target) { await interaction.editReply({ embeds: [errorEmbed("أحد طرفي التبادل لم يعد موجوداً.")] }); return; }

  const offered = JSON.parse(trade.offeredItemsJson) as { gold?: number; charId?: number; charName?: string };
  const requested = JSON.parse(trade.requestedItemsJson) as { gold?: number; charId?: number; charName?: string };

  if ((offered.gold ?? 0) > initiator.gold) {
    await db.update(tradeOffersTable).set({ status: "cancelled" }).where(eq(tradeOffersTable.id, tradeId));
    await interaction.editReply({ embeds: [errorEmbed("مُنشئ العرض لا يملك ذهباً كافياً. تم إلغاء العرض.")] });
    return;
  }
  if ((requested.gold ?? 0) > target.gold) {
    await interaction.editReply({ embeds: [errorEmbed(`ذهبك غير كافٍ! تحتاج **${(requested.gold ?? 0).toLocaleString()} 🪙**.`)] });
    return;
  }

  if (offered.charId) {
    const [pc] = await db.select().from(playerCharactersTable)
      .where(and(eq(playerCharactersTable.playerId, initiator.id), eq(playerCharactersTable.characterId, offered.charId)));
    if (!pc) {
      await db.update(tradeOffersTable).set({ status: "cancelled" }).where(eq(tradeOffersTable.id, tradeId));
      await interaction.editReply({ embeds: [errorEmbed("مُنشئ العرض لم يعد يملك الشخصية. تم الإلغاء.")] });
      return;
    }
    const [targetHas] = await db.select().from(playerCharactersTable)
      .where(and(eq(playerCharactersTable.playerId, target.id), eq(playerCharactersTable.characterId, offered.charId)));
    if (targetHas) {
      await db.update(playerCharactersTable).set({ copies: targetHas.copies + 1 }).where(eq(playerCharactersTable.id, targetHas.id));
    } else {
      await db.insert(playerCharactersTable).values({
        playerId: target.id, characterId: offered.charId,
        level: pc.level, ascension: pc.ascension, copies: 1, isLocked: false, isOnParty: false,
        currentEnergy: 0, skill1Cooldown: 0, skill2Cooldown: 0, skill3Cooldown: 0, totalDamageDealt: 0,
      });
    }
    if (pc.copies > 1) await db.update(playerCharactersTable).set({ copies: pc.copies - 1 }).where(eq(playerCharactersTable.id, pc.id));
    else await db.delete(playerCharactersTable).where(eq(playerCharactersTable.id, pc.id));
  }

  if (requested.charId) {
    const [pc] = await db.select().from(playerCharactersTable)
      .where(and(eq(playerCharactersTable.playerId, target.id), eq(playerCharactersTable.characterId, requested.charId)));
    if (!pc) { await interaction.editReply({ embeds: [errorEmbed("لم تعد تملك الشخصية المطلوبة.")] }); return; }
    const [initHas] = await db.select().from(playerCharactersTable)
      .where(and(eq(playerCharactersTable.playerId, initiator.id), eq(playerCharactersTable.characterId, requested.charId)));
    if (initHas) {
      await db.update(playerCharactersTable).set({ copies: initHas.copies + 1 }).where(eq(playerCharactersTable.id, initHas.id));
    } else {
      await db.insert(playerCharactersTable).values({
        playerId: initiator.id, characterId: requested.charId,
        level: pc.level, ascension: pc.ascension, copies: 1, isLocked: false, isOnParty: false,
        currentEnergy: 0, skill1Cooldown: 0, skill2Cooldown: 0, skill3Cooldown: 0, totalDamageDealt: 0,
      });
    }
    if (pc.copies > 1) await db.update(playerCharactersTable).set({ copies: pc.copies - 1 }).where(eq(playerCharactersTable.id, pc.id));
    else await db.delete(playerCharactersTable).where(eq(playerCharactersTable.id, pc.id));
  }

  const offeredGold = offered.gold ?? 0;
  const requestedGold = requested.gold ?? 0;
  if (offeredGold > 0 || requestedGold > 0) {
    await db.update(playersTable).set({ gold: initiator.gold - offeredGold + requestedGold, updatedAt: new Date() }).where(eq(playersTable.id, initiator.id));
    await db.update(playersTable).set({ gold: target.gold + offeredGold - requestedGold, updatedAt: new Date() }).where(eq(playersTable.id, target.id));
  }

  await db.update(tradeOffersTable).set({ status: "completed" }).where(eq(tradeOffersTable.id, tradeId));

  const offerStr = [offeredGold > 0 ? `${offeredGold.toLocaleString()} 🪙` : "", offered.charName ?? ""].filter(Boolean).join(" + ") || "لا شيء";
  const reqStr = [requestedGold > 0 ? `${requestedGold.toLocaleString()} 🪙` : "", requested.charName ?? ""].filter(Boolean).join(" + ") || "لا شيء";

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("🤝 اكتمل التبادل!")
      .setDescription(`أعطيت: **${reqStr}**\nاستلمت: **${offerStr}**`)
      .setFooter({ text: `تبادل #${tradeId} اكتمل بنجاح` })
      .setTimestamp()],
  });
}

export async function handleTradeDeclineButton(interaction: ButtonInteraction, tradeId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const discordId = interaction.user.id;

  const [trade] = await db.select().from(tradeOffersTable).where(eq(tradeOffersTable.id, tradeId));
  if (!trade) { await interaction.editReply({ embeds: [errorEmbed("العرض غير موجود.")] }); return; }
  if (trade.initiatorDiscordId !== discordId && trade.targetDiscordId !== discordId) {
    await interaction.editReply({ embeds: [errorEmbed("هذا العرض لا يخصّك.")] });
    return;
  }
  if (trade.status !== "pending") { await interaction.editReply({ embeds: [errorEmbed("هذا العرض لم يعد معلّقاً.")] }); return; }

  await db.update(tradeOffersTable).set({ status: "cancelled" }).where(eq(tradeOffersTable.id, tradeId));
  await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription(`❌ تم رفض العرض **#${tradeId}**.`)] });
}
