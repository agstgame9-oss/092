import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { db, playersTable, playerCharactersTable, charactersTable } from "../../lib/db.js";
import { eq, and, inArray, ne } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, errorEmbed } from "../../lib/embeds.js";
import { rollRarity } from "../../lib/gameEngine.js";

const RARITY_ORDER = ["D", "C", "B", "A", "S", "SS", "SSS", "SSS+"] as const;
type Rarity = typeof RARITY_ORDER[number];

function nextRarity(r: Rarity): Rarity | null {
  const idx = RARITY_ORDER.indexOf(r);
  return idx >= 0 && idx < RARITY_ORDER.length - 1 ? RARITY_ORDER[idx + 1] : null;
}

const FUSION_COST = 3;

export const data = new SlashCommandBuilder()
  .setName("fuse")
  .setDescription("🧬 اندماج الشخصيات — دمج 3 شخصيات لإنتاج شخصية أعلى رتبة")
  .addSubcommand((s) => s.setName("info").setDescription("معلومات عن الاندماج"))
  .addSubcommand((s) => s.setName("perform")
    .setDescription("اندمج شخصيات برتبة معينة")
    .addStringOption((o) => o.setName("rarity")
      .setDescription("رتبة الشخصيات المراد دمجها")
      .setRequired(true)
      .addChoices(
        { name: "D رتبة", value: "D" },
        { name: "C رتبة", value: "C" },
        { name: "B رتبة", value: "B" },
        { name: "A رتبة", value: "A" },
        { name: "S رتبة", value: "S" },
        { name: "SS رتبة", value: "SS" },
        { name: "SSS رتبة", value: "SSS" },
      )
    )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const discordId = interaction.user.id;

  if (sub === "info") {
    const lines = RARITY_ORDER.slice(0, -1).map((r) => {
      const next = nextRarity(r as Rarity);
      return `${RARITY_EMOJI[r] ?? r} **×3 ${r}** → ${RARITY_EMOJI[next!] ?? next} **1× ${next}**`;
    });
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle("🧬 نظام الاندماج")
        .setDescription("ادمج **3 شخصيات من نفس الرتبة** للحصول على **شخصية واحدة من الرتبة الأعلى**!")
        .addFields({ name: "جداول التحويل", value: lines.join("\n"), inline: false })
        .setFooter({ text: "تأكد أن الشخصيات غير مقفلة وليست في الفريق النشط!" })
        .setTimestamp()],
    });
  }

  if (sub === "perform") {
    const rarity = interaction.options.getString("rarity", true) as Rarity;
    const next = nextRarity(rarity);
    if (!next) {
      return interaction.editReply({ embeds: [errorEmbed("لا يمكن دمج شخصيات SSS+!")] });
    }

    const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
    if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });

    const available = await db.select({ pc: playerCharactersTable, c: charactersTable })
      .from(playerCharactersTable)
      .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
      .where(and(
        eq(playerCharactersTable.playerId, player.id),
        eq(charactersTable.rarity, rarity as any),
        eq(playerCharactersTable.isLocked, false),
        eq(playerCharactersTable.isOnParty, false),
      ));

    if (available.length < FUSION_COST) {
      return interaction.editReply({
        embeds: [errorEmbed(`تحتاج **${FUSION_COST}** شخصيات من رتبة **${rarity}** غير مقفلة وغير في الفريق.\nلديك: ${available.length}`)] ,
      });
    }

    const toFuse = available.slice(0, FUSION_COST);
    const fuseIds = toFuse.map((x) => x.pc.id);

    await db.delete(playerCharactersTable).where(inArray(playerCharactersTable.id, fuseIds));

    const allNextRarity = await db.select().from(charactersTable)
      .where(eq(charactersTable.rarity, next as any));

    if (!allNextRarity.length) {
      await db.insert(playerCharactersTable).values({
        playerId: player.id,
        characterId: toFuse[0].c.id,
        level: 1,
        ascension: 0,
        copies: 1,
      });
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle("⚠️ اندماج جزئي")
          .setDescription(`لا توجد شخصيات من رتبة ${next} في القاعدة! تم إعادة شخصية واحدة من نفس الرتبة.`)],
      });
    }

    const randomChar = allNextRarity[Math.floor(Math.random() * allNextRarity.length)];
    await db.insert(playerCharactersTable).values({
      playerId: player.id,
      characterId: randomChar.id,
      level: 1,
      ascension: 0,
      copies: 1,
    });

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle("🧬 اندماج ناجح!")
      .setDescription([
        `دمجت **3×** ${RARITY_EMOJI[rarity] ?? rarity} **${rarity}** وحصلت على:`,
        `## ${RARITY_EMOJI[next] ?? ""} **${randomChar.name}** *(${next})*`,
      ].join("\n"))
      .addFields(
        { name: "الشخصيات المدمجة", value: toFuse.map((x) => x.c.name).join(", "), inline: false },
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
}
