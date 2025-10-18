// fetchers.js
import fetch from "node-fetch";
import fs from "fs-extra";

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function retryFetch(url, options = {}, retries = 3, backoff = 1000) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const text = await res.text().catch(()=>"");
        throw new Error(`Fetch error ${res.status} ${res.statusText} - ${text}`);
      }
      return await res.json();
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      await sleep(backoff * attempt); // exponential-ish backoff
    }
  }
}

// Example: TheOddsAPI normalized fetcher
export async function fetchOddsForSport(sportKey, apiKey, regions = "us") {
  if (!apiKey) throw new Error("Odds API key is missing.");
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?regions=${regions}&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso&apiKey=${apiKey}`;
  return await retryFetch(url, {}, 3, 1200);
}

// Example: SportsDataIO roster/injury fetcher (adapt to provider endpoints)
export async function fetchTeamRoster(sportsdataKey, providerLeague, teamId) {
  if (!sportsdataKey) throw new Error("SportsDataIO key missing.");
  // NOTE: Replace providerLeague & endpoint with your provider's correct path.
  const url = `https://api.sportsdata.io/v3/${providerLeague}/scores/json/Players/${teamId}?key=${sportsdataKey}`;
  return await retryFetch(url, {}, 3, 1000);
}

export async function fetchInjuries(sportsdataKey, providerLeague, season) {
  if (!sportsdataKey) throw new Error("SportsDataIO key missing.");
  const url = `https://api.sportsdata.io/v3/${providerLeague}/scores/json/Injuries/${season}?key=${sportsdataKey}`;
  return await retryFetch(url, {}, 3, 1000);
}

// Fallback: local cached snapshot
export async function readCached(path) {
  try {
    return await fs.readJson(path);
  } catch (err) {
    return null;
  }
}

export async function writeCached(path, data) {
  await fs.ensureFile(path);
  return fs.writeJson(path, data, { spaces: 2 });
}
