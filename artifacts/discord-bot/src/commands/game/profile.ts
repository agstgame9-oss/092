import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { actionProfile } from "../../lib/actions.js";

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("عرض ملفك الشخصي أو ملف لاعب آخر")
  .addUserOption((o) =>
    o.setName("user").setDescription("اللاعب الذي تريد عرض ملفه").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("user") ?? interaction.user;
  await actionProfile(interaction, target.id);
}
