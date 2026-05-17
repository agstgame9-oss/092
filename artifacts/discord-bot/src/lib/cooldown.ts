import { db, cooldownsTable } from "./db.js";
import { eq, and } from "drizzle-orm";

export async function checkCooldown(discordId: string, command: string): Promise<number> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(cooldownsTable)
    .where(and(eq(cooldownsTable.discordId, discordId), eq(cooldownsTable.command, command)));
  if (!row) return 0;
  if (row.expiresAt > now) {
    return Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000);
  }
  return 0;
}

export async function setCooldown(discordId: string, command: string, seconds: number) {
  const expiresAt = new Date(Date.now() + seconds * 1000);
  await db
    .delete(cooldownsTable)
    .where(and(eq(cooldownsTable.discordId, discordId), eq(cooldownsTable.command, command)));
  await db.insert(cooldownsTable).values({ discordId, command, expiresAt });
}

export async function clearCooldown(discordId: string, command: string) {
  await db
    .delete(cooldownsTable)
    .where(and(eq(cooldownsTable.discordId, discordId), eq(cooldownsTable.command, command)));
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}
