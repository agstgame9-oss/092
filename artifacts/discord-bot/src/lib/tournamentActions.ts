import {
  ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuInteraction,
} from "discord.js";
import { db } from "./db.js";
import { tournamentsTable, tournamentParticipantsTable, playersTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { COLORS, errorEmbed, successEmbed, ELEMENT_EMOJI, RARITY_EMOJI, type ColorResolvable } from "./embeds.js";
import { isAdmin } from "./adminActions.js";
import { buildFighterForPlayer, resolveTournamentMatch } from "./tournamentEngine.js";
import { pvpBattles } from "./battleState.js";
import { pvpMoveRow } from "./buttons.js";
import { getElementMultiplier } from "./gameEngine.js";

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function prepare(i: AnyInteraction) {
  if (!i.deferred && !i.replied) {
    if (i.isButton()) await i.deferUpdate();
    else await (i as ChatInputCommandInteraction).deferReply();
  }
}

// ── Status Displays ───────────────────────────────────────────────────────────

const STATUS_AR: Record<string, string> = {
  registration: "📋 تسجيل", active: "⚔️ نشطة", finals: "🏆 النهائيات",
  completed: "✅ منتهية", cancelled: "❌ ملغية",
};

const STATUS_COLOR: Record<string, ColorResolvable> = {
  registration: COLORS.info, active: COLORS.fire, finals: COLORS.gold,
  completed: COLORS.success, cancelled: COLORS.danger,
};

// ── Visual Bracket Renderer ───────────────────────────────────────────────────

type Match = { round: number; matchId: string; player1: string; player2: string | null; winner: string | null; battleId: string | null };

function renderBracket(bracket: Match[], participants: { discordId: string; username: string }[], totalRounds: number): string {
  if (!bracket.length) return "```\nالبراكيت لم يُنشأ بعد.\n```";

  const userMap = Object.fromEntries(participants.map(p => [p.discordId, p.username]));
  const rounds: Record<number, Match[]> = {};
  for (const m of bracket) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  }

  const ROUND_NAMES: Record<number, string> = {};
  for (let r = 1; r <= totalRounds; r++) {
    const remaining = totalRounds - r;
    if (remaining === 0) ROUND_NAMES[r] = "🏆 النهائي الكبير";
    else if (remaining === 1) ROUND_NAMES[r] = "🥊 نصف النهائي";
    else if (remaining === 2) ROUND_NAMES[r] = "⚔️ ربع النهائي";
    else ROUND_NAMES[r] = `⚡ الجولة ${r}`;
  }

  const sections = Object.entries(rounds).map(([r, ms]) => {
    const rn = parseInt(r);
    const header = ROUND_NAMES[rn] ?? `الجولة ${r}`;
    const matchLines = ms.map(m => {
      const p1 = userMap[m.player1] ?? m.player1.slice(0, 8);
      const p2 = m.player2 ? (userMap[m.player2] ?? m.player2.slice(0, 8)) : "BYE 🎯";
      const w = m.winner
        ? (m.winner === m.player1 ? `🏆 **${p1}** يفوز!` : `🏆 **${p2}** يفوز!`)
        : (m.player2 ? `⚔️ ${p1}  🆚  ${p2}` : `🎯 ${p1} يتقدم تلقائياً`);
      return `> ${w}`;
    });
    return `**${header}**\n${matchLines.join("\n")}`;
  });

  return sections.join("\n\n");
}

// ── Nav Rows ──────────────────────────────────────────────────────────────────

export function tournamentNavRow(openId?: number) {
  const btns = [
    new ButtonBuilder().setCustomId("tournament:view").setLabel("🏆 البطولات").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tournament:bracket").setLabel("📊 البراكيت").setStyle(ButtonStyle.Secondary),
  ];
  if (openId) btns.push(new ButtonBuilder().setCustomId(`tournament:join:${openId}`).setLabel("✅ انضم").setStyle(ButtonStyle.Success));
  return new ActionRowBuilder<ButtonBuilder>().addComponents(btns);
}

export function adminTournamentRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("tournament:admin:create").setLabel("➕ إنشاء").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tournament:admin:start").setLabel("▶️ ابدأ").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("tournament:admin:next").setLabel("⏭️ جولة تالية").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("tournament:admin:cancel").setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger),
  );
}

export function playerTournamentRow(openId?: number) {
  const btns: ButtonBuilder[] = [
    new ButtonBuilder().setCustomId("tournament:view").setLabel("🏆 البطولات").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tournament:bracket").setLabel("📊 البراكيت").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("tournament:fight").setLabel("⚔️ قاتل الآن").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("tournament:bets").setLabel("💰 الرهانات").setStyle(ButtonStyle.Success),
  ];
  if (openId) btns.splice(1, 0, new ButtonBuilder().setCustomId(`tournament:join:${openId}`).setLabel("✅ انضم").setStyle(ButtonStyle.Success));
  return new ActionRowBuilder<ButtonBuilder>().addComponents(btns.slice(0, 5));
}

// ── View Tournaments ──────────────────────────────────────────────────────────

export async function actionTournamentView(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);
  const guildId = interaction.guildId;
  if (!guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const list = await db.select().from(tournamentsTable)
    .where(eq(tournamentsTable.guildServerId, guildId))
    .orderBy(desc(tournamentsTable.createdAt)).limit(5);

  if (!list.length) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.gold)
        .setTitle("🏆 بطولات السيرفر")
        .setDescription("```\nلا توجد بطولات بعد!\n```\n> يمكن للمشرفين إنشاء بطولة بالنقر على ➕ إنشاء")
        .setFooter({ text: "🏆 نظام البطولات • أنيمي ملتيفرس أرينا" })],
      components: [adminTournamentRow()],
    });
  }

  const open = list.find(t => t.status === "registration");
  const active = list.find(t => t.status === "active" || t.status === "finals");

  const lines = list.map(t => {
    const status = STATUS_AR[t.status] ?? "❓";
    const prize = t.prizePool > 0 ? `💰 ${t.prizePool.toLocaleString()}` : "بدون جائزة";
    const prizeGems = (t.prizes as Array<{ rank: number; gems: number }>)?.[0]?.gems ?? 0;
    const gemStr = prizeGems > 0 ? ` | 💎 ${prizeGems}` : "";
    return `${status} **${t.name}**\n> ${t.size} لاعب | ${prize}${gemStr} | الجولة: ${t.currentRound}/${t.totalRounds}`;
  });

  const embed = new EmbedBuilder()
    .setColor(active ? STATUS_COLOR["active"] : open ? STATUS_COLOR["registration"] : COLORS.gold)
    .setTitle("🏆 بطولات السيرفر")
    .setDescription(lines.join("\n\n"))
    .addFields(
      active
        ? { name: "⚔️ بطولة نشطة", value: `**${active.name}** — الجولة ${active.currentRound}/${active.totalRounds}`, inline: false }
        : open
          ? { name: "📋 مفتوحة للتسجيل", value: `**${open.name}** — سجّل الآن!`, inline: false }
          : { name: "📭 لا توجد بطولة نشطة", value: "انتظر إنشاء بطولة جديدة", inline: false }
    )
    .setFooter({ text: "🏆 أنيمي ملتيفرس أرينا • نظام البطولات" })
    .setTimestamp();

  const rows: ActionRowBuilder<ButtonBuilder>[] = [tournamentNavRow(open?.id), adminTournamentRow()];
  await interaction.editReply({ embeds: [embed], components: rows });
}

// ── Join Tournament ───────────────────────────────────────────────────────────

export async function actionTournamentJoin(interaction: AnyInteraction, tournamentId?: number): Promise<void> {
  await prepare(interaction);
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")], components: [] });
  if (player.isBanned) return void interaction.editReply({ embeds: [errorEmbed("حسابك موقوف.")], components: [] });

  let tournament;
  if (tournamentId) {
    const res = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    tournament = res[0];
  } else {
    const res = await db.select().from(tournamentsTable)
      .where(and(eq(tournamentsTable.guildServerId, interaction.guildId), eq(tournamentsTable.status, "registration"))).limit(1);
    tournament = res[0];
  }

  if (!tournament) return void interaction.editReply({ embeds: [errorEmbed("لا توجد بطولة مفتوحة للتسجيل.")], components: [tournamentNavRow()] });
  if (tournament.status !== "registration") return void interaction.editReply({ embeds: [errorEmbed(`**${tournament.name}** غير مفتوحة للتسجيل.`)], components: [tournamentNavRow()] });

  const already = await db.select().from(tournamentParticipantsTable)
    .where(and(eq(tournamentParticipantsTable.tournamentId, tournament.id), eq(tournamentParticipantsTable.discordId, interaction.user.id)));
  if (already.length) return void interaction.editReply({ embeds: [errorEmbed(`مسجّل بالفعل في **${tournament.name}**!`)], components: [tournamentNavRow(tournament.id)] });

  const [cnt] = await db.select({ c: count() }).from(tournamentParticipantsTable).where(eq(tournamentParticipantsTable.tournamentId, tournament.id));
  if ((cnt?.c ?? 0) >= tournament.size) return void interaction.editReply({ embeds: [errorEmbed(`**${tournament.name}** اكتملت المقاعد!`)], components: [tournamentNavRow()] });

  await db.insert(tournamentParticipantsTable).values({ tournamentId: tournament.id, discordId: interaction.user.id, username: player.username });
  const newCount = (cnt?.c ?? 0) + 1;

  const prizes = (tournament.prizes as Array<{ rank: number; gold: number; gems: number; title?: string }>) ?? [];
  const firstPrize = prizes.find(p => p.rank === 1);

  const progressBar = buildProgressBar(newCount, tournament.size);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle("✅ تم التسجيل في البطولة!")
      .setDescription(`> 🏆 انضممت إلى **${tournament.name}**!\n> ${progressBar}`)
      .addFields(
        { name: "👥 المشاركون", value: `**${newCount}** / **${tournament.size}**`, inline: true },
        { name: "💰 جائزة المركز الأول", value: firstPrize ? `${firstPrize.gold.toLocaleString()} 💰 + ${firstPrize.gems} 💎` : "—", inline: true },
        { name: "📊 تقييمك", value: `${player.pvpRating} نقطة`, inline: true },
        { name: "💡 نصيحة", value: `${tournament.size - newCount} مقعد متبقٍ — شجّع أصدقاءك على المشاركة!`, inline: false },
      )
      .setFooter({ text: "حظاً موفقاً! البطولة تبدأ عندما يأمر المشرف • أنيمي ملتيفرس أرينا" })
      .setTimestamp()],
    components: [tournamentNavRow(tournament.id)],
  });
}

function buildProgressBar(current: number, max: number): string {
  const pct = current / max;
  const filled = Math.round(pct * 10);
  const empty = 10 - filled;
  const bar = "🟩".repeat(filled) + "⬛".repeat(empty);
  return `${bar} **${Math.round(pct * 100)}%**`;
}

// ── Bracket View ──────────────────────────────────────────────────────────────

export async function actionTournamentBracket(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const [t] = await db.select().from(tournamentsTable)
    .where(eq(tournamentsTable.guildServerId, interaction.guildId))
    .orderBy(desc(tournamentsTable.createdAt)).limit(1);

  if (!t) return void interaction.editReply({ embeds: [errorEmbed("لا توجد بطولة.")], components: [adminTournamentRow()] });

  const participants = await db.select().from(tournamentParticipantsTable)
    .where(eq(tournamentParticipantsTable.tournamentId, t.id));
  const bracket = (t.bracket ?? []) as Match[];

  let bracketDesc: string;
  if (!participants.length) {
    bracketDesc = "```\nلم يسجل أحد بعد.\n```";
  } else if (!bracket.length) {
    const pLines = participants.map((p, i) => `${i + 1}. **${p.username}** (${p.discordId.slice(0, 6)}...)`).join("\n");
    bracketDesc = `**المشاركون (${participants.length}/${t.size}):**\n${pLines}`;
  } else {
    bracketDesc = renderBracket(bracket, participants, t.totalRounds);
  }

  const prizes = (t.prizes as Array<{ rank: number; gold: number; gems: number; title?: string }>) ?? [];

  const prizeLines = prizes.map(p => {
    const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`;
    const parts: string[] = [];
    if (p.gold > 0) parts.push(`${p.gold.toLocaleString()} 💰`);
    if (p.gems > 0) parts.push(`${p.gems} 💎`);
    const title = p.title ? ` *(${p.title})*` : "";
    return `${medal} ${parts.join(" + ")}${title}`;
  });

  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOR[t.status] ?? COLORS.gold)
    .setTitle(`🏆 ${t.name} — البراكيت`)
    .setDescription(bracketDesc)
    .addFields(
      { name: "📊 الحالة", value: STATUS_AR[t.status] ?? "❓", inline: true },
      { name: "🔄 الجولة", value: `${t.currentRound} / ${t.totalRounds}`, inline: true },
      { name: "👥 المشاركون", value: `${participants.length} / ${t.size}`, inline: true },
    );

  if (prizeLines.length) {
    embed.addFields({ name: "🎁 الجوائز", value: prizeLines.join("\n"), inline: false });
  }

  embed.setFooter({ text: "🏆 نظام البطولات • أنيمي ملتيفرس أرينا" }).setTimestamp();

  const open = t.status === "registration" ? t.id : undefined;
  await interaction.editReply({ embeds: [embed], components: [tournamentNavRow(open), adminTournamentRow()] });
}

// ── Admin: Create Tournament ──────────────────────────────────────────────────

export async function openCreateTournamentModal(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) {
    return void (interaction.isButton()
      ? (interaction as ButtonInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true })
      : (interaction as ChatInputCommandInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true }));
  }

  const modal = new ModalBuilder().setCustomId("tournament:modal:create").setTitle("🏆 إنشاء بطولة جديدة");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("name").setLabel("اسم البطولة").setStyle(TextInputStyle.Short).setPlaceholder("بطولة أنيمي ملتيفرس الكبرى").setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("size").setLabel("الحد الأقصى للمشاركين (4 أو 8 أو 16 أو 32)").setStyle(TextInputStyle.Short).setPlaceholder("16").setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("prize_pool").setLabel("جائزة المركز الأول (ذهب — اختياري)").setStyle(TextInputStyle.Short).setPlaceholder("10000").setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("prizes").setLabel("جواهر الجوائز: 1st | 2nd | 3rd (اختياري)").setStyle(TextInputStyle.Short).setPlaceholder("100 | 50 | 25").setRequired(false)
    ),
  );
  await (interaction as ButtonInteraction).showModal(modal);
}

// ── Admin: Start Tournament ───────────────────────────────────────────────────

export async function actionAdminStartTournament(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) {
    return void (interaction.isButton()
      ? (interaction as ButtonInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true })
      : (interaction as ChatInputCommandInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true }));
  }
  if (!interaction.deferred && !interaction.replied) {
    if (interaction.isButton()) await (interaction as ButtonInteraction).deferReply({ ephemeral: true });
    else await (interaction as ChatInputCommandInteraction).deferReply({ ephemeral: true });
  }

  const [t] = await db.select().from(tournamentsTable)
    .where(and(eq(tournamentsTable.guildServerId, interaction.guildId!), eq(tournamentsTable.status, "registration")));
  if (!t) return void interaction.editReply({ embeds: [errorEmbed("لا توجد بطولة في مرحلة التسجيل.")] });

  const participants = await db.select().from(tournamentParticipantsTable)
    .where(eq(tournamentParticipantsTable.tournamentId, t.id));
  if (participants.length < 2) return void interaction.editReply({ embeds: [errorEmbed("يجب وجود لاعبَين على الأقل للبدء.")] });

  // Build bracket with PvP rating-based seeding (top seed vs bottom seed)
  const participantRatings = await Promise.all(
    participants.map(async p => {
      const [player] = await db.select({ pvpRating: playersTable.pvpRating }).from(playersTable).where(eq(playersTable.discordId, p.discordId));
      return { ...p, rating: player?.pvpRating ?? 1000 };
    })
  );
  const sorted = participantRatings.sort((a, b) => b.rating - a.rating);
  // Update seeds in DB
  await Promise.all(sorted.map((p, i) =>
    db.update(tournamentParticipantsTable).set({ seed: i + 1 }).where(eq(tournamentParticipantsTable.id, p.id))
  ));
  // Pair: 1 vs N, 2 vs N-1, etc.
  const seeded: typeof sorted = [];
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    if (lo === hi) { seeded.push(sorted[lo]); break; }
    seeded.push(sorted[lo], sorted[hi]);
    lo++; hi--;
  }
  const bracket: Match[] = [];
  for (let i = 0; i < seeded.length; i += 2) {
    bracket.push({
      round: 1,
      matchId: `r1m${Math.floor(i / 2) + 1}`,
      player1: seeded[i].discordId,
      player2: seeded[i + 1]?.discordId ?? null,
      winner: seeded[i + 1] ? null : seeded[i].discordId,
      battleId: null,
    });
  }

  const totalRounds = Math.ceil(Math.log2(participants.length));
  await db.update(tournamentsTable).set({ status: "active", currentRound: 1, totalRounds, bracket, updatedAt: new Date() })
    .where(eq(tournamentsTable.id, t.id));

  const matchCount = Math.floor(participants.length / 2);
  const byes = participants.length % 2;

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("⚔️ البطولة بدأت!")
      .setDescription(`> **${t.name}** انطلقت بـ **${participants.length}** لاعب!`)
      .addFields(
        { name: "🔄 الجولة الحالية", value: `الجولة 1 من ${totalRounds}`, inline: true },
        { name: "⚔️ المباريات", value: `${matchCount}`, inline: true },
        { name: "🎯 BYE", value: byes > 0 ? "لاعب واحد يتقدم تلقائياً" : "لا توجد", inline: true },
        { name: "📢 التالي", value: "استخدم `/tournament bracket` لرؤية البراكيت\nبعد انتهاء المباريات استخدم **⏭️ الجولة التالية**", inline: false },
      )
      .setFooter({ text: "🏆 حظاً للجميع! • أنيمي ملتيفرس أرينا" })],
  });
}

// ── Admin: Advance to Next Round ──────────────────────────────────────────────

export async function actionAdminNextRound(interaction: ButtonInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) return void interaction.reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true });
  await interaction.deferReply({ ephemeral: true });

  const [t] = await db.select().from(tournamentsTable)
    .where(and(eq(tournamentsTable.guildServerId, interaction.guildId!), eq(tournamentsTable.status, "active")));
  if (!t) return void interaction.editReply({ embeds: [errorEmbed("لا توجد بطولة نشطة.")] });

  const bracket = (t.bracket ?? []) as Match[];
  const currentMatches = bracket.filter(m => m.round === t.currentRound);

  // Auto-resolve pending matches using player stats (rating + atk + hp weighting)
  for (const m of currentMatches) {
    if (!m.winner && m.player2) {
      const [f1, f2] = await Promise.all([
        buildFighterForPlayer(m.player1, m.player1),
        buildFighterForPlayer(m.player2, m.player2),
      ]);
      if (f1 && f2) {
        const score1 = f1.rating + f1.fighter.atk * 0.5 + f1.fighter.hp * 0.05;
        const score2 = f2.rating + f2.fighter.atk * 0.5 + f2.fighter.hp * 0.05;
        m.winner = Math.random() * (score1 + score2) < score1 ? m.player1 : m.player2;
      } else {
        m.winner = f1 ? m.player1 : (f2 ? m.player2 : (Math.random() < 0.5 ? m.player1 : m.player2));
      }
    } else if (!m.winner && !m.player2) {
      m.winner = m.player1;
    }
  }

  const nextRound = t.currentRound + 1;
  if (nextRound > t.totalRounds) {
    // Tournament complete!
    const finalMatch = currentMatches[0];
    const participants = await db.select().from(tournamentParticipantsTable).where(eq(tournamentParticipantsTable.tournamentId, t.id));
    const champion = participants.find(p => p.discordId === finalMatch?.winner);

    // Give prizes
    const prizes = (t.prizes as Array<{ rank: number; gold: number; gems: number }>) ?? [];
    if (champion) {
      const [champPlayer] = await db.select().from(playersTable).where(eq(playersTable.discordId, champion.discordId));
      if (champPlayer) {
        const firstPrize = prizes.find(p => p.rank === 1);
        if (firstPrize) {
          await db.update(playersTable).set({
            gold: champPlayer.gold + firstPrize.gold,
            gems: champPlayer.gems + firstPrize.gems,
          }).where(eq(playersTable.id, champPlayer.id));
        }
      }
    }

    await db.update(tournamentsTable).set({ status: "completed", bracket, updatedAt: new Date() }).where(eq(tournamentsTable.id, t.id));
    return void interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.gold)
        .setTitle("🏆 البطولة اكتملت!")
        .setDescription(`> **${t.name}** انتهت!\n> 🥇 البطل: **${champion?.username ?? "غير محدد"}**`)
        .addFields({ name: "🎁 المكافآت", value: "تم توزيع الجوائز على الفائزين تلقائياً!", inline: false })
        .setFooter({ text: "🏆 شكراً للجميع على المشاركة! • أنيمي ملتيفرس أرينا" })],
    });
  }

  // Build next round matches from winners
  const winners = currentMatches.map(m => m.winner).filter(Boolean) as string[];
  const nextMatches: Match[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push({
      round: nextRound,
      matchId: `r${nextRound}m${Math.floor(i / 2) + 1}`,
      player1: winners[i],
      player2: winners[i + 1] ?? null,
      winner: winners[i + 1] ? null : winners[i],
      battleId: null,
    });
  }

  const allBracket = [...bracket.filter(m => m.round !== t.currentRound), ...currentMatches, ...nextMatches];
  const status = nextRound === t.totalRounds ? "finals" : "active";

  await db.update(tournamentsTable).set({ bracket: allBracket, currentRound: nextRound, status, updatedAt: new Date() })
    .where(eq(tournamentsTable.id, t.id));

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(nextRound === t.totalRounds ? COLORS.gold : COLORS.fire)
      .setTitle(nextRound === t.totalRounds ? "🏆 النهائي الكبير!" : `⚔️ الجولة ${nextRound} بدأت!`)
      .setDescription(`> البطولة تتصاعد! ${nextMatches.length} مباراة في الجولة ${nextRound}`)
      .addFields(
        { name: "🔄 الجولة", value: `${nextRound} / ${t.totalRounds}`, inline: true },
        { name: "⚔️ المباريات", value: `${nextMatches.length}`, inline: true },
      )],
  });
}

// ── Admin: Cancel Tournament ──────────────────────────────────────────────────

export async function actionAdminCancelTournament(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) {
    return void (interaction.isButton()
      ? (interaction as ButtonInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true })
      : (interaction as ChatInputCommandInteraction).reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true }));
  }
  if (!interaction.deferred && !interaction.replied) {
    if (interaction.isButton()) await (interaction as ButtonInteraction).deferReply({ ephemeral: true });
    else await (interaction as ChatInputCommandInteraction).deferReply({ ephemeral: true });
  }

  const [t] = await db.select().from(tournamentsTable)
    .where(eq(tournamentsTable.guildServerId, interaction.guildId!))
    .orderBy(desc(tournamentsTable.createdAt)).limit(1);

  if (!t || t.status === "completed" || t.status === "cancelled") {
    return void interaction.editReply({ embeds: [errorEmbed("لا توجد بطولة نشطة لإلغائها.")] });
  }
  await db.update(tournamentsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(tournamentsTable.id, t.id));
  await interaction.editReply({ embeds: [successEmbed(`تم إلغاء بطولة **${t.name}**.`)] });
}

// ── Fight: Start Real PvP Match ───────────────────────────────────────────────

export async function actionTournamentFight(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const [t] = await db.select().from(tournamentsTable)
    .where(and(eq(tournamentsTable.guildServerId, interaction.guildId), eq(tournamentsTable.status, "active")))
    .orderBy(desc(tournamentsTable.createdAt)).limit(1);

  if (!t) {
    const [finals] = await db.select().from(tournamentsTable)
      .where(and(eq(tournamentsTable.guildServerId, interaction.guildId), eq(tournamentsTable.status, "finals")))
      .orderBy(desc(tournamentsTable.createdAt)).limit(1);
    if (!finals) return void interaction.editReply({ embeds: [errorEmbed("لا توجد بطولة نشطة الآن.")], components: [adminTournamentRow()] });
    Object.assign(t ?? {}, finals);
  }

  const activeTournament = t;
  if (!activeTournament) return void interaction.editReply({ embeds: [errorEmbed("لا توجد بطولة نشطة.")], components: [] });

  const bracket = (activeTournament.bracket ?? []) as Array<{ round: number; matchId: string; player1: string; player2: string | null; winner: string | null; battleId: string | null }>;
  const currentMatches = bracket.filter(m => m.round === activeTournament.currentRound && !m.winner);

  const myMatch = currentMatches.find(m => m.player1 === interaction.user.id || m.player2 === interaction.user.id);
  if (!myMatch) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning)
        .setTitle("⚔️ لا مباراة معلقة")
        .setDescription("> إما أنك تحديت بالفعل في هذه الجولة، أو أنت لست مشاركاً في هذه البطولة.\n> استخدم `/tournament bracket` لرؤية الوضع.")],
      components: [playerTournamentRow()],
    });
  }

  if (myMatch.player2 === null) {
    const bk = [...bracket];
    const idx = bk.findIndex(m => m.matchId === myMatch.matchId);
    bk[idx].winner = interaction.user.id;
    await db.update(tournamentsTable).set({ bracket: bk, updatedAt: new Date() }).where(eq(tournamentsTable.id, activeTournament.id));
    return void interaction.editReply({
      embeds: [successEmbed("لا خصم في هذه الجولة! تقدمت تلقائياً إلى الجولة التالية. 🎯")],
      components: [playerTournamentRow()],
    });
  }

  const opponentId = myMatch.player1 === interaction.user.id ? myMatch.player2 : myMatch.player1;
  const participants = await db.select().from(tournamentParticipantsTable).where(eq(tournamentParticipantsTable.tournamentId, activeTournament.id));
  const opponentParticipant = participants.find(p => p.discordId === opponentId);
  const opponentName = opponentParticipant?.username ?? "منافس";

  const [aData, dData] = await Promise.all([
    buildFighterForPlayer(interaction.user.id, interaction.user.username),
    buildFighterForPlayer(opponentId, opponentName),
  ]);

  if (!aData) return void interaction.editReply({ embeds: [errorEmbed("ليس لديك شخصيات! استخدم `/summon` أولاً.")], components: [] });
  if (!dData) return void interaction.editReply({ embeds: [errorEmbed("منافسك لا يملك شخصيات!")], components: [] });

  const battleId = `tourn_${activeTournament.id}_${myMatch.matchId}_${Date.now()}`;
  const battle = {
    battleId,
    channelId: interaction.channelId,
    messageId: "",
    attacker: aData.fighter,
    defender: dData.fighter,
    attackerDbId: aData.playerId,
    defenderDbId: dData.playerId,
    attackerRating: aData.rating,
    defenderRating: dData.rating,
    round: 1,
    log: [],
    status: "active" as const,
    attackerMove: null,
    defenderMove: null,
    tournamentId: activeTournament.id,
    tournamentMatchId: myMatch.matchId,
  };
  pvpBattles.set(battleId, battle);

  const bk2 = [...bracket];
  const matchIdx = bk2.findIndex(m => m.matchId === myMatch.matchId);
  bk2[matchIdx].battleId = battleId;
  await db.update(tournamentsTable).set({ bracket: bk2, updatedAt: new Date() }).where(eq(tournamentsTable.id, activeTournament.id));

  const aAdv = getElementMultiplier(aData.fighter.element, dData.fighter.element) > 1;
  const dAdv = getElementMultiplier(dData.fighter.element, aData.fighter.element) > 1;

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`🏆 مباراة البطولة — ${activeTournament.name}`)
    .setDescription(`> ⚔️ **${interaction.user.username}** ضد **${opponentName}** في الجولة **${activeTournament.currentRound}**!\n> كلا اللاعبَين، اختارا حركاتكما!`)
    .addFields(
      {
        name: `${ELEMENT_EMOJI[aData.fighter.element] ?? ""}${interaction.user.username} — ${aData.fighter.name}${aAdv ? " ⚡ أفضلية!" : ""}`,
        value: `❤️ **${aData.fighter.maxHp.toLocaleString()}** HP | ⚔️ **${aData.fighter.atk}** ATK | 🌀 ${aData.fighter.skillName}`,
        inline: true,
      },
      {
        name: `${ELEMENT_EMOJI[dData.fighter.element] ?? ""}${opponentName} — ${dData.fighter.name}${dAdv ? " ⚡ أفضلية!" : ""}`,
        value: `❤️ **${dData.fighter.maxHp.toLocaleString()}** HP | ⚔️ **${dData.fighter.atk}** ATK | 🌀 ${dData.fighter.skillName}`,
        inline: true,
      },
      { name: "🏆 الجائزة", value: `الفائز يتقدم للجولة التالية! ${activeTournament.prizePool > 0 ? `| 💰 ${activeTournament.prizePool.toLocaleString()} للبطل` : ""}`, inline: false },
    )
    .setFooter({ text: "⚔️ هجوم | 🌀 مهارة | 🛡️ دفاع | 💥 غضب — البطولة لا ترحم!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [pvpMoveRow(battleId, false, false, aData.fighter.skillName)] });
}

// ── Bets: View Current Match Bets ─────────────────────────────────────────────

export async function actionTournamentBets(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const [t] = await db.select().from(tournamentsTable)
    .where(and(
      eq(tournamentsTable.guildServerId, interaction.guildId),
    ))
    .orderBy(desc(tournamentsTable.createdAt)).limit(1);

  if (!t || (t.status !== "active" && t.status !== "finals")) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle("💰 الرهانات").setDescription("لا توجد بطولة نشطة للرهان عليها.")],
      components: [playerTournamentRow()],
    });
  }

  const bracket = (t.bracket ?? []) as Array<{ round: number; matchId: string; player1: string; player2: string | null; winner: string | null }>;
  const bets = (t.spectatorBets ?? {}) as Record<string, { discordId: string; username: string; betOn: string; amount: number; matchId: string; paid?: boolean }>;
  const participants = await db.select().from(tournamentParticipantsTable).where(eq(tournamentParticipantsTable.tournamentId, t.id));
  const nameMap = Object.fromEntries(participants.map(p => [p.discordId, p.username]));

  const currentMatches = bracket.filter(m => m.round === t.currentRound && !m.winner && m.player2);

  const matchLines = currentMatches.map(m => {
    const p1 = nameMap[m.player1] ?? "لاعب1";
    const p2 = m.player2 ? (nameMap[m.player2] ?? "لاعب2") : "BYE";
    const betsOnP1 = Object.values(bets).filter(b => b.matchId === m.matchId && b.betOn === m.player1 && !b.paid);
    const betsOnP2 = Object.values(bets).filter(b => b.matchId === m.matchId && b.betOn === m.player2 && !b.paid);
    const p1Total = betsOnP1.reduce((sum, b) => sum + b.amount, 0);
    const p2Total = betsOnP2.reduce((sum, b) => sum + b.amount, 0);
    const total = p1Total + p2Total;
    const p1Odds = total > 0 ? (total / Math.max(1, p1Total)).toFixed(1) : "2.0";
    const p2Odds = total > 0 ? (total / Math.max(1, p2Total)).toFixed(1) : "2.0";
    return `**${p1}** (${p1Odds}x) 💰${p1Total.toLocaleString()} ⚔️ **${p2}** (${p2Odds}x) 💰${p2Total.toLocaleString()}\n> \`/tournament bet\` للرهان`;
  });

  const myBets = Object.values(bets).filter(b => b.discordId === interaction.user.id && !b.paid);
  const myBetLines = myBets.map(b => `> **${nameMap[b.betOn] ?? b.betOn}** — 💰 ${b.amount.toLocaleString()} ذهب`);

  const btns: ButtonBuilder[] = currentMatches.slice(0, 3).flatMap(m => {
    const p1 = nameMap[m.player1] ?? "لاعب1";
    const p2 = m.player2 ? (nameMap[m.player2] ?? "لاعب2") : null;
    if (!p2) return [];
    return [
      new ButtonBuilder().setCustomId(`tournament:betOn:${m.matchId}:${m.player1}`).setLabel(`🎯 ${p1.slice(0, 12)}`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`tournament:betOn:${m.matchId}:${m.player2}`).setLabel(`🎯 ${p2.slice(0, 12)}`).setStyle(ButtonStyle.Secondary),
    ];
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`💰 رهانات البطولة — ${t.name}`)
    .setDescription(matchLines.length ? matchLines.join("\n\n") : "لا توجد مباريات معلقة للرهان عليها.")
    .addFields(
      myBetLines.length
        ? { name: "🎯 رهاناتك الحالية", value: myBetLines.join("\n"), inline: false }
        : { name: "💡 كيف تراهن؟", value: "اضغط على اسم اللاعب أدناه، وأدخل مبلغ الرهان.\n🏆 الفائزون يحصلون على **1.8x** من رهانهم!", inline: false },
    )
    .setFooter({ text: `🏆 ${t.name} — الجولة ${t.currentRound}/${t.totalRounds}` })
    .setTimestamp();

  const rows: ActionRowBuilder<ButtonBuilder>[] = [playerTournamentRow()];
  if (btns.length) rows.unshift(new ActionRowBuilder<ButtonBuilder>().addComponents(btns.slice(0, 5)));

  await interaction.editReply({ embeds: [embed], components: rows });
}

// ── Bet: Place Bet Modal ───────────────────────────────────────────────────────

export async function actionTournamentBetOn(interaction: ButtonInteraction, matchId: string, betOnId: string): Promise<void> {
  const modal = new ModalBuilder().setCustomId(`tournament:betmodal:${matchId}:${betOnId}`).setTitle("💰 ضع رهانك");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("amount").setLabel("مبلغ الرهان (ذهب)").setStyle(TextInputStyle.Short).setPlaceholder("1000").setRequired(true).setMinLength(1).setMaxLength(10)
    ),
  );
  await interaction.showModal(modal);
}

export async function handleTournamentBetModalSubmit(interaction: ModalSubmitInteraction, matchId: string, betOnId: string): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")] });

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, interaction.user.id));
  if (!player) return void interaction.editReply({ embeds: [errorEmbed("استخدم `/start` أولاً!")] });

  const amountRaw = interaction.fields.getTextInputValue("amount").trim();
  const amount = parseInt(amountRaw, 10);
  if (isNaN(amount) || amount < 100) return void interaction.editReply({ embeds: [errorEmbed("الحد الأدنى للرهان 100 ذهب.")] });
  if (amount > player.gold) return void interaction.editReply({ embeds: [errorEmbed(`ليس لديك ذهب كافٍ! لديك **${player.gold.toLocaleString()}** ذهب.`)] });

  const [t] = await db.select().from(tournamentsTable)
    .where(eq(tournamentsTable.guildServerId, interaction.guildId))
    .orderBy(desc(tournamentsTable.createdAt)).limit(1);
  if (!t || (t.status !== "active" && t.status !== "finals")) return void interaction.editReply({ embeds: [errorEmbed("لا توجد بطولة نشطة.")] });

  const bets = (t.spectatorBets ?? {}) as Record<string, { discordId: string; username: string; betOn: string; amount: number; matchId: string; round: number; paid?: boolean }>;
  const existing = Object.values(bets).find(b => b.discordId === interaction.user.id && b.matchId === matchId && !b.paid);
  if (existing) return void interaction.editReply({ embeds: [errorEmbed("لقد راهنت بالفعل على هذه المباراة!")] });

  const betKey = `${interaction.user.id}_${matchId}_${Date.now()}`;
  bets[betKey] = {
    discordId: interaction.user.id,
    username: interaction.user.username,
    betOn: betOnId,
    amount,
    matchId,
    round: t.currentRound,
    paid: false,
  };

  const participants = await db.select().from(tournamentParticipantsTable).where(eq(tournamentParticipantsTable.tournamentId, t.id));
  const betOnName = participants.find(p => p.discordId === betOnId)?.username ?? betOnId.slice(0, 8);

  await Promise.all([
    db.update(tournamentsTable).set({ spectatorBets: bets, updatedAt: new Date() }).where(eq(tournamentsTable.id, t.id)),
    db.update(playersTable).set({ gold: player.gold - amount, updatedAt: new Date() }).where(eq(playersTable.id, player.id)),
  ]);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle("💰 تم وضع الرهان!")
      .setDescription(`> راهنت على **${betOnName}** بـ **${amount.toLocaleString()}** ذهب!\n> إذا فاز، ستحصل على **${Math.floor(amount * 1.8).toLocaleString()}** ذهب 🏆`)
      .addFields(
        { name: "💰 رصيدك الجديد", value: `${(player.gold - amount).toLocaleString()} ذهب`, inline: true },
        { name: "🎯 راهنت على", value: betOnName, inline: true },
      )
      .setFooter({ text: "حظاً موفقاً! الفائزون يحصلون على 1.8x 🏆" })],
  });
}

// ── Season Stats ──────────────────────────────────────────────────────────────

export async function actionTournamentSeasonStats(interaction: AnyInteraction): Promise<void> {
  await prepare(interaction);
  if (!interaction.guildId) return void interaction.editReply({ embeds: [errorEmbed("هذا الأمر للسيرفرات فقط.")], components: [] });

  const completed = await db.select().from(tournamentsTable)
    .where(and(eq(tournamentsTable.guildServerId, interaction.guildId), eq(tournamentsTable.status, "completed")))
    .orderBy(desc(tournamentsTable.createdAt)).limit(20);

  if (!completed.length) {
    return void interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.gold).setTitle("🏆 موسم البطولات").setDescription("لم تنته أي بطولة بعد في هذا السيرفر!")],
      components: [playerTournamentRow()],
    });
  }

  const winCount: Record<string, { username: string; wins: number; gold: number; gems: number }> = {};
  for (const t of completed) {
    if (t.winnerId && t.winnerUsername) {
      if (!winCount[t.winnerId]) winCount[t.winnerId] = { username: t.winnerUsername, wins: 0, gold: 0, gems: 0 };
      winCount[t.winnerId].wins++;
      const prizes = (t.prizes as Array<{ rank: number; gold: number; gems: number }>) ?? [];
      const first = prizes.find(p => p.rank === 1);
      winCount[t.winnerId].gold += first?.gold ?? 0;
      winCount[t.winnerId].gems += first?.gems ?? 0;
    }
  }

  const leaderboard = Object.values(winCount).sort((a, b) => b.wins - a.wins).slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];

  const lines = leaderboard.map((entry, i) => {
    const medal = medals[i] ?? `**${i + 1}.**`;
    return `${medal} **${entry.username}** — 🏆 ${entry.wins} انتصار | 💰 ${entry.gold.toLocaleString()} | 💎 ${entry.gems}`;
  });

  const recent = completed.slice(0, 5).map(t => `> **${t.name}** — 🥇 ${t.winnerUsername ?? "—"}`);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle("🏆 موسم البطولات — أبطال السيرفر")
      .setDescription(lines.join("\n") || "لا إحصائيات بعد.")
      .addFields({ name: "📜 آخر البطولات", value: recent.join("\n"), inline: false })
      .setFooter({ text: `${completed.length} بطولة منتهية • أنيمي ملتيفرس أرينا` })
      .setTimestamp()],
    components: [playerTournamentRow()],
  });
}

// ── Modal Submit ──────────────────────────────────────────────────────────────

export async function handleTournamentModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const admin = await isAdmin(interaction as unknown as ChatInputCommandInteraction);
  if (!admin) return void interaction.reply({ embeds: [errorEmbed("للمشرفين فقط.")], ephemeral: true });
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.fields.getTextInputValue("name").trim();
  const sizeRaw = interaction.fields.getTextInputValue("size").trim();
  const prizeRaw = interaction.fields.getTextInputValue("prize_pool").trim();
  const prizesRaw = interaction.fields.getTextInputValue("prizes").trim();

  const size = parseInt(sizeRaw, 10);
  if (![4, 8, 16, 32].includes(size)) {
    return void interaction.editReply({ embeds: [errorEmbed("حجم البطولة يجب أن يكون: 4 أو 8 أو 16 أو 32.")] });
  }

  const prizePool = prizeRaw ? (parseInt(prizeRaw, 10) || 0) : 0;
  const gemParts = prizesRaw ? prizesRaw.split("|").map(p => parseInt(p.trim(), 10) || 0) : [0, 0, 0];

  const prizes = [
    { rank: 1, gold: prizePool, gems: gemParts[0] ?? 0, title: "بطل البطولة 👑" },
    { rank: 2, gold: Math.floor(prizePool * 0.5), gems: gemParts[1] ?? 0, title: "الوصيف 🥈" },
    { rank: 3, gold: Math.floor(prizePool * 0.25), gems: gemParts[2] ?? 0, title: "المركز الثالث 🥉" },
  ];
  const totalRounds = Math.ceil(Math.log2(size));

  await db.insert(tournamentsTable).values({
    name,
    guildServerId: interaction.guildId!,
    channelId: interaction.channelId!,
    organizerDiscordId: interaction.user.id,
    size,
    totalRounds,
    prizePool,
    prizes,
    status: "registration",
  });

  const prizeLines = prizes.map(p => {
    const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉";
    const parts: string[] = [];
    if (p.gold > 0) parts.push(`${p.gold.toLocaleString()} 💰`);
    if (p.gems > 0) parts.push(`${p.gems} 💎`);
    return `${medal} **${p.title}**: ${parts.join(" + ") || "—"}`;
  });

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle("🏆 تم إنشاء البطولة!")
      .setDescription(`> **${name}** جاهزة! اللاعبون يمكنهم التسجيل بـ \`/tournament join\``)
      .addFields(
        { name: "👥 الحد الأقصى", value: `${size} لاعب`, inline: true },
        { name: "🔄 الجولات", value: `${totalRounds} جولة`, inline: true },
        { name: "🎁 الجوائز", value: prizeLines.join("\n"), inline: false },
      )
      .setFooter({ text: "اضغط ▶️ ابدأ لانطلاق البطولة! • أنيمي ملتيفرس أرينا" })],
  });
}
