import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  TextChannel,
} from "discord.js";
import { db, playersTable, serverConfigTable, adminLogsTable, bossesTable, charactersTable, guildsTable, playerCharactersTable, itemsTable } from "./db.js";
import { eq, desc, count, and } from "drizzle-orm";
import { COLORS, errorEmbed, successEmbed, ELEMENT_EMOJI, RARITY_EMOJI, RARITY_COLORS } from "./embeds.js";
import { adminDashboardRows, raidAttackRow } from "./buttons.js";
import { activeRaids } from "./battleState.js";
import { addXP } from "./gameEngine.js";

type AdminInteraction =
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction
  | ChatInputCommandInteraction;

export async function isAdmin(interaction: AdminInteraction): Promise<boolean> {
  if (!interaction.guildId || !interaction.member) return false;

  const member = interaction.member;
  const perms = typeof member.permissions === "string"
    ? BigInt(member.permissions)
    : member.permissions.valueOf();
  if (perms & BigInt(0x8)) return true;

  const [cfg] = await db
    .select()
    .from(serverConfigTable)
    .where(eq(serverConfigTable.guildId, interaction.guildId!));

  if (!cfg?.adminRoleId) return false;

  const roles = Array.isArray(member.roles)
    ? member.roles
    : [...member.roles.cache.keys()];
  return roles.includes(cfg.adminRoleId);
}

async function logAdminAction(
  interaction: AdminInteraction,
  action: string,
  targetDiscordId?: string,
  targetUsername?: string,
  details?: string,
  reason?: string,
) {
  await db.insert(adminLogsTable).values({
    adminDiscordId: interaction.user.id,
    adminUsername: interaction.user.username,
    guildServerId: interaction.guildId ?? "unknown",
    action,
    targetDiscordId,
    targetUsername,
    details,
    reason,
    reversible: true,
    wasReversed: false,
  }).catch(() => null);
}

function parseDiscordId(input: string): string {
  const mention = input.match(/<@!?(\d+)>/);
  if (mention) return mention[1];
  if (/^\d{15,20}$/.test(input.trim())) return input.trim();
  return "";
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export async function actionAdminDashboard(interaction: AdminInteraction): Promise<void> {
  const admin = await isAdmin(interaction);
  if (!admin) {
    const e = errorEmbed("تحتاج إلى صلاحيات **المسؤول** أو رتبة الأدمن في السيرفر لاستخدام هذا.");
    if (interaction.isButton()) {
      await interaction.reply({ embeds: [e], ephemeral: true });
    } else if (interaction.isChatInputCommand()) {
      await interaction.reply({ embeds: [e], ephemeral: true });
    }
    return;
  }

  const [playerCount] = await db.select({ c: count() }).from(playersTable);
  const [guildCount] = await db.select({ c: count() }).from(guildsTable);
  const [charCount] = await db.select({ c: count() }).from(charactersTable);
  const [bossCount] = await db.select({ c: count() }).from(bossesTable);

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("🛡️ لوحة تحكم الإدارة")
    .setDescription("مرحباً بك في لوحة تحكم **ساحة الكون الأنمي**.\nاستخدم الأزرار أدناه لإدارة سيرفرك.")
    .addFields(
      { name: "👥 اللاعبون", value: String(playerCount?.c ?? 0), inline: true },
      { name: "🏰 النقابات", value: String(guildCount?.c ?? 0), inline: true },
      { name: "📦 الشخصيات", value: String(charCount?.c ?? 0), inline: true },
      { name: "👹 الزعماء", value: String(bossCount?.c ?? 0), inline: true },
      { name: "🔥 الغارات النشطة", value: String(activeRaids.size), inline: true },
      { name: "📅 التاريخ", value: new Date().toUTCString(), inline: false },
    )
    .setFooter({ text: `الأدمن: ${interaction.user.username}` })
    .setTimestamp();

  const rows = adminDashboardRows();
  if (interaction.isChatInputCommand()) {
    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  } else if (interaction.isButton()) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed], components: rows });
    } else {
      await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }
  }
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function actionAdminStats(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const [playerCount] = await db.select({ c: count() }).from(playersTable);
  const [bannedCount] = await db.select({ c: count() }).from(playersTable).where(eq(playersTable.isBanned, true));
  const [guildCount] = await db.select({ c: count() }).from(guildsTable);
  const [charCount] = await db.select({ c: count() }).from(charactersTable).where(eq(charactersTable.isEnabled, true));
  const [bossCount] = await db.select({ c: count() }).from(bossesTable).where(eq(bossesTable.isEnabled, true));
  const [itemCount] = await db.select({ c: count() }).from(itemsTable);

  const topPlayers = await db
    .select({ username: playersTable.username, level: playersTable.level, pvpRating: playersTable.pvpRating })
    .from(playersTable)
    .where(eq(playersTable.isBanned, false))
    .orderBy(desc(playersTable.pvpRating))
    .limit(3);

  const topLines = topPlayers.map((p, i) =>
    `${["🥇","🥈","🥉"][i]} **${p.username}** — المستوى ${p.level} | ${p.pvpRating} تقييم`
  ).join("\n") || "لا يوجد لاعبون بعد.";

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("📊 إحصائيات السيرفر")
    .addFields(
      { name: "👥 إجمالي اللاعبين", value: String(playerCount?.c ?? 0), inline: true },
      { name: "⛔ المحظورون", value: String(bannedCount?.c ?? 0), inline: true },
      { name: "🏰 النقابات", value: String(guildCount?.c ?? 0), inline: true },
      { name: "📦 الشخصيات النشطة", value: String(charCount?.c ?? 0), inline: true },
      { name: "👹 الزعماء النشطون", value: String(bossCount?.c ?? 0), inline: true },
      { name: "🎒 العناصر", value: String(itemCount?.c ?? 0), inline: true },
      { name: "🔥 الغارات المباشرة", value: String(activeRaids.size), inline: true },
      { name: "🏆 أفضل اللاعبين (PvP)", value: topLines, inline: false },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── Config View ──────────────────────────────────────────────────────────────

export async function actionAdminConfig(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const [cfg] = await db
    .select()
    .from(serverConfigTable)
    .where(eq(serverConfigTable.guildId, interaction.guildId!));

  if (!cfg) {
    return void interaction.editReply({ embeds: [errorEmbed("لا يوجد إعداد. شغّل `/setup` أولاً.")] });
  }

  const s = cfg.settings;
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("🌍 إعدادات السيرفر")
    .addFields(
      { name: "🛡️ رتبة الأدمن", value: cfg.adminRoleId ? `<@&${cfg.adminRoleId}>` : "غير مُعيَّن", inline: true },
      { name: "🎮 رتبة اللاعب", value: cfg.playerRoleId ? `<@&${cfg.playerRoleId}>` : "غير مُعيَّن", inline: true },
      { name: "📢 قناة الإعلانات", value: cfg.announcementChannelId ? `<#${cfg.announcementChannelId}>` : "غير مُعيَّن", inline: true },
      { name: "⚔️ PvP", value: s?.allowPvp !== false ? "✅ مفعّل" : "❌ معطّل", inline: true },
      { name: "🏪 السوق", value: s?.allowMarket !== false ? "✅ مفعّل" : "❌ معطّل", inline: true },
      { name: "🏰 النقابات", value: s?.allowGuilds !== false ? "✅ مفعّل" : "❌ معطّل", inline: true },
      { name: "🌍 الزعيم العالمي", value: s?.allowWorldBoss !== false ? "✅ مفعّل" : "❌ معطّل", inline: true },
      { name: "✨ مضاعف الخبرة", value: `${s?.xpMultiplier ?? 1}x`, inline: true },
      { name: "💰 مضاعف الذهب", value: `${s?.goldMultiplier ?? 1}x`, inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── Admin Logs ───────────────────────────────────────────────────────────────

export async function actionAdminLogs(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const logs = await db
    .select()
    .from(adminLogsTable)
    .where(eq(adminLogsTable.guildServerId, interaction.guildId!))
    .orderBy(desc(adminLogsTable.createdAt))
    .limit(10);

  if (!logs.length) {
    return void interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setDescription("لا توجد إجراءات إدارية مسجّلة بعد.")] });
  }

  const lines = logs.map(l => {
    const target = l.targetUsername ? ` ← **${l.targetUsername}**` : "";
    const details = l.details ? ` (${l.details})` : "";
    const time = `<t:${Math.floor(l.createdAt.getTime() / 1000)}:R>`;
    return `${time} **${l.adminUsername}** — \`${l.action}\`${target}${details}`;
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("📋 آخر إجراءات الإدارة (10 أحدث)")
    .setDescription(lines.join("\n"))
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── Modals openers ───────────────────────────────────────────────────────────

function makeModal(customId: string, title: string, inputs: Array<{ id: string; label: string; placeholder?: string; required?: boolean; style?: TextInputStyle; min?: number; max?: number }>) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  for (const inp of inputs) {
    const ti = new TextInputBuilder()
      .setCustomId(inp.id)
      .setLabel(inp.label)
      .setStyle(inp.style ?? TextInputStyle.Short)
      .setRequired(inp.required ?? true);
    if (inp.placeholder) ti.setPlaceholder(inp.placeholder);
    if (inp.min != null) ti.setMinLength(inp.min);
    if (inp.max != null) ti.setMaxLength(inp.max);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(ti));
  }
  return modal;
}

export async function openGiveGemsModal(i: ButtonInteraction) {
  await i.showModal(makeModal("admin:modal:give_gems", "💎 منح جواهر للاعب", [
    { id: "discord_id", label: "معرّف ديسكورد للمستخدم", placeholder: "123456789012345678" },
    { id: "amount", label: "عدد الجواهر", placeholder: "100", min: 1, max: 10 },
  ]));
}

export async function openGiveGoldModal(i: ButtonInteraction) {
  await i.showModal(makeModal("admin:modal:give_gold", "🪙 منح ذهب للاعب", [
    { id: "discord_id", label: "معرّف ديسكورد للمستخدم", placeholder: "123456789012345678" },
    { id: "amount", label: "مقدار الذهب", placeholder: "5000", min: 1, max: 10 },
  ]));
}

export async function openGiveXpModal(i: ButtonInteraction) {
  await i.showModal(makeModal("admin:modal:give_xp", "✨ منح خبرة للاعب", [
    { id: "discord_id", label: "معرّف ديسكورد للمستخدم", placeholder: "123456789012345678" },
    { id: "amount", label: "مقدار الخبرة", placeholder: "1000", min: 1, max: 10 },
  ]));
}

export async function openBanModal(i: ButtonInteraction) {
  await i.showModal(makeModal("admin:modal:ban", "⛔ حظر لاعب", [
    { id: "discord_id", label: "معرّف ديسكورد للمستخدم", placeholder: "123456789012345678" },
    { id: "reason", label: "سبب الحظر", placeholder: "غش / تحرش / إلخ.", required: false },
  ]));
}

export async function openUnbanModal(i: ButtonInteraction) {
  await i.showModal(makeModal("admin:modal:unban", "✅ رفع حظر لاعب", [
    { id: "discord_id", label: "معرّف ديسكورد للمستخدم", placeholder: "123456789012345678" },
  ]));
}

export async function openResetModal(i: ButtonInteraction) {
  await i.showModal(makeModal("admin:modal:reset", "🔄 إعادة تعيين إحصائيات لاعب", [
    { id: "discord_id", label: "معرّف ديسكورد للمستخدم", placeholder: "123456789012345678" },
    { id: "confirm", label: 'اكتب "RESET" للتأكيد', placeholder: "RESET" },
  ]));
}

export async function openAnnounceModal(i: ButtonInteraction) {
  await i.showModal(makeModal("admin:modal:announce", "📢 إعلان السيرفر", [
    { id: "title", label: "عنوان الإعلان", placeholder: "📣 حدث في السيرفر!" },
    { id: "message", label: "الرسالة", placeholder: "اكتب إعلانك هنا...", style: TextInputStyle.Paragraph, min: 1, max: 2000 },
  ]));
}

// ── Modal submit handler ─────────────────────────────────────────────────────

export async function handleAdminModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.customId;

  if (!await isAdmin(interaction as unknown as AdminInteraction)) {
    return void interaction.reply({ embeds: [errorEmbed("ليس لديك صلاحية.")], ephemeral: true });
  }

  // منح جواهر
  if (id === "admin:modal:give_gems") {
    await interaction.deferReply({ ephemeral: true });
    const rawId = interaction.fields.getTextInputValue("discord_id");
    const amountStr = interaction.fields.getTextInputValue("amount");
    const discordId = parseDiscordId(rawId);
    if (!discordId) return void interaction.editReply({ embeds: [errorEmbed("معرّف ديسكورد غير صالح.")] });
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) return void interaction.editReply({ embeds: [errorEmbed("مقدار غير صالح.")] });

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) return void interaction.editReply({ embeds: [errorEmbed(`لا يوجد لاعب بالمعرّف \`${discordId}\`.`)] });

    await db.update(playersTable).set({ gems: player.gems + amount, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    await logAdminAction(interaction as unknown as AdminInteraction, "give_gems", discordId, player.username, `+${amount} gems`, undefined);
    return void interaction.editReply({ embeds: [successEmbed(`تم منح **${amount}💎 جواهر** لـ **${player.username}**. (الآن: ${player.gems + amount})`)] });
  }

  // منح ذهب
  if (id === "admin:modal:give_gold") {
    await interaction.deferReply({ ephemeral: true });
    const rawId = interaction.fields.getTextInputValue("discord_id");
    const amountStr = interaction.fields.getTextInputValue("amount");
    const discordId = parseDiscordId(rawId);
    if (!discordId) return void interaction.editReply({ embeds: [errorEmbed("معرّف ديسكورد غير صالح.")] });
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) return void interaction.editReply({ embeds: [errorEmbed("مقدار غير صالح.")] });

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) return void interaction.editReply({ embeds: [errorEmbed(`لا يوجد لاعب بالمعرّف \`${discordId}\`.`)] });

    await db.update(playersTable).set({ gold: player.gold + amount, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    await logAdminAction(interaction as unknown as AdminInteraction, "give_gold", discordId, player.username, `+${amount} gold`, undefined);
    return void interaction.editReply({ embeds: [successEmbed(`تم منح **${amount}🪙 ذهب** لـ **${player.username}**. (الآن: ${player.gold + amount})`)] });
  }

  // منح خبرة
  if (id === "admin:modal:give_xp") {
    await interaction.deferReply({ ephemeral: true });
    const rawId = interaction.fields.getTextInputValue("discord_id");
    const amountStr = interaction.fields.getTextInputValue("amount");
    const discordId = parseDiscordId(rawId);
    if (!discordId) return void interaction.editReply({ embeds: [errorEmbed("معرّف ديسكورد غير صالح.")] });
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) return void interaction.editReply({ embeds: [errorEmbed("مقدار غير صالح.")] });

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) return void interaction.editReply({ embeds: [errorEmbed(`لا يوجد لاعب بالمعرّف \`${discordId}\`.`)] });

    const result = await addXP(player.id, amount);
    await logAdminAction(interaction as unknown as AdminInteraction, "give_xp", discordId, player.username, `+${amount} xp`, undefined);
    const levelMsg = result?.leveled ? ` 🎉 **ارتقى للمستوى ${result.newLevel}!**` : "";
    return void interaction.editReply({ embeds: [successEmbed(`تم منح **${amount}✨ خبرة** لـ **${player.username}**.${levelMsg}`)] });
  }

  // حظر
  if (id === "admin:modal:ban") {
    await interaction.deferReply({ ephemeral: true });
    const rawId = interaction.fields.getTextInputValue("discord_id");
    const reason = interaction.fields.getTextInputValue("reason") || "لم يُحدَّد السبب";
    const discordId = parseDiscordId(rawId);
    if (!discordId) return void interaction.editReply({ embeds: [errorEmbed("معرّف ديسكورد غير صالح.")] });

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) return void interaction.editReply({ embeds: [errorEmbed(`لا يوجد لاعب بالمعرّف \`${discordId}\`.`)] });
    if (player.isBanned) return void interaction.editReply({ embeds: [errorEmbed(`**${player.username}** محظور بالفعل.`)] });

    await db.update(playersTable).set({ isBanned: true, banReason: reason, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    await logAdminAction(interaction as unknown as AdminInteraction, "ban", discordId, player.username, undefined, reason);
    return void interaction.editReply({ embeds: [successEmbed(`تم حظر **${player.username}**.\nالسبب: *${reason}*`)] });
  }

  // رفع الحظر
  if (id === "admin:modal:unban") {
    await interaction.deferReply({ ephemeral: true });
    const rawId = interaction.fields.getTextInputValue("discord_id");
    const discordId = parseDiscordId(rawId);
    if (!discordId) return void interaction.editReply({ embeds: [errorEmbed("معرّف ديسكورد غير صالح.")] });

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) return void interaction.editReply({ embeds: [errorEmbed(`لا يوجد لاعب بالمعرّف \`${discordId}\`.`)] });
    if (!player.isBanned) return void interaction.editReply({ embeds: [errorEmbed(`**${player.username}** غير محظور حالياً.`)] });

    await db.update(playersTable).set({ isBanned: false, banReason: null, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    await logAdminAction(interaction as unknown as AdminInteraction, "unban", discordId, player.username, undefined, undefined);
    return void interaction.editReply({ embeds: [successEmbed(`تم رفع الحظر عن **${player.username}**.`)] });
  }

  // إعادة تعيين
  if (id === "admin:modal:reset") {
    await interaction.deferReply({ ephemeral: true });
    const rawId = interaction.fields.getTextInputValue("discord_id");
    const confirm = interaction.fields.getTextInputValue("confirm").trim().toUpperCase();
    if (confirm !== "RESET") return void interaction.editReply({ embeds: [errorEmbed('يجب كتابة "RESET" للتأكيد.')] });
    const discordId = parseDiscordId(rawId);
    if (!discordId) return void interaction.editReply({ embeds: [errorEmbed("معرّف ديسكورد غير صالح.")] });

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) return void interaction.editReply({ embeds: [errorEmbed(`لا يوجد لاعب بالمعرّف \`${discordId}\`.`)] });

    await db.update(playersTable).set({
      level: 1, xp: 0, xpToNext: 100,
      gold: 1000, gems: 20,
      stamina: 100, maxStamina: 100,
      currentFloor: 0, maxAbyssFloor: 0,
      wins: 0, losses: 0, totalDamageDealt: 0,
      pvpRating: 1000, furyMeter: 0,
      updatedAt: new Date(),
    }).where(eq(playersTable.id, player.id));
    await logAdminAction(interaction as unknown as AdminInteraction, "reset_player", discordId, player.username, "Full stat reset", undefined);
    return void interaction.editReply({ embeds: [successEmbed(`تمت إعادة تعيين إحصائيات **${player.username}** إلى القيم الابتدائية.`)] });
  }

  // إعلان
  if (id === "admin:modal:announce") {
    await interaction.deferReply({ ephemeral: true });
    const title = interaction.fields.getTextInputValue("title");
    const message = interaction.fields.getTextInputValue("message");

    const [cfg] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, interaction.guildId!));
    if (!cfg?.announcementChannelId) {
      return void interaction.editReply({ embeds: [errorEmbed("لا توجد قناة إعلانات مُعيَّنة. استخدم `/setup channel` أولاً.")] });
    }

    const channel = interaction.client.channels.cache.get(cfg.announcementChannelId) as TextChannel | undefined;
    if (!channel) {
      return void interaction.editReply({ embeds: [errorEmbed("قناة الإعلانات غير موجودة أو البوت لا يملك الوصول إليها.")] });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle(title)
      .setDescription(message)
      .setFooter({ text: `أُعلن بواسطة ${interaction.user.username}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    await logAdminAction(interaction as unknown as AdminInteraction, "announce", undefined, undefined, title, undefined);
    return void interaction.editReply({ embeds: [successEmbed(`تم إرسال الإعلان إلى <#${cfg.announcementChannelId}>!`)] });
  }

  // إنشاء شخصية
  if (id === "admin:modal:create_char") {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.fields.getTextInputValue("name").trim();
    const animeSource = interaction.fields.getTextInputValue("anime_source").trim();
    const rarityRaw = interaction.fields.getTextInputValue("rarity").trim().toUpperCase();
    const element1Raw = interaction.fields.getTextInputValue("element1").trim();
    const element2Raw = interaction.fields.getTextInputValue("element2").trim() || null;

    const validRarities = ["D","C","B","A","S","SS","SSS","SSS+"];
    const validElements = ["Fire","Water","Earth","Wind","Lightning","Ice","Light","Dark","Chaos","Order","Space","Time"];

    const rarity = validRarities.find(r => r === rarityRaw);
    if (!rarity) return void interaction.editReply({ embeds: [errorEmbed(`ندرة غير صالحة. استخدم: ${validRarities.join(", ")}`)] });

    const element1 = validElements.find(e => e.toLowerCase() === element1Raw.toLowerCase());
    if (!element1) return void interaction.editReply({ embeds: [errorEmbed(`عنصر غير صالح. استخدم: ${validElements.join(", ")}`)] });

    const element2 = element2Raw ? validElements.find(e => e.toLowerCase() === element2Raw.toLowerCase()) ?? null : null;

    const stats = rarityStats(rarity);
    const skills = makeSkills(name, element1, rarity);

    type SkillType = { name: string; description: string; energyCost: number; cooldown: number; damage: number; type: "damage" | "heal" | "buff" | "debuff" | "ultimate"; target: "single" | "all" | "self"; element?: string; effect?: { stat: string; value: number; duration: number } };
    type PassiveType = { name: string; description: string; trigger: "hp_below" | "hp_above" | "turn_start" | "on_hit" | "on_kill" | "battle_start" | "fury_full" | "always"; effect: { multiplier?: number; stat?: string; value?: number; duration?: number; type?: string; target?: string } };

    await db.insert(charactersTable).values({
      name,
      animeSource,
      rarity: rarity as any,
      element1: element1 as any,
      element2: (element2 ?? null) as any,
      ...stats,
      skill1: skills.skill1 as unknown as SkillType,
      skill2: skills.skill2 as unknown as SkillType,
      skill3: skills.skill3 as unknown as SkillType,
      passive: skills.passive as unknown as PassiveType,
      isEnabled: true,
    });

    await logAdminAction(interaction as unknown as AdminInteraction, "create_character", undefined, name, `${rarity} | ${element1}`, undefined);
    return void interaction.editReply({ embeds: [successEmbed(`تم إنشاء الشخصية **${name}** (${RARITY_EMOJI[rarity]} ${rarity}) من *${animeSource}*!`)] });
  }

  // إنشاء زعيم
  if (id === "admin:modal:create_boss") {
    await interaction.deferReply({ ephemeral: true });
    const nameTitle = interaction.fields.getTextInputValue("name_title").trim();
    const animeSourceTier = interaction.fields.getTextInputValue("anime_source_tier").trim();
    const elements = interaction.fields.getTextInputValue("elements").trim();
    const statsRaw = interaction.fields.getTextInputValue("stats").trim();
    const weaknessesRaw = interaction.fields.getTextInputValue("weaknesses").trim();

    const [bossName, bossTitle = "المجهول"] = nameTitle.split("|").map(s => s.trim());
    const [animeSource, tierRaw = "elite"] = animeSourceTier.split("|").map(s => s.trim());
    const [element1, element2 = ""] = elements.split("|").map(s => s.trim());

    const validTiers = ["normal","elite","world","abyss","legendary"];
    const tier = validTiers.includes(tierRaw.toLowerCase()) ? tierRaw.toLowerCase() : "elite";

    const statParts = statsRaw.split(/\s+/);
    const hp = parseInt(statParts[0] ?? "50000", 10) || 50000;
    const atk = parseInt(statParts[1] ?? "1500", 10) || 1500;
    const def = parseInt(statParts[2] ?? "800", 10) || 800;
    const spd = parseInt(statParts[3] ?? "150", 10) || 150;

    const weaknesses = weaknessesRaw ? weaknessesRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
    const xpReward = Math.floor(hp / 50);
    const goldReward = Math.floor(hp / 30);

    await db.insert(bossesTable).values({
      name: bossName,
      title: bossTitle,
      animeSource,
      tier: tier as any,
      hp,
      atk,
      def,
      spd,
      element1: (element1 || "Dark") as any,
      element2: (element2 || null) as any,
      weaknesses: weaknesses as any,
      resistances: [] as any,
      immunities: [] as any,
      skills: [] as any,
      phases: [] as any,
      passive: "none",
      lootTable: [] as any,
      xpReward,
      goldReward,
      isEnabled: true,
      isWorldBoss: tier === "world",
      isAbyssBoss: tier === "abyss",
    });

    await logAdminAction(interaction as unknown as AdminInteraction, "create_boss", undefined, bossName, `${tier} | ${element1}`, undefined);
    return void interaction.editReply({ embeds: [successEmbed(`تم إنشاء الزعيم **${bossName}** — *${bossTitle}* (${tier}) من *${animeSource}*!\n❤️ ${hp.toLocaleString()} HP | ⚔️ ${atk} ATK`)] });
  }

  // إنشاء عنصر
  if (id === "admin:modal:create_item") {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.fields.getTextInputValue("name").trim();
    const description = interaction.fields.getTextInputValue("description").trim();
    const typeRarity = interaction.fields.getTextInputValue("type_rarity").trim();
    const baseValueStr = interaction.fields.getTextInputValue("base_value").trim();
    const effectsRaw = interaction.fields.getTextInputValue("effects").trim();

    const [typeRaw, rarityRaw = "C"] = typeRarity.split("|").map(s => s.trim());
    const validTypes = ["consumable","weapon","armor","accessory","material","summon_ticket","key","currency","special"];
    const validRarities = ["D","C","B","A","S","SS","SSS","SSS+"];
    const type = validTypes.includes(typeRaw.toLowerCase()) ? typeRaw.toLowerCase() : "material";
    const rarity = validRarities.includes(rarityRaw.toUpperCase()) ? rarityRaw.toUpperCase() : "C";

    const baseValue = parseInt(baseValueStr, 10) || 100;

    const parsedEffects: Array<{ type: string; value: number; duration?: number }> = [];
    if (effectsRaw) {
      for (const part of effectsRaw.split(",").map(s => s.trim())) {
        const [et, ev] = part.split(":");
        if (et && ev) parsedEffects.push({ type: et.trim(), value: parseFloat(ev.trim()) || 0 });
      }
    }

    await db.insert(itemsTable).values({
      name,
      description,
      type: type as any,
      rarity: rarity as any,
      baseValue,
      effects: parsedEffects.length > 0 ? parsedEffects : undefined,
      isTradeable: true,
    });

    await logAdminAction(interaction as unknown as AdminInteraction, "create_item", undefined, name, `${type} | ${rarity}`, undefined);
    return void interaction.editReply({ embeds: [successEmbed(`تم إنشاء العنصر **${name}** (${rarity} ${type}) بقيمة أساسية ${baseValue}🪙!`)] });
  }
}

// ── Spawn Boss Raid ───────────────────────────────────────────────────────────

export async function showBossSpawnMenu(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const bosses = await db.select().from(bossesTable).where(eq(bossesTable.isEnabled, true)).limit(25);
  if (!bosses.length) {
    return void interaction.editReply({ embeds: [errorEmbed("لا يوجد زعماء. أنشئ واحداً بـ `/create boss`.")] });
  }

  const options = bosses.map(b => ({
    label: `${b.name} — ${b.title}`,
    description: `${b.tier.toUpperCase()} | ❤️ ${b.hp.toLocaleString()} HP | ${b.element1}`,
    value: String(b.id),
    emoji: b.isWorldBoss ? "🌍" : "👹",
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId("admin:spawn_boss_select")
    .setPlaceholder("اختر زعيماً لاستدعائه في هذه القناة…")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(COLORS.warning).setTitle("🏆 استدعاء غارة زعيم").setDescription("اختر زعيماً لاستدعائه في **هذه القناة**. يمكن لجميع أعضاء السيرفر المشاركة في الغارة!")],
    components: [row],
  });
}

export async function spawnBossRaid(
  interaction: StringSelectMenuInteraction,
  bossId: number,
): Promise<void> {
  await interaction.deferUpdate();

  const [boss] = await db.select().from(bossesTable).where(eq(bossesTable.id, bossId));
  if (!boss) return void interaction.editReply({ embeds: [errorEmbed("الزعيم غير موجود.")] });

  const raidId = `${interaction.channelId}_${Date.now()}`;

  const hpBar = buildHpBar(boss.hp, boss.hp, 20);
  const embed = buildRaidEmbed(boss.name, boss.title, boss.element1, boss.animeSource, boss.hp, boss.hp, hpBar, 0, []);

  const channel = interaction.channel as TextChannel;
  const msg = await channel.send({
    content: `@here ⚔️ **${boss.name}** ظهر! اضغط للقتال!`,
    embeds: [embed],
    components: [raidAttackRow(raidId, boss.name, true)],
  });

  activeRaids.set(raidId, {
    raidId,
    channelId: interaction.channelId,
    messageId: msg.id,
    guildId: interaction.guildId!,
    bossId: boss.id,
    bossName: boss.name,
    bossTitle: boss.title,
    bossElement: boss.element1,
    currentHp: boss.hp,
    maxHp: boss.hp,
    bossAtk: boss.atk,
    isAlive: true,
    participants: new Map(),
    xpReward: boss.xpReward,
    goldReward: boss.goldReward,
    spawnedBy: interaction.user.id,
    createdAt: Date.now(),
  });

  setTimeout(() => {
    const raid = activeRaids.get(raidId);
    if (raid?.isAlive) {
      raid.isAlive = false;
      activeRaids.delete(raidId);
      msg.edit({ components: [raidAttackRow(raidId, boss.name, false)] }).catch(() => null);
    }
  }, 30 * 60 * 1000);

  await interaction.editReply({
    embeds: [successEmbed(`تم استدعاء **${boss.name}** في <#${interaction.channelId}>! حظاً موفقاً!`)],
    components: [],
  });
}

export async function handleRaidAttack(interaction: ButtonInteraction, raidId: string): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const raid = activeRaids.get(raidId);
  if (!raid || !raid.isAlive) {
    return void interaction.editReply({ embeds: [errorEmbed("هذه الغارة لم تعد نشطة.")] });
  }

  const discordId = interaction.user.id;
  const now = Date.now();
  const participant = raid.participants.get(discordId);

  if (participant && now - participant.lastAttack < 30_000) {
    const secs = Math.ceil((30_000 - (now - participant.lastAttack)) / 1000);
    return void interaction.editReply({ embeds: [errorEmbed(`فترة انتظار الهجوم! انتظر **${secs}ث**.`)] });
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) {
    return void interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` للتسجيل.")] });
  }
  if (player.isBanned) {
    return void interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")] });
  }

  const partyChars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(and(eq(playerCharactersTable.playerId, player.id), eq(playerCharactersTable.isOnParty, true)));

  const atk = partyChars.length > 0
    ? partyChars.reduce((sum, c) => sum + c.char.baseAtk * c.pc.level, 0)
    : player.level * 100;

  const damage = Math.floor(atk * (0.8 + Math.random() * 0.4) * (1 + player.level * 0.02));
  const actualDamage = Math.min(damage, raid.currentHp);

  raid.currentHp -= actualDamage;

  if (!participant) {
    raid.participants.set(discordId, { username: interaction.user.username, damage: actualDamage, lastAttack: now });
  } else {
    participant.damage += actualDamage;
    participant.lastAttack = now;
  }

  if (raid.currentHp <= 0) {
    raid.isAlive = false;
    raid.currentHp = 0;

    const topAttackers = [...raid.participants.entries()]
      .sort((a, b) => b[1].damage - a[1].damage)
      .slice(0, 10);

    for (const [dId, pData] of raid.participants) {
      const pct = pData.damage / raid.maxHp;
      const earnedXp = Math.floor(raid.xpReward * pct * 2);
      const earnedGold = Math.floor(raid.goldReward * pct * 2);
      const [p] = await db.select().from(playersTable).where(eq(playersTable.discordId, dId));
      if (p) {
        await db.update(playersTable).set({ gold: p.gold + earnedGold, updatedAt: new Date() }).where(eq(playersTable.id, p.id));
        await addXP(p.id, earnedXp);
      }
    }

    activeRaids.delete(raidId);

    const mvpLines = topAttackers.map(([, p], i) =>
      `${["🥇","🥈","🥉"][i] ?? `${i+1}.`} **${p.username}** — ${p.damage.toLocaleString()} ضرر`
    ).join("\n");

    const defeatedEmbed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`🏆 ${raid.bossName} هُزم!`)
      .setDescription("سقط زعيم الغارة! تم توزيع المكافآت.")
      .addFields(
        { name: "💥 الضرر الكلي", value: `${raid.maxHp.toLocaleString()}`, inline: true },
        { name: "👥 المشاركون", value: String(raid.participants.size), inline: true },
        { name: "🏆 أعلى الضررات", value: mvpLines || "لا يوجد", inline: false },
      )
      .setTimestamp();

    const channel = interaction.client.channels.cache.get(raid.channelId) as TextChannel;
    await channel?.messages.fetch(raid.messageId)
      .then(m => m.edit({ embeds: [defeatedEmbed], components: [raidAttackRow(raidId, raid.bossName, false)] }))
      .catch(() => null);

    return void interaction.editReply({ embeds: [successEmbed(`💥 أحدثت **${actualDamage.toLocaleString()}** ضرراً — كانت الضربة القاضية! 🏆`)] });
  }

  const hpBar = buildHpBar(raid.currentHp, raid.maxHp, 20);
  const sortedParts = [...raid.participants.entries()].sort((a, b) => b[1].damage - a[1].damage).slice(0, 5);
  const partLines = sortedParts.map(([, p]) => `**${p.username}**: ${p.damage.toLocaleString()}`);

  const updatedEmbed = buildRaidEmbed(
    raid.bossName, raid.bossTitle, raid.bossElement, "",
    raid.currentHp, raid.maxHp, hpBar, raid.participants.size, partLines
  );

  const channel = interaction.client.channels.cache.get(raid.channelId) as TextChannel;
  await channel?.messages.fetch(raid.messageId)
    .then(m => m.edit({ embeds: [updatedEmbed], components: [raidAttackRow(raidId, raid.bossName, true)] }))
    .catch(() => null);

  return void interaction.editReply({ embeds: [new EmbedBuilder()
    .setColor(COLORS.success)
    .setDescription(`💥 ضربت **${raid.bossName}** بـ **${actualDamage.toLocaleString()}** ضرر!\n❤️ HP الزعيم: ${raid.currentHp.toLocaleString()} / ${raid.maxHp.toLocaleString()}`)
  ] });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildHpBar(current: number, max: number, size: number): string {
  const filled = Math.round((current / max) * size);
  const empty = size - filled;
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, empty));
}

function buildRaidEmbed(
  name: string, title: string, element: string, source: string,
  current: number, max: number, bar: string, partCount: number, topLines: string[]
) {
  const pct = ((current / max) * 100).toFixed(1);
  const emoji = ELEMENT_EMOJI[element] ?? "👹";
  return new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle(`👹 زعيم الغارة — ${name}`)
    .setDescription(`*${title}*${source ? `\n📺 ${source}` : ""}`)
    .addFields(
      { name: "❤️ HP الزعيم", value: `\`${bar}\` ${pct}%\n${current.toLocaleString()} / ${max.toLocaleString()}`, inline: false },
      { name: `${emoji} العنصر`, value: element, inline: true },
      { name: "👥 المهاجمون", value: String(partCount), inline: true },
      ...(topLines.length ? [{ name: "🏆 أعلى الضررات", value: topLines.join("\n"), inline: false }] : []),
    )
    .setFooter({ text: "اضغط ⚔️ هاجم! للإلحاق الضرر • فترة انتظار 30 ثانية لكل هجوم" })
    .setTimestamp();
}

function rarityStats(rarity: string) {
  const base: Record<string, { hp: number; atk: number; def: number; spd: number; crit: number; critDmg: number }> = {
    "D":    { hp: 800,   atk: 80,  def: 40,  spd: 80,  crit: 5,  critDmg: 150 },
    "C":    { hp: 1200,  atk: 110, def: 60,  spd: 90,  crit: 6,  critDmg: 155 },
    "B":    { hp: 1800,  atk: 150, def: 85,  spd: 100, crit: 7,  critDmg: 160 },
    "A":    { hp: 2600,  atk: 200, def: 120, spd: 115, crit: 9,  critDmg: 165 },
    "S":    { hp: 3800,  atk: 280, def: 170, spd: 130, crit: 11, critDmg: 175 },
    "SS":   { hp: 5500,  atk: 390, def: 240, spd: 145, crit: 13, critDmg: 185 },
    "SSS":  { hp: 8000,  atk: 550, def: 340, spd: 165, crit: 16, critDmg: 200 },
    "SSS+": { hp: 12000, atk: 800, def: 500, spd: 190, crit: 20, critDmg: 220 },
  };
  const s = base[rarity] ?? base["C"];
  return {
    baseHp: s.hp,
    baseAtk: s.atk,
    baseDef: s.def,
    baseSpd: s.spd,
    baseCrit: s.crit,
    baseCritDmg: s.critDmg,
  };
}

function makeSkills(name: string, element: string, rarity: string) {
  const rarityMult = { "D": 1, "C": 1.1, "B": 1.2, "A": 1.3, "S": 1.5, "SS": 1.8, "SSS": 2.1, "SSS+": 2.5 };
  const m = rarityMult[rarity as keyof typeof rarityMult] ?? 1;
  return {
    skill1: { name: `${element} Strike`, description: `A sharp ${element.toLowerCase()} attack`, energyCost: 20, cooldown: 2, damage: parseFloat((1.2 * m).toFixed(2)), element, type: "damage", target: "single" },
    skill2: { name: `${element} Burst`, description: `Explosive ${element.toLowerCase()} energy`, energyCost: 35, cooldown: 3, damage: parseFloat((1.7 * m).toFixed(2)), element, type: "damage", target: "single" },
    skill3: { name: `${name.split(" ")[0]}'s Ultimate`, description: "Unleashes full power", energyCost: 50, cooldown: 5, damage: parseFloat((2.5 * m).toFixed(2)), element, type: "damage", target: "all" },
    passive: { name: `${element} Mastery`, description: `Mastery of ${element.toLowerCase()} powers`, trigger: "battle_start", effect: { multiplier: parseFloat((1 + 0.05 * m).toFixed(3)), stat: "atk" } },
  };
}
