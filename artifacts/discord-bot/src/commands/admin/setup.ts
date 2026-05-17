import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { db, serverConfigTable, adminLogsTable } from "../../lib/db.js";
import { eq } from "drizzle-orm";
import { COLORS } from "../../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("إعداد بوت AMA لهذا السيرفر")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand(sub =>
    sub.setName("view")
      .setDescription("عرض إعدادات السيرفر الحالية")
  )
  .addSubcommand(sub =>
    sub.setName("roles")
      .setDescription("تعيين رتب الأدمن واللاعبين")
      .addRoleOption(o =>
        o.setName("admin_role")
          .setDescription("الرتبة المطلوبة لاستخدام أوامر الإدارة")
          .setRequired(true)
      )
      .addRoleOption(o =>
        o.setName("player_role")
          .setDescription("الرتبة التي تُعطى تلقائياً عند استخدام /start")
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName("channel")
      .setDescription("تعيين قناة الإعلانات للبوت")
      .addChannelOption(o =>
        o.setName("channel")
          .setDescription("قناة إعلانات البوت والأحداث")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName("toggle")
      .setDescription("تفعيل أو تعطيل ميزات اللعبة")
      .addStringOption(o =>
        o.setName("feature")
          .setDescription("الميزة المراد تغييرها")
          .setRequired(true)
          .addChoices(
            { name: "⚔️ معارك PvP", value: "allowPvp" },
            { name: "🏪 السوق", value: "allowMarket" },
            { name: "🏰 النقابات", value: "allowGuilds" },
            { name: "🏆 البطولات", value: "allowTournaments" },
            { name: "🌍 الزعيم العالمي", value: "allowWorldBoss" },
          )
      )
      .addBooleanOption(o =>
        o.setName("enabled")
          .setDescription("تفعيل أو تعطيل الميزة")
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName("multiplier")
      .setDescription("ضبط مضاعفات الخبرة أو الذهب في هذا السيرفر")
      .addStringOption(o =>
        o.setName("type")
          .setDescription("نوع المضاعف")
          .setRequired(true)
          .addChoices(
            { name: "✨ مضاعف الخبرة", value: "xpMultiplier" },
            { name: "💰 مضاعف الذهب", value: "goldMultiplier" },
          )
      )
      .addNumberOption(o =>
        o.setName("value")
          .setDescription("قيمة المضاعف (مثل 1.5 = 50% إضافي، 2 = ضعفين)")
          .setRequired(true)
          .setMinValue(0.1)
          .setMaxValue(10)
      )
  );

const DEFAULT_SETTINGS = {
  allowPvp: true,
  allowMarket: true,
  allowGuilds: true,
  allowTournaments: true,
  allowWorldBoss: true,
  allowStocks: true,
  xpMultiplier: 1,
  goldMultiplier: 1,
  staminaRegenRate: 6,
};

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const sub = interaction.options.getSubcommand();

  const [config] = await db
    .select()
    .from(serverConfigTable)
    .where(eq(serverConfigTable.guildId, guildId));

  if (sub === "view") {
    const settings = config?.settings ?? DEFAULT_SETTINGS;
    const status = (v: boolean) => (v ? "✅ مفعّل" : "❌ معطّل");

    const embed = new EmbedBuilder()
      .setColor(config?.isSetup ? COLORS.primary : COLORS.warning)
      .setTitle("⚙️ إعدادات السيرفر")
      .setDescription(
        config?.isSetup
          ? "✅ السيرفر مُعدّ وجاهز."
          : "⚠️ السيرفر غير مُعدّ بعد. استخدم `/setup roles` لتعيين رتبة الأدمن والبدء."
      )
      .addFields(
        { name: "🛡️ رتبة الأدمن", value: config?.adminRoleId ? `<@&${config.adminRoleId}>` : "غير مُعيَّن", inline: true },
        { name: "🎮 رتبة اللاعب", value: config?.playerRoleId ? `<@&${config.playerRoleId}>` : "غير مُعيَّن", inline: true },
        { name: "📢 قناة الإعلانات", value: config?.announcementChannelId ? `<#${config.announcementChannelId}>` : "غير مُعيَّن", inline: true },
        { name: "⚔️ PvP", value: status(settings.allowPvp), inline: true },
        { name: "🏪 السوق", value: status(settings.allowMarket), inline: true },
        { name: "🏰 النقابات", value: status(settings.allowGuilds), inline: true },
        { name: "🏆 البطولات", value: status(settings.allowTournaments), inline: true },
        { name: "🌍 الزعيم العالمي", value: status(settings.allowWorldBoss), inline: true },
        { name: "✨ مضاعف الخبرة", value: `${settings.xpMultiplier}x`, inline: true },
        { name: "💰 مضاعف الذهب", value: `${settings.goldMultiplier}x`, inline: true },
        { name: "⚡ تجديد الطاقة", value: `1 كل ${settings.staminaRegenRate} دقيقة`, inline: true },
      )
      .setFooter({ text: `معرّف السيرفر: ${guildId}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "roles") {
    const adminRole = interaction.options.getRole("admin_role", true);
    const playerRole = interaction.options.getRole("player_role");

    const upsertValues = {
      guildId,
      guildName: interaction.guild?.name ?? null,
      isSetup: true,
      setupCompletedAt: config?.setupCompletedAt ?? new Date(),
      adminRoleId: adminRole.id,
      playerRoleId: playerRole?.id ?? config?.playerRoleId ?? null,
      updatedAt: new Date(),
    };

    if (config) {
      await db.update(serverConfigTable).set(upsertValues).where(eq(serverConfigTable.guildId, guildId));
    } else {
      await db.insert(serverConfigTable).values(upsertValues);
    }

    await db.insert(adminLogsTable).values({
      adminDiscordId: interaction.user.id,
      adminUsername: interaction.user.username,
      guildServerId: guildId,
      action: "setup_roles",
      details: `Admin role: ${adminRole.id}, Player role: ${playerRole?.id ?? "none"}`,
    }).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("✅ تم تعيين الرتب")
      .setDescription("تم تحديث رتب السيرفر.")
      .addFields(
        { name: "🛡️ رتبة الأدمن", value: `<@&${adminRole.id}>\nأعضاء هذه الرتبة يمكنهم استخدام أوامر الإدارة.`, inline: true },
        { name: "🎮 رتبة اللاعب", value: playerRole ? `<@&${playerRole.id}>\nتُعطى تلقائياً عند استخدام \`/start\`.` : "غير مُعيَّن", inline: true },
      )
      .setFooter({ text: "استخدم /setup view لرؤية الإعدادات الكاملة." });

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "channel") {
    const channel = interaction.options.getChannel("channel", true);

    const upsertValues = {
      guildId,
      guildName: interaction.guild?.name ?? null,
      announcementChannelId: channel.id,
      updatedAt: new Date(),
    };

    if (config) {
      await db.update(serverConfigTable).set(upsertValues).where(eq(serverConfigTable.guildId, guildId));
    } else {
      await db.insert(serverConfigTable).values({ ...upsertValues, isSetup: false });
    }

    await db.insert(adminLogsTable).values({
      adminDiscordId: interaction.user.id,
      adminUsername: interaction.user.username,
      guildServerId: guildId,
      action: "setup_channel",
      details: `Announcement channel: ${channel.id}`,
    }).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("✅ تم تعيين القناة")
      .addFields(
        { name: "📢 قناة الإعلانات", value: `<#${channel.id}>`, inline: true },
      );

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "toggle") {
    const feature = interaction.options.getString("feature", true) as keyof typeof DEFAULT_SETTINGS;
    const enabled = interaction.options.getBoolean("enabled", true);

    const currentSettings = { ...DEFAULT_SETTINGS, ...(config?.settings ?? {}) };
    const newSettings = { ...currentSettings, [feature]: enabled };

    if (config) {
      await db.update(serverConfigTable)
        .set({ settings: newSettings, updatedAt: new Date() })
        .where(eq(serverConfigTable.guildId, guildId));
    } else {
      await db.insert(serverConfigTable).values({ guildId, isSetup: false, settings: newSettings });
    }

    await db.insert(adminLogsTable).values({
      adminDiscordId: interaction.user.id,
      adminUsername: interaction.user.username,
      guildServerId: guildId,
      action: "toggle_feature",
      details: `${feature}: ${enabled}`,
    }).catch(() => null);

    const featureNames: Record<string, string> = {
      allowPvp: "⚔️ معارك PvP",
      allowMarket: "🏪 السوق",
      allowGuilds: "🏰 النقابات",
      allowTournaments: "🏆 البطولات",
      allowWorldBoss: "🌍 الزعيم العالمي",
    };

    const embed = new EmbedBuilder()
      .setColor(enabled ? COLORS.success : COLORS.danger)
      .setDescription(
        `${featureNames[feature] ?? feature} تم **${enabled ? "تفعيله ✅" : "تعطيله ❌"}** في هذا السيرفر.`
      );

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "multiplier") {
    const type = interaction.options.getString("type", true) as "xpMultiplier" | "goldMultiplier";
    const value = interaction.options.getNumber("value", true);

    const currentSettings = { ...DEFAULT_SETTINGS, ...(config?.settings ?? {}) };
    const newSettings = { ...currentSettings, [type]: value };

    if (config) {
      await db.update(serverConfigTable)
        .set({ settings: newSettings, updatedAt: new Date() })
        .where(eq(serverConfigTable.guildId, guildId));
    } else {
      await db.insert(serverConfigTable).values({ guildId, isSetup: false, settings: newSettings });
    }

    await db.insert(adminLogsTable).values({
      adminDiscordId: interaction.user.id,
      adminUsername: interaction.user.username,
      guildServerId: guildId,
      action: "set_multiplier",
      details: `${type}: ${value}`,
    }).catch(() => null);

    const typeLabels: Record<string, string> = {
      xpMultiplier: "✨ مضاعف الخبرة",
      goldMultiplier: "💰 مضاعف الذهب",
    };

    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setDescription(`${typeLabels[type]} تم ضبطه على **${value}x** لهذا السيرفر.`);

    return interaction.editReply({ embeds: [embed] });
  }
}
