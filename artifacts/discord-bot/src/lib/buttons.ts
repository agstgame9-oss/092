import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function mainMenuRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:daily").setLabel("🎁 يومي").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:characters").setLabel("📦 الشخصيات").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:party_view").setLabel("🎯 الفريق").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:summon_free").setLabel("💎 استدعاء").setStyle(ButtonStyle.Secondary),
  );
}

export function exploreRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف مجدداً").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:daily").setLabel("🎁 يومي").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:characters").setLabel("📦 الشخصيات").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:profile").setLabel("👤 الملف").setStyle(ButtonStyle.Secondary),
  );
}

export function summonRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:summon_single").setLabel("💎 استدعاء واحد").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:summon_ten").setLabel("🎰 استدعاء ×10").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:summon_free").setLabel("🎁 استدعاء مجاني").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:characters").setLabel("📦 المجموعة").setStyle(ButtonStyle.Secondary),
  );
}

export function startRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:daily").setLabel("🎁 المكافأة اليومية").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:summon_free").setLabel("💎 استدعاء مجاني").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:profile").setLabel("👤 ملفي الشخصي").setStyle(ButtonStyle.Secondary),
  );
}

export function dailyRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:summon_free").setLabel("🎁 استدعاء مجاني").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:summon_single").setLabel("💎 استدعاء").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:characters").setLabel("📦 الشخصيات").setStyle(ButtonStyle.Secondary),
  );
}

export function charactersRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:party_manage").setLabel("🎯 تعيين الفريق").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:summon_single").setLabel("💎 استدعاء").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:summon_free").setLabel("🎁 استدعاء مجاني").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Secondary),
  );
}

export function partyRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:party_manage").setLabel("🎯 تعديل الفريق").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:characters").setLabel("📦 الشخصيات").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:profile").setLabel("👤 الملف").setStyle(ButtonStyle.Secondary),
  );
}

export function battleActionsRow(
  furyReady: boolean,
  skillOnCooldown: boolean,
  skillCooldownTurns: number = 0,
  skillName: string = "مهارة",
) {
  const shortSkillName = skillName.length > 14 ? skillName.slice(0, 13) + "…" : skillName;
  const skillLabel = skillOnCooldown ? `🌀 ${shortSkillName} (${skillCooldownTurns})` : `🌀 ${shortSkillName}`;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("explore_move:attack")
      .setLabel("⚔️ هجوم")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("explore_move:skill")
      .setLabel(skillLabel)
      .setStyle(ButtonStyle.Success)
      .setDisabled(skillOnCooldown),
    new ButtonBuilder()
      .setCustomId("explore_move:defend")
      .setLabel("🛡️ دفاع")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("explore_move:fury")
      .setLabel(furyReady ? "💥 الغضب! (جاهز)" : "💥 غضب (يشحن)")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!furyReady),
  );
}

export type LeaderboardType = "pvp" | "level" | "gold" | "damage" | "wins";

export function leaderboardRow(current: LeaderboardType) {
  const types: { id: LeaderboardType; label: string }[] = [
    { id: "pvp",    label: "🏆 PvP" },
    { id: "level",  label: "📊 المستوى" },
    { id: "gold",   label: "💰 الذهب" },
    { id: "damage", label: "💥 الضرر" },
    { id: "wins",   label: "⚔️ انتصارات" },
  ];
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    types.map(t =>
      new ButtonBuilder()
        .setCustomId(`act:lb_${t.id}`)
        .setLabel(t.label)
        .setStyle(t.id === current ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(t.id === current)
    )
  );
}

export function guildNavRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("act:guild_info").setLabel("🏰 معلومات النقابة").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("act:guild_members").setLabel("👥 الأعضاء").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:explore").setLabel("⚔️ استكشاف").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("act:profile").setLabel("👤 الملف").setStyle(ButtonStyle.Secondary),
  );
}

export function pvpChallengeRow(battleId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pvp_accept:${battleId}`)
      .setLabel("✅ قبول")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`pvp_decline:${battleId}`)
      .setLabel("❌ رفض")
      .setStyle(ButtonStyle.Danger),
  );
}

export function pvpMoveRow(
  battleId: string,
  furyReady: boolean,
  skillOnCooldown: boolean,
  skillName: string = "مهارة",
) {
  const shortSkillName = skillName.length > 12 ? skillName.slice(0, 11) + "…" : skillName;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pvp_move:${battleId}:attack`)
      .setLabel("⚔️ هجوم")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`pvp_move:${battleId}:skill`)
      .setLabel(`🌀 ${shortSkillName}`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(skillOnCooldown),
    new ButtonBuilder()
      .setCustomId(`pvp_move:${battleId}:defend`)
      .setLabel("🛡️ دفاع")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`pvp_move:${battleId}:fury`)
      .setLabel(furyReady ? "💥 الغضب!" : "💥 غضب")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!furyReady),
  );
}

// ── Admin Dashboard ─────────────────────────────────────────────────────────

export function adminDashboardRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("admin:stats").setLabel("📊 إحصائيات").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("admin:config").setLabel("🌍 الإعدادات").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("admin:logs").setLabel("📋 السجلات").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("admin:announce").setLabel("📢 إعلان").setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("admin:give_gems").setLabel("💎 منح جواهر").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("admin:give_gold").setLabel("🪙 منح ذهب").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("admin:give_xp").setLabel("✨ منح خبرة").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("admin:ban").setLabel("⛔ حظر").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("admin:unban").setLabel("✅ رفع الحظر").setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("admin:reset").setLabel("🔄 إعادة تعيين").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("admin:spawn_boss_menu").setLabel("🏆 استدعاء زعيم").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("admin:refresh").setLabel("🔃 تحديث").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

// ── Raid Attack Row ──────────────────────────────────────────────────────────

export function raidAttackRow(raidId: string, bossName: string, alive: boolean) {
  const short = bossName.length > 20 ? bossName.slice(0, 19) + "…" : bossName;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`raid:attack:${raidId}`)
      .setLabel(alive ? `⚔️ هاجم ${short}!` : `💀 ${short} مهزوم`)
      .setStyle(alive ? ButtonStyle.Danger : ButtonStyle.Secondary)
      .setDisabled(!alive),
  );
}
