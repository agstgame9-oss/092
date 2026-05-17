import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
} from "discord.js";
import { db, playersTable, guildsTable, guildMembersTable } from "../../lib/db.js";
import { eq, sql } from "drizzle-orm";
import { COLORS, errorEmbed, successEmbed } from "../../lib/embeds.js";
import { guildNavRow } from "../../lib/buttons.js";

type GuildRole = "leader" | "officer" | "member" | "recruit";
const ROLE_ORDER: Record<GuildRole, number> = { leader: 0, officer: 1, member: 2, recruit: 3 };
const ROLE_EMOJI: Record<string, string> = { leader: "👑", officer: "⭐", member: "⚔️", recruit: "🔰" };
const ROLE_NAMES: Record<string, string> = { leader: "قائد", officer: "ضابط", member: "عضو", recruit: "مجنّد" };

export const data = new SlashCommandBuilder()
  .setName("guild")
  .setDescription("🏰 أوامر النقابة")
  .addSubcommand((s) => s.setName("create")
    .setDescription("أنشئ نقابة جديدة (تكلف 5000 🪙)")
    .addStringOption((o) => o.setName("name").setDescription("اسم النقابة (حد أقصى 30 حرف)").setRequired(true))
    .addStringOption((o) => o.setName("tag").setDescription("رمز قصير مثل AMA (حد أقصى 5 أحرف)").setRequired(true))
    .addStringOption((o) => o.setName("emblem").setDescription("إيموجي شعار النقابة").setRequired(false))
  )
  .addSubcommand((s) => s.setName("join")
    .setDescription("انضم لنقابة باسمها")
    .addStringOption((o) => o.setName("name").setDescription("اسم النقابة للانضمام").setRequired(true))
  )
  .addSubcommand((s) => s.setName("leave").setDescription("اترك نقابتك الحالية"))
  .addSubcommand((s) => s.setName("info")
    .setDescription("اعرض معلومات نقابة")
    .addStringOption((o) => o.setName("name").setDescription("اسم النقابة (تلقائياً نقابتك)").setRequired(false))
  )
  .addSubcommand((s) => s.setName("members")
    .setDescription("قائمة أعضاء النقابة")
    .addStringOption((o) => o.setName("name").setDescription("اسم النقابة (تلقائياً نقابتك)").setRequired(false))
  )
  .addSubcommand((s) => s.setName("donate")
    .setDescription("تبرّع بذهب لخزينة النقابة")
    .addIntegerOption((o) => o.setName("amount").setDescription("مقدار الذهب للتبرع").setRequired(true).setMinValue(100))
  )
  .addSubcommand((s) => s.setName("kick")
    .setDescription("طرد عضو من النقابة (قائد / ضابط فقط)")
    .addUserOption((o) => o.setName("user").setDescription("اللاعب المراد طرده").setRequired(true))
  )
  .addSubcommand((s) => s.setName("promote")
    .setDescription("ترقية عضو إلى ضابط (قائد فقط)")
    .addUserOption((o) => o.setName("user").setDescription("اللاعب المراد ترقيته").setRequired(true))
  )
  .addSubcommand((s) => s.setName("demote")
    .setDescription("تخفيض ضابط إلى عضو (قائد فقط)")
    .addUserOption((o) => o.setName("user").setDescription("الضابط المراد تخفيض رتبته").setRequired(true))
  )
  .addSubcommand((s) => s.setName("transfer")
    .setDescription("نقل القيادة إلى عضو آخر (قائد فقط)")
    .addUserOption((o) => o.setName("user").setDescription("العضو الذي ستُنقل إليه القيادة").setRequired(true))
  )
  .addSubcommand((s) => s.setName("disband")
    .setDescription("حلّ النقابة وطرد جميع الأعضاء (قائد فقط)")
  )
  .addSubcommand((s) => s.setName("toggle")
    .setDescription("فتح/إغلاق النقابة لطلبات الانضمام (قائد/ضابط فقط)")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });
  if (player.isBanned) return interaction.editReply({ embeds: [errorEmbed("حسابك محظور.")] });

  // ── CREATE ─────────────────────────────────────────────────────────────────
  if (sub === "create") {
    const name   = interaction.options.getString("name", true).trim().slice(0, 30);
    const tag    = interaction.options.getString("tag", true).trim().toUpperCase().slice(0, 5);
    const emblem = interaction.options.getString("emblem") ?? "⚔️";

    const [gm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (gm) return interaction.editReply({ embeds: [errorEmbed("أنت بالفعل في نقابة! اترك نقابتك أولاً بـ `/guild leave`.")] });
    if (player.gold < 5000) return interaction.editReply({ embeds: [errorEmbed("إنشاء النقابة يكلّف **5,000 🪙 ذهب**.")] });

    const [existing] = await db.select().from(guildsTable).where(eq(guildsTable.name, name));
    if (existing) return interaction.editReply({ embeds: [errorEmbed(`توجد نقابة باسم **${name}** بالفعل.`)] });

    const [guild] = await db.insert(guildsTable).values({
      name, tag, emblem,
      leaderDiscordId: discordId,
      guildServerId: interaction.guildId ?? "global",
      level: 1, xp: 0, treasury: 0,
      maxMembers: 30, totalWins: 0, totalBossKills: 0,
      isOpen: true, perks: {},
    }).returning();

    await db.insert(guildMembersTable).values({
      guildId: guild.id, discordId, username: player.username,
      role: "leader", contribution: 0, weeklyContribution: 0,
    });
    await db.update(playersTable).set({ gold: player.gold - 5000, guildMemberId: guild.id, updatedAt: new Date() }).where(eq(playersTable.id, player.id));

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle(`${emblem} تم إنشاء النقابة: ${name} [${tag}]`)
        .setDescription(`أهلاً بك يا **القائد ${player.username}**!\nنقابتك جاهزة لاستقبال الأعضاء.`)
        .addFields({ name: "💰 التكلفة", value: "تم خصم 5,000 🪙 ذهب", inline: true })],
      components: [guildNavRow()],
    });
  }

  // ── JOIN ───────────────────────────────────────────────────────────────────
  if (sub === "join") {
    const name = interaction.options.getString("name", true).trim();
    const [gm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (gm) return interaction.editReply({ embeds: [errorEmbed("أنت بالفعل في نقابة! اترك نقابتك أولاً بـ `/guild leave`.")] });

    const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.name, name));
    if (!guild) return interaction.editReply({ embeds: [errorEmbed(`لا توجد نقابة باسم **${name}**.`)] });
    if (!guild.isOpen) return interaction.editReply({ embeds: [errorEmbed("هذه النقابة مغلقة ولا تقبل أعضاء جدداً.")] });

    const [count] = await db.select({ c: sql<number>`count(*)` }).from(guildMembersTable).where(eq(guildMembersTable.guildId, guild.id));
    if ((count?.c ?? 0) >= guild.maxMembers) return interaction.editReply({ embeds: [errorEmbed("النقابة ممتلئة!")] });

    await db.insert(guildMembersTable).values({
      guildId: guild.id, discordId, username: player.username, role: "recruit", contribution: 0, weeklyContribution: 0,
    });
    await db.update(playersTable).set({ guildMemberId: guild.id, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    return interaction.editReply({ embeds: [successEmbed(`انضممت إلى **${guild.emblem} ${guild.name}** [${guild.tag}]!`)], components: [guildNavRow()] });
  }

  // ── LEAVE ──────────────────────────────────────────────────────────────────
  if (sub === "leave") {
    const [gm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (!gm) return interaction.editReply({ embeds: [errorEmbed("أنت لست في نقابة.")] });

    const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, gm.guildId));
    if (guild?.leaderDiscordId === discordId) {
      return interaction.editReply({ embeds: [errorEmbed("القائد لا يمكنه المغادرة!\nانقل القيادة بـ `/guild transfer @عضو` أو حلّ النقابة بـ `/guild disband`.")] });
    }

    await db.delete(guildMembersTable).where(eq(guildMembersTable.id, gm.id));
    await db.update(playersTable).set({ guildMemberId: null, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    return interaction.editReply({ embeds: [successEmbed(`غادرت **${guild?.name ?? "النقابة"}**.`)] });
  }

  // ── INFO / MEMBERS ─────────────────────────────────────────────────────────
  if (sub === "info" || sub === "members") {
    let guild;
    const nameOpt = interaction.options.getString("name");
    if (nameOpt) {
      [guild] = await db.select().from(guildsTable).where(eq(guildsTable.name, nameOpt));
    } else {
      const [gm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
      if (!gm) return interaction.editReply({ embeds: [errorEmbed("أنت لست في نقابة. حدّد اسم النقابة.")] });
      [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, gm.guildId));
    }
    if (!guild) return interaction.editReply({ embeds: [errorEmbed("النقابة غير موجودة.")] });

    const members = await db.select().from(guildMembersTable).where(eq(guildMembersTable.guildId, guild.id));

    if (sub === "members") {
      members.sort((a, b) => (ROLE_ORDER[a.role as GuildRole] ?? 9) - (ROLE_ORDER[b.role as GuildRole] ?? 9));
      const lines = members.map((m) =>
        `${ROLE_EMOJI[m.role] ?? "❓"} **${m.username}** — ${ROLE_NAMES[m.role] ?? m.role} | مساهمة: ${m.contribution.toLocaleString()}`
      );
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.primary)
          .setTitle(`${guild.emblem} ${guild.name} — الأعضاء (${members.length}/${guild.maxMembers})`)
          .setDescription(lines.join("\n") || "لا يوجد أعضاء.")],
        components: [guildNavRow()],
      });
    }

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle(`${guild.emblem} ${guild.name} [${guild.tag}]`)
        .setDescription(guild.description ?? "*لا يوجد وصف*")
        .addFields(
          { name: "🏯 المستوى", value: String(guild.level), inline: true },
          { name: "👥 الأعضاء", value: `${members.length}/${guild.maxMembers}`, inline: true },
          { name: "🚪 الحالة", value: guild.isOpen ? "✅ مفتوحة" : "🔒 مغلقة", inline: true },
          { name: "💰 الخزينة", value: `${guild.treasury.toLocaleString()} 🪙`, inline: true },
          { name: "🏆 الانتصارات", value: guild.totalWins.toLocaleString(), inline: true },
          { name: "💀 قتل الزعماء", value: guild.totalBossKills.toLocaleString(), inline: true },
        )
        .setTimestamp(guild.createdAt)],
      components: [guildNavRow()],
    });
  }

  // ── DONATE ─────────────────────────────────────────────────────────────────
  if (sub === "donate") {
    const amount = interaction.options.getInteger("amount", true);
    const [gm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (!gm) return interaction.editReply({ embeds: [errorEmbed("أنت لست في نقابة.")] });
    if (player.gold < amount) return interaction.editReply({ embeds: [errorEmbed(`ذهب غير كافٍ! لديك **${player.gold.toLocaleString()} 🪙**.`)] });

    const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, gm.guildId));
    await Promise.all([
      db.update(playersTable).set({ gold: player.gold - amount, updatedAt: new Date() }).where(eq(playersTable.id, player.id)),
      db.update(guildsTable).set({ treasury: (guild?.treasury ?? 0) + amount }).where(eq(guildsTable.id, gm.guildId)),
      db.update(guildMembersTable).set({ contribution: gm.contribution + amount, weeklyContribution: gm.weeklyContribution + amount }).where(eq(guildMembersTable.id, gm.id)),
    ]);
    return interaction.editReply({ embeds: [successEmbed(`تم التبرع بـ **${amount.toLocaleString()} 🪙** لخزينة **${guild?.name ?? "النقابة"}**!`)], components: [guildNavRow()] });
  }

  // ── KICK ───────────────────────────────────────────────────────────────────
  if (sub === "kick") {
    const [myGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (!myGm) return interaction.editReply({ embeds: [errorEmbed("أنت لست في نقابة.")] });
    if (myGm.role !== "leader" && myGm.role !== "officer") {
      return interaction.editReply({ embeds: [errorEmbed("فقط القادة والضباط يمكنهم طرد الأعضاء.")] });
    }

    const targetUser = interaction.options.getUser("user", true);
    if (targetUser.id === discordId) return interaction.editReply({ embeds: [errorEmbed("لا يمكنك طرد نفسك!")] });

    const [targetGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, targetUser.id));
    if (!targetGm || targetGm.guildId !== myGm.guildId) {
      return interaction.editReply({ embeds: [errorEmbed("هذا اللاعب ليس في نقابتك.")] });
    }
    if (targetGm.role === "leader") return interaction.editReply({ embeds: [errorEmbed("لا يمكن طرد القائد!")] });
    if (targetGm.role === "officer" && myGm.role !== "leader") {
      return interaction.editReply({ embeds: [errorEmbed("فقط القائد يمكنه طرد الضباط.")] });
    }

    const [targetPlayer] = await db.select().from(playersTable).where(eq(playersTable.discordId, targetUser.id));
    await db.delete(guildMembersTable).where(eq(guildMembersTable.id, targetGm.id));
    if (targetPlayer) {
      await db.update(playersTable).set({ guildMemberId: null, updatedAt: new Date() }).where(eq(playersTable.id, targetPlayer.id));
    }
    return interaction.editReply({ embeds: [successEmbed(`تم طرد **${targetGm.username}** من النقابة.`)], components: [guildNavRow()] });
  }

  // ── PROMOTE ────────────────────────────────────────────────────────────────
  if (sub === "promote") {
    const [myGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (!myGm || myGm.role !== "leader") return interaction.editReply({ embeds: [errorEmbed("فقط القائد يمكنه ترقية الأعضاء.")] });

    const targetUser = interaction.options.getUser("user", true);
    const [targetGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, targetUser.id));
    if (!targetGm || targetGm.guildId !== myGm.guildId) return interaction.editReply({ embeds: [errorEmbed("هذا اللاعب ليس في نقابتك.")] });
    if (targetGm.role === "officer" || targetGm.role === "leader") return interaction.editReply({ embeds: [errorEmbed("هذا اللاعب ضابط بالفعل أو أعلى.")] });

    await db.update(guildMembersTable).set({ role: "officer" }).where(eq(guildMembersTable.id, targetGm.id));
    return interaction.editReply({ embeds: [successEmbed(`⭐ تمت ترقية **${targetGm.username}** إلى **ضابط**!`)], components: [guildNavRow()] });
  }

  // ── DEMOTE ─────────────────────────────────────────────────────────────────
  if (sub === "demote") {
    const [myGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (!myGm || myGm.role !== "leader") return interaction.editReply({ embeds: [errorEmbed("فقط القائد يمكنه تخفيض الرتب.")] });

    const targetUser = interaction.options.getUser("user", true);
    const [targetGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, targetUser.id));
    if (!targetGm || targetGm.guildId !== myGm.guildId) return interaction.editReply({ embeds: [errorEmbed("هذا اللاعب ليس في نقابتك.")] });
    if (targetGm.role !== "officer") return interaction.editReply({ embeds: [errorEmbed("هذا اللاعب ليس ضابطاً.")] });

    await db.update(guildMembersTable).set({ role: "member" }).where(eq(guildMembersTable.id, targetGm.id));
    return interaction.editReply({ embeds: [successEmbed(`⚔️ تم تخفيض **${targetGm.username}** إلى **عضو**.`)], components: [guildNavRow()] });
  }

  // ── TRANSFER LEADERSHIP ────────────────────────────────────────────────────
  if (sub === "transfer") {
    const [myGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (!myGm || myGm.role !== "leader") return interaction.editReply({ embeds: [errorEmbed("فقط القائد يمكنه نقل القيادة.")] });

    const targetUser = interaction.options.getUser("user", true);
    if (targetUser.id === discordId) return interaction.editReply({ embeds: [errorEmbed("لا يمكنك نقل القيادة لنفسك!")] });

    const [targetGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, targetUser.id));
    if (!targetGm || targetGm.guildId !== myGm.guildId) return interaction.editReply({ embeds: [errorEmbed("هذا اللاعب ليس في نقابتك.")] });

    const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, myGm.guildId));

    await Promise.all([
      db.update(guildMembersTable).set({ role: "leader" }).where(eq(guildMembersTable.id, targetGm.id)),
      db.update(guildMembersTable).set({ role: "member" }).where(eq(guildMembersTable.id, myGm.id)),
      db.update(guildsTable).set({ leaderDiscordId: targetUser.id }).where(eq(guildsTable.id, myGm.guildId)),
    ]);

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.gold)
        .setTitle("👑 تم نقل القيادة!")
        .setDescription(`**${targetGm.username}** هو القائد الجديد لـ **${guild?.emblem ?? ""} ${guild?.name ?? "النقابة"}**.\nأنت الآن عضو عادي.`)],
      components: [guildNavRow()],
    });
  }

  // ── DISBAND ────────────────────────────────────────────────────────────────
  if (sub === "disband") {
    const [myGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (!myGm || myGm.role !== "leader") return interaction.editReply({ embeds: [errorEmbed("فقط القائد يمكنه حلّ النقابة.")] });

    const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, myGm.guildId));
    const allMembers = await db.select().from(guildMembersTable).where(eq(guildMembersTable.guildId, myGm.guildId));

    // Reset all members' guild affiliation
    for (const m of allMembers) {
      const [p] = await db.select().from(playersTable).where(eq(playersTable.discordId, m.discordId));
      if (p) await db.update(playersTable).set({ guildMemberId: null, updatedAt: new Date() }).where(eq(playersTable.id, p.id));
    }

    await db.delete(guildMembersTable).where(eq(guildMembersTable.guildId, myGm.guildId));
    await db.delete(guildsTable).where(eq(guildsTable.id, myGm.guildId));

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.danger)
        .setTitle("💔 تم حلّ النقابة")
        .setDescription(`تم حلّ **${guild?.emblem ?? ""} ${guild?.name ?? "النقابة"}** وطرد جميع **${allMembers.length}** عضو.`)
        .setFooter({ text: "يمكنك إنشاء نقابة جديدة في أي وقت بـ /guild create" })],
    });
  }

  // ── TOGGLE OPEN/CLOSE ──────────────────────────────────────────────────────
  if (sub === "toggle") {
    const [myGm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.discordId, discordId));
    if (!myGm) return interaction.editReply({ embeds: [errorEmbed("أنت لست في نقابة.")] });
    if (myGm.role !== "leader" && myGm.role !== "officer") {
      return interaction.editReply({ embeds: [errorEmbed("فقط القادة والضباط يمكنهم تغيير حالة الانضمام.")] });
    }

    const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, myGm.guildId));
    if (!guild) return interaction.editReply({ embeds: [errorEmbed("النقابة غير موجودة.")] });

    const newStatus = !guild.isOpen;
    await db.update(guildsTable).set({ isOpen: newStatus }).where(eq(guildsTable.id, guild.id));

    return interaction.editReply({
      embeds: [successEmbed(`النقابة الآن **${newStatus ? "✅ مفتوحة" : "🔒 مغلقة"}** لطلبات الانضمام.`)],
      components: [guildNavRow()],
    });
  }
}
