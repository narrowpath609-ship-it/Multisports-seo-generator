# Sports SEO Generator

This tool automatically generates SEO-optimized sports content pages for NFL, NBA, NHL, NCAAF, and NCAAB games.

## 🚀 Features
- Creates programmatic HTML pages for matchups or players
- Inserts JSON-LD schema for structured data
- Generates SEO meta tags and headings automatically
- Simple CSV-based input (no coding required)
- Perfect for sports betting, team pages, or score insights

## 🧩 How to Use
1. Install Node.js (v18+ recommended)
2. Run `npm install` (if dependencies are added later)
3. Add your data to `/sample_data/matchups.csv`
4. Generate pages:
   ```bash
   node generate_pages.js sample_data/matchups.csv
   ```
5. Find results in `/output`

## 🧠 Example Input (CSV)
| League | Matchup | Date | Location | Odds | Broadcast |
|--------|----------|------|-----------|------|------------|
| NFL | Philadelphia Eagles vs Dallas Cowboys | 2025-10-20 | Lincoln Financial Field | PHI -3.5 | FOX |

## 🧾 Output
Each generated file includes:
- SEO meta tags
- JSON-LD (SportsEvent or Athlete)
- Readable sports content (5th-grade level)
- Betting insights and FAQs

## ⚙️ Customization
- Edit `template.html` to modify structure.
- Extend `generate_pages.js` for additional data (injuries, rosters, advanced stats).

---
© 2025 Sports SEO Generator
