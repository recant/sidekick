# Ally Lead Engine

A lightweight dashboard that turns **public hiring signals** into project opportunities.

Instead of scraping closed marketplaces, it reads published job feeds from ATS providers (Ashby, Lever, Greenhouse), normalizes listings, and scores each job for how plausibly the role can be reframed as a discrete outsourced outcome.

## What it does

- Add a public ATS job-board source by provider + board slug.
- Fetch live listings server-side.
- Infer the likely project hidden inside each hiring need.
- Rank by an `outsourceability score`.
- Generate a neutral first discovery question for outreach.
- Filter/search in a small browser dashboard.
- Save source lists locally in your browser.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Supported public feeds

- Ashby: `https://jobs.ashbyhq.com/<slug>`
- Lever: `https://jobs.lever.co/<slug>`
- Greenhouse: `https://boards.greenhouse.io/<slug>` or equivalent public Greenhouse board

The server only fetches published job endpoints from these ATS providers. Do not use this app to scrape authenticated, private, or contractually restricted marketplaces.

## Notes

The scoring is heuristic on purpose. V1 is meant to discover whether job postings are a useful demand signal before paying for an LLM/API or building a crawler/database.
