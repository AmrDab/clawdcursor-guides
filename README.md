# clawdcursor-guides

Community-maintained app guides for [clawdcursor](https://github.com/AmrDab/clawdcursor),
served at <https://clawdcursor.com/app-guides>.

## What this is

clawdcursor is a desktop-control AI agent. For unfamiliar apps it figures
things out from screenshots and accessibility trees — slow but always works.
For popular apps where the keyboard shortcuts, workflow patterns, and
failure modes are well-known, this repo provides **app guides** the agent
fetches on demand. With a guide loaded, the agent operates an app 5–10×
faster because it doesn't need to rediscover the layout each task.

A guide is a single JSON file at this repo's root, named `<app>.json`. The
client fetches it from `clawdcursor.com/app-guides/<app>.json`, caches it
locally for 7 days, and falls back gracefully when offline.

## Browse guides

| App | Workflows | Shortcuts | Tips |
|-----|-----------|-----------|------|
| [discord](./discord.json) | – | 27 | – |
| [excel](./excel.json) | 6 | 122 | – |
| [figma](./figma.json) | – | 116 | – |
| [gmail](./gmail.json) | 8 | 12 | 6 |
| [mspaint](./mspaint.json) | 7 | 11 | – |
| [olk](./olk.json) (Outlook new) | 4 | 7 | – |
| [outlook](./outlook.json) | 8 | 12 | 6 |
| [slack](./slack.json) | 6 | 15 | 5 |
| [spotify](./spotify.json) | – | 23 | – |
| [youtube](./youtube.json) | 19 | 36 | 13 |

See [`index.json`](./index.json) for machine-readable metadata (auto-generated
nightly from this repo + vote-issue reactions).

## Submitting

See [CONTRIBUTING.md](./CONTRIBUTING.md). Short version:

1. Write `<app>.json` matching the schema in
   [clawdcursor's `AppGuide` type](https://github.com/AmrDab/clawdcursor/blob/main/src/core/pipeline-types.ts).
2. Run `node scripts/lint-guide.mjs <app>.json` locally.
3. Open a PR. CI re-runs the linter; a maintainer reviews; once merged
   it goes live at `clawdcursor.com/app-guides/<app>.json`.

## Voting

Every guide has a `vote: <app>` Issue. React with 👍 to upvote or 👎 to
downvote. The nightly aggregator counts reactions and writes them into
`index.json`. The client surfaces ratings in `clawdcursor guides list`.

## Trust levels

Maintainers label merged PRs with one of:

- `trust:verified` — curated, fetched by default
- `trust:community` — vetted PR, fetched when opted in
- `trust:experimental` — un-vetted, fetched by explicit name only

## Schema

```jsonc
{
  "app": "youtube",                              // required, lowercase
  "name": "YouTube",                              // optional, display name
  "domainHints": ["youtube.com"],                 // optional
  "shortcuts": { "focus_search": "/" },           // optional
  "workflows": {                                   // optional
    "search_and_play": "Press / to focus..."     // prose OR structured steps
  },
  "layout": {                                      // optional
    "top_bar": "Logo on the left..."
  },
  "tips": [                                        // optional
    "YouTube IS a website. Use open_url(...)."
  ]
}
```

The full type lives in
[`src/core/pipeline-types.ts`](https://github.com/AmrDab/clawdcursor/blob/main/src/core/pipeline-types.ts).
The linter in [`scripts/lint-guide.mjs`](./scripts/lint-guide.mjs) is the
source of truth for what's required and what gets rejected — every clawdcursor
install runs the identical rule set client-side as defense-in-depth.

## License

[MIT](./LICENSE)
