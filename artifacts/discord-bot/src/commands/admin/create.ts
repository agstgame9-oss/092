import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { isAdmin } from "../../lib/adminActions.js";
import { errorEmbed } from "../../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("create")
  .setDescription("إنشاء محتوى اللعبة (شخصيات، زعماء، عناصر)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand(sub =>
    sub.setName("character").setDescription("إنشاء شخصية قابلة للعب")
  )
  .addSubcommand(sub =>
    sub.setName("boss").setDescription("إنشاء زعيم أو وحش جديد")
  )
  .addSubcommand(sub =>
    sub.setName("item").setDescription("إنشاء عنصر جديد")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const admin = await isAdmin(interaction);
  if (!admin) {
    return interaction.reply({ embeds: [errorEmbed("تحتاج إلى صلاحيات المسؤول أو رتبة الأدمن لإنشاء المحتوى.")], ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "character") {
    const modal = new ModalBuilder()
      .setCustomId("admin:modal:create_char")
      .setTitle("✨ إنشاء شخصية جديدة");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("اسم الشخصية").setStyle(TextInputStyle.Short).setPlaceholder("مثال: Naruto Uzumaki").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("anime_source").setLabel("الأنمي / المصدر").setStyle(TextInputStyle.Short).setPlaceholder("مثال: Naruto Shippuden").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("rarity").setLabel("الندرة  (D / C / B / A / S / SS / SSS / SSS+)").setStyle(TextInputStyle.Short).setPlaceholder("S").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("element1").setLabel("العنصر 1  (Fire / Water / Wind / الخ)").setStyle(TextInputStyle.Short).setPlaceholder("Fire").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("element2").setLabel("العنصر 2  (اختياري — اتركه فارغاً إن لم يوجد)").setStyle(TextInputStyle.Short).setPlaceholder("Wind").setRequired(false)
      ),
    );

    return interaction.showModal(modal);
  }

  if (sub === "boss") {
    const modal = new ModalBuilder()
      .setCustomId("admin:modal:create_boss")
      .setTitle("👹 إنشاء زعيم جديد");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name_title").setLabel("الاسم | اللقب  (مفصولان بـ |)").setStyle(TextInputStyle.Short).setPlaceholder("Kaguya | أصل الشاكرا").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("anime_source_tier").setLabel("الأنمي | المستوى  (normal/elite/world/abyss)").setStyle(TextInputStyle.Short).setPlaceholder("Naruto | world").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("elements").setLabel("العنصر1 | العنصر2  (الثاني اختياري)").setStyle(TextInputStyle.Short).setPlaceholder("Space | Time").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("stats").setLabel("HP  ATK  DEF  SPD  (مفصولة بمسافات)").setStyle(TextInputStyle.Short).setPlaceholder("500000 3500 2000 300").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("weaknesses").setLabel("نقاط الضعف  (مفصولة بفواصل، اختياري)").setStyle(TextInputStyle.Short).setPlaceholder("Lightning, Order").setRequired(false)
      ),
    );

    return interaction.showModal(modal);
  }

  if (sub === "item") {
    const modal = new ModalBuilder()
      .setCustomId("admin:modal:create_item")
      .setTitle("🎒 إنشاء عنصر جديد");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("اسم العنصر").setStyle(TextInputStyle.Short).setPlaceholder("قشرة التنين النادرة").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("description").setLabel("الوصف").setStyle(TextInputStyle.Paragraph).setPlaceholder("قشرة نادرة من تنين قديم...").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("type_rarity").setLabel("النوع | الندرة  (مثال: material | S)").setStyle(TextInputStyle.Short).setPlaceholder("material | S").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("base_value").setLabel("قيمة الذهب الأساسية").setStyle(TextInputStyle.Short).setPlaceholder("1500").setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("effects").setLabel("التأثيرات  (اختياري — مثال: stamina_restore:50)").setStyle(TextInputStyle.Short).setPlaceholder("stamina_restore:50").setRequired(false)
      ),
    );

    return interaction.showModal(modal);
  }
}
