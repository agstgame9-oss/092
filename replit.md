# Anime Multiverse Arena

A Discord bot game with a React admin dashboard — gacha summoning, PvP battles, floor exploration, and guild systems.

## Run & Operate

- `pnpm --filter @workspace/discord-bot run dev` — run the Discord bot
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `DISCORD_TOKEN` — Bot token from Discord Developer Portal
- Required env: `DISCORD_CLIENT_ID` — Application ID from Discord Developer Portal

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Discord.js v14 (bot)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/discord-bot/src/` — Discord bot source
  - `commands/game/` — player commands (start, explore, summon, challenge, etc.)
  - `commands/admin/` — admin commands (setup)
  - `commands/guild/` — guild commands
  - `lib/actions.ts` — shared action logic (called by both slash commands and buttons)
  - `lib/gameEngine.ts` — battle engine, XP/leveling, stamina regen
  - `lib/buttons.ts` — Discord button row builders
  - `lib/cooldown.ts` — cooldown management (delete+insert pattern, no unique constraint)
  - `lib/embeds.ts` — shared embed helpers, color/emoji constants
  - `events/interactionCreate.ts` — routes slash commands and button clicks
- `lib/db/src/schema/` — Drizzle ORM schemas (source of truth for DB)
- `artifacts/dashboard/` — React admin dashboard

## Architecture decisions

- **Button routing**: All game actions live in `lib/actions.ts` and accept `AnyInteraction = ChatInputCommandInteraction | ButtonInteraction`. Buttons use `deferUpdate()`, slash commands use `deferReply()`.
- **Cooldown pattern**: `cooldownsTable` has no unique constraint on `(discordId, command)`. `setCooldown` does delete-then-insert to ensure the cooldown is always refreshed correctly.
- **Stamina regen**: Passive regen calculated on every player interaction via `applyStaminaRegen()`. Rate: 1 stamina per 6 minutes (configurable via server settings).
- **Summon guarantee**: 10x pulls guarantee S rarity on the 10th pull if it didn't naturally roll S+.
- **Server config**: Each Discord server has a config row in `server_config` table (admin role, player role, announcement channel, feature toggles, XP/gold multipliers).

## Product

- **`/start`** — Register as a player, get 20 starter gems and 1000 gold. Auto-assigns player role if configured.
- **`/summon`** — Gacha system (single 10💎, 10x 90💎, free daily). 8 rarity tiers from D to SSS+.
- **`/explore`** — Auto-battle floor enemies (costs 10 stamina, 30s cooldown). Win XP, gold, advance floors.
- **`/challenge @user`** — PvP battles with rating system (±25/20 per match). 5-minute cooldown.
- **`/daily`** — Claim daily: +500 gold, +10 gems, +60 stamina. 24-hour cooldown.
- **`/profile`** — View stats, XP bar, stamina, PvP rating, guild.
- **`/characters`** — View character collection sorted by rarity.
- **`/party`** — Manage battle party (up to 3 characters).
- **`/guild`** — Create/join guilds.
- **`/setup`** (admin) — Configure server: admin role, player role, announcement channel, feature toggles, XP/gold multipliers.

## User preferences

- Bot commands use interactive Discord buttons after each response for quick follow-up actions.
- Daily gems: 10 (bumped from 5 for better gacha economy).
- Starting gems: 20 (2 free single pulls on registration).

## Gotchas

- Always run `pnpm --filter @workspace/db run push` after schema changes, then `pnpm run typecheck:libs` to rebuild the DB lib.
- Bot exits immediately without `DISCORD_TOKEN` set in Replit Secrets.
- `deploy-commands.ts` must be run separately to register slash commands with Discord after adding new commands.
- The `serverConfigTable` is needed by `setup.ts` — it's exported from `lib/db.ts` in the bot.
- `adminLogsTable` is defined inside `lib/db/src/schema/cooldowns.ts` (not the standalone `adminLogs.ts` file — that one is unused).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
