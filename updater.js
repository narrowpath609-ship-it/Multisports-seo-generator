// updater.js
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import { fetchOddsForSport, fetchTeamRoster, fetchInjuries, readCached, writeCached } from "./fetchers.js";

const OUT_DIR = path.resolve("./output");
const SNAP_DIR = path.resolve("./snapshots");
await fs.ensureDir(OUT_DIR);
await fs.ensureDir(SNAP_DIR);

// Load matchups CSV (same format as existing sample_data)
import { parse } from "csv-parse/sync";
const csv = await fs.readFile("sample_data/matchups.csv", "utf8");
const rows = parse(csv, { columns: true, skip_empty_lines: true });

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const SDIO_API_KEY = process.env.SDIO_API_KEY;
const ODDS_SPORT_MAP = {
  NFL: "americanfootball_nfl",
  NBA: "basketball_nba",
  NHL: "icehockey_nhl",
  NCAAF: "americanfootball_ncaaf",
  NCAAB: "basketball_ncaab"
};

function normalizeOddsPayload(oddsResp, homeTeamName, awayTeamName) {
  // Naive normalization: find matching event using teams in title.
  if (!Array.isArray(oddsResp)) return null;
  const event = oddsResp.find(e => {
    const teams = (e.home_team || e.teams?.[0] || "").toString().toLowerCase();
    const title = (e.title || "").toLowerCase();
    return title.includes(homeTeamName.toLowerCase()) || title.includes(awayTeamName.toLowerCase()) || teams.includes(homeTeamName.toLowerCase());
  }) || oddsResp[0];
  // Extract first bookmaker's basic markets
  const bk = event?.bookmakers?.[0];
  const markets = bk?.markets || [];
  const h2h = markets.find(m=>m.key==='h2h')?.outcomes || [];
  const spreads = markets.find(m=>m.key==='spreads')?.outcomes || [];
  const totals = markets.find(m=>m.key==='totals')?.outcomes || [];
  return {
    rawEvent: event || null,
    moneyline: h2h,
    spread: spreads,
    totals: totals,
    lastUpdate: event?.last_update || new Date().toISOString()
  };
}

function simpleSlug(row) {
  return `${row.League.toLowerCase()}-${row.HomeTeam.toLowerCase().replace(/\\s+/g,'-')}-vs-${row.AwayTeam.toLowerCase().replace(/\\s+/g,'-')}`;
}

function renderHtmlPage(row, snapshots) {
  // Minimal but structured HTML with JSON-LD
  const slug = simpleSlug(row);
  const jsonld = {
    "@context":"https://schema.org",
    "@type":"SportsEvent",
    "name": row.Matchup,
    "sport": row.League,
    "startDate": row.Date,
    "location": { "@type":"Place", "name": row.Location }
  };

  const odds = snapshots?.odds || {};
  const inj = snapshots?.injuries || { home: [], away: [] };
  const roster = snapshots?.roster || { home: [], away: [] };

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${row.Matchup} Betting Preview</title>
  <meta name="description" content="${row.Matchup} - odds, injuries, and picks.">
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
  </head><body>
  <h1>${row.Matchup} Betting Preview (${row.Date})</h1>
  <h2>Latest Odds</h2>
  <pre>${JSON.stringify(odds, null, 2)}</pre>
  <h2>Injury Snapshot</h2>
  <pre>${JSON.stringify(inj, null, 2)}</pre>
  <h2>Rosters</h2>
  <pre>${JSON.stringify(roster, null, 2)}</pre>
  <h2>Quick Picks</h2>
  <p>Auto-pick: Use spread and totals data to generate simple edge. (See internal analytics.)</p>
  </body></html>`;
  return html;
}

async function runOnce() {
  for (const row of rows) {
    try {
      const sportKey = ODDS_SPORT_MAP[row.League] || row.League.toLowerCase();
      const slug = simpleSlug(row);
      const snapPath = path.join(SNAP_DIR, `${slug}.json`);
      const lastSnap = await readCached(snapPath);

      // Fetch live odds
      const oddsResp = await fetchOddsForSport(sportKey, ODDS_API_KEY).catch(err=>{
        console.error("Odds fetch error:", err.message);
        return lastSnap?.odds?.rawEvent ? lastSnap.odds.rawEvent : null;
      });

      const normalized = normalizeOddsPayload(oddsResp || lastSnap?.odds?.rawEvent, row.HomeTeam, row.AwayTeam);

      // Fetch injuries and rosters (best-effort)
      // These endpoints depend on provider; here we attempt roster by team slug or ID (placeholder)
      const rosterHome = await fetchTeamRoster(SDIO_API_KEY, sportKey, row.HomeTeam).catch(()=> lastSnap?.roster?.home || []);
      const rosterAway = await fetchTeamRoster(SDIO_API_KEY, sportKey, row.AwayTeam).catch(()=> lastSnap?.roster?.away || []);
      const injuries = await fetchInjuries(SDIO_API_KEY, sportKey, new Date().getFullYear()).catch(()=> lastSnap?.injuries || []);

      const snapshot = {
        meta: { updatedAt: new Date().toISOString() },
        odds: normalized,
        roster: { home: rosterHome, away: rosterAway },
        injuries
      };

      await writeCached(snapPath, snapshot);

      // Render page HTML and write to output
      const html = renderHtmlPage(row, snapshot);
      const outPath = path.join(OUT_DIR, `${slug}.html`);
      await fs.writeFile(outPath, html, "utf8");
      console.log(`✅ Updated page: ${outPath}`);

    } catch (err) {
      console.error("Error processing row:", row.Matchup, err.message);
    }
  }
}

if (process.argv.includes("--once")) {
  runOnce().catch(e=>{ console.error(e); process.exit(1); });
} else {
  // default: run once and exit; scheduler should call this script
  runOnce().catch(e=>{ console.error(e); process.exit(1); });
}
