# HySky

HySky is a Discord bot for Hypixel SkyBlock. It focuses on fast slash-command lookups for player data, market information, alerts, and account linking, while keeping Hypixel API traffic under control with server-side caching.

HySky is not affiliated with Hypixel.

## Features

- Player and profile commands for stats, skills, slayers, dungeons, net worth, pets, museum progress, garden data, and more.
- Economy commands for Bazaar data, auctions, Fire Sales, and other SkyBlock market information.
- Background watchers for Jacob contests, mayor rotations, patch news, Bazaar alerts, and Fire Sale notifications.
- Discord account linking backed by MongoDB so users can run commands without typing their IGN every time.
- Cached API access through a single wrapper in `src/api/hypixel.js` to reduce duplicate requests.

## Tech Stack

- Node.js 18+
- discord.js 14
- axios
- mongoose
- node-cache
- prismarine-nbt

## Requirements

- Node.js 18 or later
- A Discord bot token
- A Hypixel API key
- MongoDB for linked accounts, guild settings, and alerts

The bot can still start without MongoDB, but database-backed features such as account linking and alert storage will not work correctly.

## Quick Start

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env`.
4. Fill in the required environment variables.
5. Deploy slash commands with `npm run deploy`.
6. Start the bot with `npm start`.

For local development, you can also run `npm run dev`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Discord bot token from the Discord developer portal. |
| `HYPIXEL_API_KEY` | Yes | Hypixel API key used for server-side requests. |
| `MONGODB_URI` | Recommended | MongoDB connection string for linked accounts, guild config, and alert subscriptions. |
| `FOOTER_TEXT` | No | Custom footer text shown on embeds. |
| `GUILD_ID` | No | Optional guild id used when clearing old guild-specific commands during deployment. |

## Caching and API Usage

All Hypixel requests are routed through `src/api/hypixel.js`, where responses are cached with `node-cache` before being reused by commands and background tasks.

Current cache windows:

- Player, guild, profile, museum, garden, and bingo lookups: 5 minutes
- Bazaar and Fire Sale data: 1 minute
- Auction data: 2 minutes
- Player online status: 30 seconds
- Hypixel resource endpoints and news: 1 hour
- Mojang username-to-UUID lookups: 10 minutes

This keeps duplicate lookups from hitting the API repeatedly when users request the same data in a short window.

## Commands

Representative slash commands include:

- `/stats`, `/skills`, `/slayer`, `/dungeons`, `/networth`, `/accessories`
- `/bazaar`, `/auction`, `/firesales`, `/mayor`, `/news`, `/jacob`
- `/link`, `/unlink`, `/online`, `/setup`, `/alert`

Additional commands live in [`src/commands`](./src/commands).

## Project Layout

```text
src/
  api/              External API wrappers and caching
  commands/         Slash command implementations
  events/           Discord client event handlers
  models/           MongoDB models
  tasks/            Background watchers and scheduled jobs
  utils/            Shared formatters, constants, and NBT helpers
  config.js         Environment and cache configuration
  deploy-commands.js
  index.js          Bot bootstrap
```

## Publishing Notes

- `.env`, `node_modules`, editor settings, local temp files, and reference artifacts are ignored by Git.
- Slash commands are deployed globally, so Discord may take a little time to show updates.
- Keep the Hypixel API key private and server-side only.

## License

This project is licensed under the ISC License. See [`LICENSE`](./LICENSE).
