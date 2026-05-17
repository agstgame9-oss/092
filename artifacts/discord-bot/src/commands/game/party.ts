import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db, playersTable, playerCharactersTable, charactersTable } from "../../lib/db.js";
import { eq } from "drizzle-orm";
import { COLORS, RARITY_EMOJI, ELEMENT_EMOJI, errorEmbed, successEmbed } from "../../lib/embeds.js";
import { actionPartyView } from "../../lib/actions.js";
import { partyRow } from "../../lib/buttons.js";

export const data = new SlashCommandBuilder()
  .setName("party")
  .setDescription("أدِر فريقك في المعارك")
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("اعرض فريقك الحالي")
  )
  .addSubcommand((sub) =>
    sub.setName("set")
      .setDescription("أضف شخصية إلى الفريق (حسب ترتيبها في القائمة)")
      .addIntegerOption((o) => o.setName("slot").setDescription("رقم الشخصية من قائمة /characters").setRequired(true).setMinValue(1).setMaxValue(30))
  )
  .addSubcommand((sub) =>
    sub.setName("remove")
      .setDescription("أزل شخصية من فريقك")
      .addIntegerOption((o) => o.setName("slot").setDescription("رقم الشخصية من قائمة /characters").setRequired(true).setMinValue(1).setMaxValue(30))
  )
  .addSubcommand((sub) =>
    sub.setName("clear").setDescription("فرّغ فريقك بالكامل")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "view") {
    return actionPartyView(interaction);
  }

  await interaction.deferReply();
  const discordId = interaction.user.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return interaction.editReply({ embeds: [errorEmbed("لم تبدأ بعد! استخدم `/start` أولاً.")] });

  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  const rarityOrder = ["SSS+", "SSS", "SS", "S", "A", "B", "C", "D"];
  chars.sort((a, b) => rarityOrder.indexOf(a.char.rarity) - rarityOrder.indexOf(b.char.rarity));

  if (sub === "clear") {
    await db.update(playerCharactersTable).set({ isOnParty: false }).where(eq(playerCharactersTable.playerId, player.id));
    return interaction.editReply({ embeds: [successEmbed("تم تفريغ الفريق!")], components: [partyRow()] });
  }

  const slot = interaction.options.getInteger("slot", true);
  const target = chars[slot - 1];
  if (!target) {
    return interaction.editReply({ embeds: [errorEmbed(`رقم غير صالح! لديك ${chars.length} شخصية. استخدم \`/characters\` لعرضها.`)], components: [partyRow()] });
  }

  if (sub === "set") {
    const partyCount = chars.filter(c => c.pc.isOnParty).length;
    if (target.pc.isOnParty) {
      return interaction.editReply({ embeds: [errorEmbed(`**${target.char.name}** موجود بالفعل في فريقك!`)], components: [partyRow()] });
    }
    if (partyCount >= 3) {
      return interaction.editReply({ embeds: [errorEmbed("فريقك ممتلئ! (الحد الأقصى 3)\nاستخدم `/party remove <رقم>` لإفساح المجال.")], components: [partyRow()] });
    }
    await db.update(playerCharactersTable).set({ isOnParty: true }).where(eq(playerCharactersTable.id, target.pc.id));
    return interaction.editReply({
      embeds: [successEmbed(`تمت إضافة **${target.char.name}** إلى فريقك! (${partyCount + 1}/3)`)],
      components: [partyRow()],
    });
  }

  if (sub === "remove") {
    if (!target.pc.isOnParty) {
      return interaction.editReply({ embeds: [errorEmbed(`**${target.char.name}** ليس في فريقك.`)], components: [partyRow()] });
    }
    await db.update(playerCharactersTable).set({ isOnParty: false }).where(eq(playerCharactersTable.id, target.pc.id));
    return interaction.editReply({
      embeds: [successEmbed(`تمت إزالة **${target.char.name}** من فريقك.`)],
      components: [partyRow()],
    });
  }
}
