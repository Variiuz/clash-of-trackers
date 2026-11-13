# Clash Tracker

Unofficial Clash of Clans progress tracker. A fun side project, made with Claude.

Paste the in-game data export (Settings → More Settings → Data Export) to see levels, remaining upgrades, costs, timers and a planner for both villages. Data stays in the browser; the player name, clan and league are looked up from the ClashKing API by tag.

```bash
npm install
npm run dev
npm run build            # static site in dist/ (deployed to GitHub Pages on push to main)
npm run sync-data        # refresh game data and images after a game update
npm run build:artifact   # single-page build with packed images
```

Maximum levels and counts are those of the current Town Hall / Builder Hall. Progress is measured in upgrade time, or in cost where there is no timer (walls, equipment).

## Credits and legal

Game data and images: [ClashKing Assets](https://github.com/ClashKingInc/ClashKingAssets) (GPL-3.0). Player profiles: [ClashKing API](https://api.clashk.ing), Creator Code: ClashKing. A few building images in `extra-assets/` come from the Clash of Clans Wiki.

This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy: https://www.supercell.com/fan-content-policy. Free: no ads, no payments.
