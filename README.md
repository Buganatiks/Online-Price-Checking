# ITMA — IT Marketplace Aggregator

Daily price checker for Philippine IT stores.

- **Database:** Supabase (stores, products, price history, specs)
- **Scraper:** `scraper/` — runs on GitHub Actions every morning (~5:47 AM PH time)
- **Specs:** pulled from product titles with simple rules (`scraper/specs.js`), no AI needed

## Run it now
Go to the **Actions** tab → **Scrape prices** → **Run workflow**.

## Add a store
Add a row to the `stores` table in Supabase (name + website). Shopify stores work automatically.
To pause a store, set `enabled` to false.

## Secrets (repo Settings → Secrets and variables → Actions)
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (never put this in code)
