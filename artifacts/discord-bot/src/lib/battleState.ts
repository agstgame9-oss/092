import type { Move } from "./gameEngine.js";

export interface FighterState {
  name: string;
  displayName: string;
  discordId: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  crit: number;
  critDmg: number;
  element: string;
  fury: number;
  skillName: string;
  skillElement: string;
  skillDamage: number;
  skillCooldown: number;
}

export interface ExploreBattle {
  discordId: string;
  playerId: number;
  channelId: string;
  floor: number;
  isBoss: boolean;
  player: FighterState;
  enemy: {
    name: string;
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    element: string;
    fury: number;
    skillCooldown: number;
  };
  round: number;
  log: string[];
  dungeonId?: string;
  dungeonRunId?: number;
  maxDungeonFloor?: number;
}

export interface PvpBattle {
  battleId: string;
  channelId: string;
  messageId: string;
  attacker: FighterState;
  defender: FighterState;
  attackerDbId: number;
  defenderDbId: number;
  attackerRating: number;
  defenderRating: number;
  round: number;
  log: string[];
  status: "pending" | "active" | "finished";
  attackerMove: Move | null;
  defenderMove: Move | null;
  tournamentId?: number;
  tournamentMatchId?: string;
}

export interface RaidSession {
  raidId: string;
  channelId: string;
  messageId: string;
  guildId: string;
  bossId: number;
  bossName: string;
  bossTitle: string;
  bossElement: string;
  currentHp: number;
  maxHp: number;
  bossAtk: number;
  isAlive: boolean;
  participants: Map<string, { username: string; damage: number; lastAttack: number }>;
  xpReward: number;
  goldReward: number;
  spawnedBy: string;
  createdAt: number;
}

export const exploreBattles = new Map<string, ExploreBattle>();
export const pvpBattles = new Map<string, PvpBattle>();
export const activeRaids = new Map<string, RaidSession>();
