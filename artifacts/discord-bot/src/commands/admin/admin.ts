import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { actionAdminDashboard } from "../../lib/adminActions.js";

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("Open the admin control dashboard")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await actionAdminDashboard(interaction);
}
