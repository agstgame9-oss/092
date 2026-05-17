import { db } from "./db.js";
import { tournamentsTable, playersTable, playerCharactersTable, charactersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { FighterState } from "./battleState.js";

type BetRecord = Record<string, {
  discordId: string;
  username: string;
  betOn: string;
  amount: number;
  matchId: string;
  round: number;
  paid?: boolean;
}>;

type Match = {
  round: number;
  matchId: string;
  player1: string;
  player2: string | null;
  winner: string | null;
  battleId: string | null;
  [key: string]: unknown;
};

export async function buildFighterForPlayer(
  discordId: string,
  username: string,
): Promise<{ fighter: FighterState; playerId: number; rating: number } | null> {
  const [player] = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId));
  if (!player) return null;

  const chars = await db
    .select({ pc: playerCharactersTable, char: charactersTable })
    .from(playerCharactersTable)
    .innerJoin(charactersTable, eq(playerCharactersTable.characterId, charactersTable.id))
    .where(eq(playerCharactersTable.playerId, player.id));

  const lead = chars.find(c => c.pc.isOnParty) ?? chars[0] ?? null;
  if (!lead) return null;

  const skill1 = lead.char.skill1 as { name: string; element?: string; damage: number };

  const fighter: FighterState = {
    name: lead.char.name,
    displayName: username,
    discordId,
    hp: lead.char.baseHp * lead.pc.level,
    maxHp: lead.char.baseHp * lead.pc.level,
    atk: lead.char.baseAtk * lead.pc.level,
    def: lead.char.baseDef * lead.pc.level,
    crit: lead.char.baseCrit,
    critDmg: lead.char.baseCritDmg,
    element: lead.char.element1,
    fury: 0,
    skillName: skill1.name,
    skillElement: skill1.element ?? lead.char.element1,
    skillDamage: skill1.damage,
    skillCooldown: 0,
  };

  return { fighter, playerId: player.id, rating: player.pvpRating };
}

export async function resolveTournamentMatch(
  tournamentId: number,
  matchId: string,
  winnerId: string,
): Promise<{ autoAdvanced: boolean; champion?: string }> {
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) return { autoAdvanced: false };

  const bracket = (tournament.bracket ?? []) as Match[];
  const bets = ((tournament.spectatorBets ?? {}) as BetRecord);

  const matchIndex = bracket.findIndex(m => m.matchId === matchId);
  if (matchIndex === -1) return { autoAdvanced: false };

  bracket[matchIndex].winner = winnerId;

  const payoutPromises: Promise<unknown>[] = [];
  for (const [betKey, bet] of Object.entries(bets)) {
    if (bet.matchId === matchId && !bet.paid) {
      bets[betKey].paid = true;
      if (bet.betOn === winnerId) {
        const payout = Math.floor(bet.amount * 1.8);
        const [bettor] = await db.select().from(playersTable).where(eq(playersTable.discordId, bet.discordId));
        if (bettor) {
          payoutPromises.push(
            db.update(playersTable)
              .set({ gold: bettor.gold + payout, updatedAt: new Date() })
              .where(eq(playersTable.id, bettor.id))
          );
        }
      }
    }
  }
  await Promise.all(payoutPromises);

  const currentRoundMatches = bracket.filter(m => m.round === tournament.currentRound);
  const allDone = currentRoundMatches.every(m => m.winner !== null);

  if (!allDone) {
    await db.update(tournamentsTable)
      .set({ bracket, spectatorBets: bets, updatedAt: new Date() })
      .where(eq(tournamentsTable.id, tournamentId));
    return { autoAdvanced: false };
  }

  const nextRound = tournament.currentRound + 1;
  if (nextRound > tournament.totalRounds) {
    const finalMatch = currentRoundMatches[0];
    const champion = finalMatch?.winner ?? null;

    if (champion) {
      const prizes = (tournament.prizes as Array<{ rank: number; gold: number; gems: number }>) ?? [];
      const firstPrize = prizes.find(p => p.rank === 1);
      const [champPlayer] = await db.select().from(playersTable).where(eq(playersTable.discordId, champion));
      if (champPlayer && firstPrize) {
        await db.update(playersTable)
          .set({ gold: champPlayer.gold + firstPrize.gold, gems: champPlayer.gems + firstPrize.gems })
          .where(eq(playersTable.id, champPlayer.id));
      }

      const secondMatch = currentRoundMatches.find(m => m.player1 === champion || m.player2 === champion);
      const secondId = secondMatch
        ? (secondMatch.player1 === champion ? secondMatch.player2 : secondMatch.player1)
        : null;
      if (secondId) {
        const secondPrize = prizes.find(p => p.rank === 2);
        const [secondPlayer] = await db.select().from(playersTable).where(eq(playersTable.discordId, secondId));
        if (secondPlayer && secondPrize) {
          await db.update(playersTable)
            .set({ gold: secondPlayer.gold + secondPrize.gold, gems: secondPlayer.gems + secondPrize.gems })
            .where(eq(playersTable.id, secondPlayer.id));
        }
      }
    }

    await db.update(tournamentsTable)
      .set({ bracket, spectatorBets: bets, status: "completed", updatedAt: new Date() })
      .where(eq(tournamentsTable.id, tournamentId));

    return { autoAdvanced: true, champion: champion ?? undefined };
  }

  const winners = currentRoundMatches.map(m => m.winner).filter(Boolean) as string[];
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

  const status = nextRound === tournament.totalRounds ? "finals" : "active";
  const allBracket = [...bracket, ...nextMatches];

  await db.update(tournamentsTable)
    .set({ bracket: allBracket, spectatorBets: bets, currentRound: nextRound, status, updatedAt: new Date() })
    .where(eq(tournamentsTable.id, tournamentId));

  return { autoAdvanced: true };
}
