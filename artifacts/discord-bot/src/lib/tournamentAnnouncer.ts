import {
  Client, TextChannel, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import type { Tournament, TournamentParticipant } from "@workspace/db";
import { COLORS } from "./embeds.js";

type Match = {
  round: number;
  matchId: string;
  player1: string;
  player2: string | null;
  winner: string | null;
  battleId: string | null;
};

type Prize = { rank: number; gold: number; gems: number; title?: string };

function buildProgressBar(current: number, max: number): string {
  const pct = Math.min(1, current / max);
  const filled = Math.round(pct * 12);
  const empty = 12 - filled;
  return `${"🟩".repeat(filled)}${"⬛".repeat(empty)} **${current}/${max}**`;
}

function buildPrizeLines(prizes: Prize[]): string {
  if (!prizes.length) return "بدون جوائز";
  return prizes.map(p => {
    const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`;
    const parts: string[] = [];
    if (p.gold > 0) parts.push(`${p.gold.toLocaleString()} 💰`);
    if (p.gems > 0) parts.push(`${p.gems} 💎`);
    const title = p.title ? ` *(${p.title})*` : "";
    return `${medal} ${parts.join(" + ") || "—"}${title}`;
  }).join("\n");
}

function renderRoundBracket(bracket: Match[], participants: TournamentParticipant[], round: number): string {
  const userMap = Object.fromEntries(participants.map(p => [p.discordId, p.username]));
  const matches = bracket.filter(m => m.round === round);
  if (!matches.length) return "لا مباريات في هذه الجولة.";
  return matches.map(m => {
    const p1 = userMap[m.player1] ?? "لاعب";
    const p2 = m.player2 ? (userMap[m.player2] ?? "لاعب") : null;
    if (!p2) return `> 🎯 **${p1}** — يتقدم تلقائياً (BYE)`;
    if (m.winner) {
      const w = userMap[m.winner] ?? m.winner;
      const l = m.winner === m.player1 ? p2 : p1;
      return `> 🏆 **${w}** فاز على ~~${l}~~`;
    }
    return `> ⚔️ **${p1}** 🆚 **${p2}**`;
  }).join("\n");
}

async function getChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  try {
    const ch = client.channels.cache.get(channelId) ?? await client.channels.fetch(channelId);
    if (ch && ch.isTextBased() && "send" in ch) return ch as TextChannel;
  } catch { /* ignore */ }
  return null;
}

// ── 1. Registration Open ──────────────────────────────────────────────────────

export async function announceRegistrationOpen(
  client: Client,
  tournament: Tournament,
  currentCount: number,
): Promise<void> {
  const ch = await getChannel(client, tournament.channelId);
  if (!ch) return;

  const prizes = (tournament.prizes ?? []) as Prize[];
  const progressBar = buildProgressBar(currentCount, tournament.size);
  const totalRounds = Math.ceil(Math.log2(tournament.size));

  const embed = new EmbedBuilder()
    .setColor(0xF59E0B)
    .setTitle("🏆 ══ بطولة جديدة مفتوحة للتسجيل! ══ 🏆")
    .setDescription(
      `> 📣 **${tournament.name}** تفتح أبوابها!\n` +
      `> سجّل الآن واثبت أنك الأفضل في أنيمي ملتيفرس أرينا!\n\n` +
      `${progressBar}`
    )
    .addFields(
      { name: "👥 الحد الأقصى", value: `**${tournament.size}** لاعب`, inline: true },
      { name: "🔄 عدد الجولات", value: `**${totalRounds}** جولات`, inline: true },
      { name: "💰 الجائزة الكبرى", value: tournament.prizePool > 0 ? `${tournament.prizePool.toLocaleString()} 💰` : "شرف الفوز 🏆", inline: true },
      { name: "🎁 جدول الجوائز", value: buildPrizeLines(prizes), inline: false },
      { name: "📋 كيف تسجّل؟", value: "استخدم `/tournament join` أو اضغط الزر أدناه!", inline: false },
    )
    .setImage("https://i.imgur.com/tournament-banner.png")
    .setFooter({ text: "⚔️ أنيمي ملتيفرس أرينا • نظام البطولات" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`tournament:join:${tournament.id}`).setLabel("✅ سجّل الآن!").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("tournament:view").setLabel("🏆 تفاصيل البطولة").setStyle(ButtonStyle.Primary),
  );

  await ch.send({ content: "@everyone 🏆 **بطولة جديدة بدأ التسجيل فيها!**", embeds: [embed], components: [row] });
}

// ── 2. New Participant Joined ─────────────────────────────────────────────────

export async function announceParticipantJoined(
  client: Client,
  tournament: Tournament,
  username: string,
  currentCount: number,
): Promise<void> {
  const ch = await getChannel(client, tournament.channelId);
  if (!ch) return;

  const remaining = tournament.size - currentCount;
  const progressBar = buildProgressBar(currentCount, tournament.size);
  const isFull = remaining === 0;

  const embed = new EmbedBuilder()
    .setColor(isFull ? 0xEF4444 : 0x10B981)
    .setTitle(isFull ? "🔥 اكتملت المقاعد!" : "✅ مشارك جديد انضم!")
    .setDescription(
      `> 🎮 **${username}** انضم إلى **${tournament.name}**!\n` +
      `> ${progressBar}\n\n` +
      (isFull
        ? "> ⚠️ **المقاعد اكتملت!** ينتظر المشرف لبدء البطولة."
        : `> 🎯 تبقّت **${remaining}** مقعد — لا تفوّت فرصتك!`)
    )
    .setFooter({ text: "أنيمي ملتيفرس أرينا • البطولات" })
    .setTimestamp();

  await ch.send({ embeds: [embed] });
}

// ── 3. Tournament Kickoff ─────────────────────────────────────────────────────

export async function announceTournamentStarted(
  client: Client,
  tournament: Tournament,
  participants: TournamentParticipant[],
  bracket: Match[],
): Promise<void> {
  const ch = await getChannel(client, tournament.channelId);
  if (!ch) return;

  const bracketText = renderRoundBracket(bracket, participants, 1);
  const mentions = participants.map(p => `<@${p.discordId}>`).join(" ");
  const prizes = (tournament.prizes ?? []) as Prize[];

  const embed = new EmbedBuilder()
    .setColor(0xFF4500)
    .setTitle("⚔️ ══ البطولة انطلقت! ══ ⚔️")
    .setDescription(
      "```\n" +
      "  ████████╗ ██████╗ ██╗   ██╗██████╗ ███╗  ██╗ █████╗ ███╗   ███╗███████╗██╗  ██╗████████╗\n" +
      "  ╚══██╔══╝██╔═══██╗██║   ██║██╔══██╗████╗ ██║██╔══██╗████╗ ████║██╔════╝████╗ ██║╚══██╔══╝\n" +
      "     ██║   ██║   ██║██║   ██║██████╔╝██╔██╗██║███████║██╔████╔██║█████╗  ██╔██╗██║   ██║   \n" +
      "     ██║   ██║   ██║██║   ██║██╔══██╗██║╚████║██╔══██║██║╚██╔╝██║██╔══╝  ██║╚████║   ██║   \n" +
      "     ██║   ╚██████╔╝╚██████╔╝██║  ██║██║ ╚███║██║  ██║██║ ╚═╝ ██║███████╗██║ ╚███║   ██║   \n" +
      "     ╚═╝    ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚══╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚══╝   ╚═╝   \n" +
      "```"
    )
    .addFields(
      { name: `🏆 ${tournament.name}`, value: `**${participants.length}** مقاتل | **${tournament.totalRounds}** جولات`, inline: false },
      { name: "⚔️ مباريات الجولة الأولى", value: bracketText, inline: false },
      { name: "🎁 الجوائز", value: buildPrizeLines(prizes), inline: false },
      { name: "📢 للمشاركين", value: "استخدم `/tournament fight` لبدء مباراتك في أسرع وقت!\n⚠️ المشارك الذي لا يقاتل يخسر تلقائياً عند تقدم المشرف للجولة التالية.", inline: false },
    )
    .setFooter({ text: `⚔️ الجولة 1 من ${tournament.totalRounds} • أنيمي ملتيفرس أرينا` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("tournament:fight").setLabel("⚔️ قاتل الآن!").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("tournament:bracket").setLabel("📊 البراكيت").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tournament:bets").setLabel("💰 الرهانات").setStyle(ButtonStyle.Secondary),
  );

  await ch.send({
    content: `${mentions}\n🔥 **البطولة بدأت! كل المشاركين — استعدوا للقتال!**`,
    embeds: [embed],
    components: [row],
    allowedMentions: { parse: ["users"] },
  });
}

// ── 4. Match Result ───────────────────────────────────────────────────────────

export async function announceMatchResult(
  client: Client,
  channelId: string,
  tournamentName: string,
  round: number,
  totalRounds: number,
  winnerName: string,
  winnerId: string,
  loserName: string,
  isFinal: boolean,
): Promise<void> {
  const ch = await getChannel(client, channelId);
  if (!ch) return;

  const isLastRound = round >= totalRounds;
  const color = isLastRound ? 0xF59E0B : isFinal ? 0xEC4899 : 0xFF4500;
  const title = isLastRound
    ? "👑 مباراة النهائي انتهت!"
    : isFinal
    ? "🏆 نصف النهائي انتهى!"
    : `⚔️ نتيجة مباراة الجولة ${round}`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `> 🏆 **<@${winnerId}>** *(${winnerName})* فاز على **${loserName}**!\n` +
      `> ${isLastRound ? "🎉 البطولة على وشك الانتهاء!" : `الجولة **${round}** من **${totalRounds}**`}`
    )
    .addFields(
      { name: "✅ المتأهل", value: `**${winnerName}** <@${winnerId}>`, inline: true },
      { name: "❌ المُقصى", value: `~~${loserName}~~`, inline: true },
    )
    .setFooter({ text: `${tournamentName} • أنيمي ملتيفرس أرينا` })
    .setTimestamp();

  await ch.send({ embeds: [embed], allowedMentions: { parse: ["users"] } });
}

// ── 5. Round Complete + New Round Started ─────────────────────────────────────

export async function announceNewRound(
  client: Client,
  tournament: Tournament,
  participants: TournamentParticipant[],
  bracket: Match[],
  newRound: number,
): Promise<void> {
  const ch = await getChannel(client, tournament.channelId);
  if (!ch) return;

  const isFinals = newRound === tournament.totalRounds;
  const color = isFinals ? 0xF59E0B : 0x8B5CF6;
  const title = isFinals
    ? "🏆 ══ النهائي الكبير قادم! ══ 🏆"
    : `⚡ ══ الجولة ${newRound} بدأت! ══ ⚡`;

  const roundBracket = renderRoundBracket(bracket, participants, newRound);
  const prevBracket = renderRoundBracket(bracket, participants, newRound - 1);

  const advancedIds = bracket
    .filter(m => m.round === newRound)
    .flatMap(m => [m.player1, m.player2].filter(Boolean) as string[]);
  const mentions = advancedIds.map(id => `<@${id}>`).join(" ");

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      isFinals
        ? "> 🔥 بطلان فقط تبقّيا! من سيحمل لقب **أنيمي ملتيفرس أرينا**؟!"
        : `> ⚔️ الجولة **${newRound - 1}** انتهت! المتأهلون معروفون — الآن المعركة تشتعل أكثر!`
    )
    .addFields(
      { name: `📜 نتائج الجولة ${newRound - 1}`, value: prevBracket, inline: false },
      {
        name: isFinals ? "🏆 مباراة النهائي الكبير!" : `⚔️ مباريات الجولة ${newRound}`,
        value: roundBracket,
        inline: false,
      },
      {
        name: "💡 للمشاركين المتأهلين",
        value: "استخدم `/tournament fight` لبدء مباراتك الآن!\n⏰ لا تتأخر — الوقت يُحدد مصيرك!",
        inline: false,
      },
    )
    .setFooter({ text: `الجولة ${newRound} من ${tournament.totalRounds} • ${tournament.name}` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("tournament:fight").setLabel("⚔️ قاتل الآن!").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("tournament:bracket").setLabel("📊 البراكيت").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tournament:bets").setLabel("💰 الرهانات").setStyle(ButtonStyle.Secondary),
  );

  await ch.send({
    content: `${mentions}\n${isFinals ? "👑 **المتأهلون للنهائي — استعدوا للمعركة الفاصلة!**" : `⚡ **الجولة ${newRound} بدأت — قاتلوا!**`}`,
    embeds: [embed],
    components: [row],
    allowedMentions: { parse: ["users"] },
  });
}

// ── 6. Champion Crowned 👑 ────────────────────────────────────────────────────

export async function announceChampion(
  client: Client,
  tournament: Tournament,
  champion: TournamentParticipant,
  runnerUp: TournamentParticipant | null,
  bracket: Match[],
  allParticipants: TournamentParticipant[],
): Promise<void> {
  const ch = await getChannel(client, tournament.channelId);
  if (!ch) return;

  const prizes = (tournament.prizes ?? []) as Prize[];
  const firstPrize = prizes.find(p => p.rank === 1);
  const secondPrize = prizes.find(p => p.rank === 2);

  const fullBracket = (() => {
    const rounds: Record<number, Match[]> = {};
    for (const m of bracket) {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    }
    const nameMap = Object.fromEntries(allParticipants.map(p => [p.discordId, p.username]));
    return Object.entries(rounds).map(([r, ms]) => {
      const rn = parseInt(r);
      const remaining = tournament.totalRounds - rn;
      const roundName = remaining === 0 ? "🏆 النهائي" : remaining === 1 ? "🥊 نصف النهائي" : `⚡ الجولة ${r}`;
      const lines = ms.map(m => {
        const p1 = nameMap[m.player1] ?? "؟";
        const p2 = m.player2 ? (nameMap[m.player2] ?? "؟") : "BYE";
        if (!m.winner) return `> ${p1} 🆚 ${p2}`;
        const w = nameMap[m.winner] ?? "؟";
        const l = m.winner === m.player1 ? p2 : p1;
        return `> 🏆 **${w}** فاز على ~~${l}~~`;
      }).join("\n");
      return `**${roundName}**\n${lines}`;
    }).join("\n\n");
  })();

  const championPrizeText = [
    firstPrize?.gold ? `${firstPrize.gold.toLocaleString()} 💰` : null,
    firstPrize?.gems ? `${firstPrize.gems} 💎` : null,
    firstPrize?.title ? `🎖️ لقب: ${firstPrize.title}` : null,
  ].filter(Boolean).join("\n") || "شرف الفوز 🏆";

  const embed = new EmbedBuilder()
    .setColor(0xF59E0B)
    .setTitle("👑 ══════ بطل البطولة تُوِّج! ══════ 👑")
    .setDescription(
      "```\n" +
      "  ██████╗  ██╗  ██╗  █████╗  ███╗   ███╗ ██████╗  ██╗  ██████╗  ███╗  ██╗ ██╗\n" +
      "  ██╔════╝ ██║  ██║ ██╔══██╗ ████╗ ████║ ██╔══██╗ ██║ ██╔═══██╗ ████╗ ██║ ██║\n" +
      "  ██║      ███████║ ███████║ ██╔████╔██║ ██████╔╝ ██║ ██║   ██║ ██╔██╗██║ ██║\n" +
      "  ██║      ██╔══██║ ██╔══██║ ██║╚██╔╝██║ ██╔═══╝  ██║ ██║   ██║ ██║╚████║ ╚═╝\n" +
      "  ╚██████╗ ██║  ██║ ██║  ██║ ██║ ╚═╝ ██║ ██║      ██║ ╚██████╔╝ ██║ ╚███║ ██╗\n" +
      "   ╚═════╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝     ╚═╝ ╚═╝      ╚═╝  ╚═════╝  ╚═╝  ╚══╝ ╚═╝\n" +
      "```\n" +
      `🎉🎉🎉 **<@${champion.discordId}>** هو **بطل ${tournament.name}**! 🎉🎉🎉`
    )
    .addFields(
      { name: "👑 البطل الأبطال", value: `<@${champion.discordId}> — **${champion.username}**`, inline: true },
      { name: "🥈 الوصيف", value: runnerUp ? `<@${runnerUp.discordId}> — **${runnerUp.username}**` : "—", inline: true },
      { name: "🏅 جوائز البطل", value: championPrizeText, inline: false },
      secondPrize && runnerUp
        ? {
          name: "🥈 جوائز الوصيف",
          value: [
            secondPrize.gold ? `${secondPrize.gold.toLocaleString()} 💰` : null,
            secondPrize.gems ? `${secondPrize.gems} 💎` : null,
          ].filter(Boolean).join("\n") || "—",
          inline: false,
        }
        : { name: "\u200B", value: "\u200B", inline: false },
      { name: `📜 ملخص البطولة (${allParticipants.length} مشارك)`, value: fullBracket.slice(0, 1000), inline: false },
    )
    .setFooter({ text: `🏆 ${tournament.name} انتهت رسمياً • أنيمي ملتيفرس أرينا` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("tournament:season").setLabel("🏅 بطولات الموسم").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tournament:view").setLabel("🏆 بطولات السيرفر").setStyle(ButtonStyle.Secondary),
  );

  await ch.send({
    content:
      `@everyone\n` +
      `🥇🥇🥇 **تهانينا لبطل البطولة <@${champion.discordId}>** 🥇🥇🥇\n` +
      `🎆🎇✨ **${tournament.name}** انتهت بأروع المعارك! ✨🎇🎆`,
    embeds: [embed],
    components: [row],
    allowedMentions: { parse: ["users"] },
  });
}

// ── 7. Tournament Cancelled ───────────────────────────────────────────────────

export async function announceTournamentCancelled(
  client: Client,
  tournament: Tournament,
  adminName: string,
): Promise<void> {
  const ch = await getChannel(client, tournament.channelId);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle("❌ البطولة أُلغيت")
    .setDescription(`> بطولة **${tournament.name}** أُلغيت بواسطة **${adminName}**.\n> سيتم استرداد أي رهانات معلقة.`)
    .setFooter({ text: "أنيمي ملتيفرس أرينا • البطولات" })
    .setTimestamp();

  await ch.send({ embeds: [embed] });
}
