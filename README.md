# Clash Tracker

A free, unofficial Clash of Clans progress tracker. Paste the in-game data export and see every upgrade you have left, with the game's own artwork.

## Features

- **Import** by pasting the export JSON, reading the clipboard, or opening a file. Several villages can be tracked side by side.
- **Overview**: overall progress, per-section progress, live countdowns for running upgrades, total resources and time left, helpers.
- **Home Village / Army / Heroes / Builder Base**: every building, wall, trap, troop, spell, siege machine, pet, hero, guardian and piece of equipment at its current level artwork. Click anything for the remaining levels with cost and time.
- **Planner**: what each queue (builders, laboratory, hero hall, pet house, blacksmith) can start now, sortable by time or cost, with a finish estimate.
- **History**: each import is kept as a snapshot; the overview charts progress and lists what was finished in between.
- Everything stays in the browser (`localStorage`). No server, no account, no tracking.

## Run it

```bash
npm install
npm run dev      # develop
npm run build    # static site in dist/, host it anywhere
```

## Updating game data

Game data and images are baked into `src/data/game.json` and `public/assets/` from the community
[ClashKing Assets](https://github.com/ClashKingInc/ClashKingAssets) repository. After a game update:

```bash
npm run sync-data
```

## How progress is calculated

- Maximum levels and building counts are those available at the village's current Town Hall / Builder Hall.
- A section's percentage is measured in upgrade time; walls and equipment (no timers) are measured in cost.
- The overall percentage is the average of the sections. Crafted (seasonal) defenses are shown but not counted.

## Legal

This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy:
https://www.supercell.com/fan-content-policy. Clash of Clans and its artwork are property of Supercell Oy.
This project is free and takes no money: no ads, no payments, no donations.

Game data and images come from ClashKing Assets (GPL-3.0); please keep the credit in the footer.
