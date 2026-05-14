# Contributing a guide

A clawdcursor guide is a JSON file at this repo's root that teaches the
agent how to operate a specific app quickly. This doc covers the schema,
the linter rules, and the PR flow.

## Quickstart

```bash
# 1. Fork + clone
git clone https://github.com/<you>/clawdcursor-guides
cd clawdcursor-guides

# 2. Write your guide (see schema below)
cp youtube.json myapp.json
$EDITOR myapp.json

# 3. Lint locally
node scripts/lint-guide.mjs myapp.json

# 4. Push + open a PR
git checkout -b add-myapp
git add myapp.json
git commit -m "add myapp guide"
git push origin add-myapp
# Open PR via GitHub UI
```

## Schema

The guide must conform to clawdcursor's `AppGuide` interface
([source](https://github.com/AmrDab/clawdcursor/blob/main/src/core/pipeline-types.ts)):

```jsonc
{
  // Required. The app key. Lowercase, no spaces. Matches the filename.
  "app": "youtube",

  // Optional. Human-readable name. Defaults to `app` if omitted.
  "name": "YouTube",

  // Optional. Hostnames the agent will see when this app is active.
  // Bare domains only — no https://, no paths.
  "domainHints": ["youtube.com", "www.youtube.com"],

  // Optional. Keyboard shortcuts. Use "mod" for the platform-correct
  // modifier (Cmd on macOS / Ctrl elsewhere); the agent normalizes.
  "shortcuts": {
    "focus_search": "/",
    "play_pause":   "k",
    "save":         "mod+s"
  },

  // Optional. Named workflows. EITHER a prose string OR a structured
  // AppWorkflow object with typed steps. Mix and match — most guides
  // use prose because the agent reasons from it.
  "workflows": {
    "search_and_play": "Press / to focus the search bar. Type the query. Press Enter. Click the first result.",
    "compose_and_send": {
      "name": "Compose and send",
      "steps": [
        { "type": "pressKey", "key": "c" },
        { "type": "typeAtFocus", "field": "to" },
        { "type": "pressKey", "key": "mod+Return" }
      ]
    }
  },

  // Optional. Named UI regions. Helps the agent navigate without a screenshot.
  "layout": {
    "top_bar": "Logo on the left, search center, account avatar on the right.",
    "left_sidebar": "Home / Shorts / Subscriptions / History..."
  },

  // Optional. Free-form tips. THE most useful field for richness — put
  // failure modes, gotchas, version-specific quirks, ad-blocker
  // interactions, anything the agent would normally have to discover
  // by failing first.
  "tips": [
    "Ad-blocker prompts appear before the video. Wait for the 'Skip Ad' button at 5s.",
    "Single-letter shortcuts (k, m, f) only fire when the search box is NOT focused."
  ]
}
```

## Authoring philosophy

**Guides are HINTS, not scripts.** The agent always reasons; the guide just
gives it better starting context. Three rules:

1. **Multi-task, not single-purpose.** A YouTube guide should cover playing,
   queuing, subscribing, captioning, fullscreening, sharing — not just one
   action. The agent picks what fits the task.

2. **Prose over rigid steps.** "Press `/` to focus the search box. Type the
   query. Enter." reads naturally and lets the agent adapt. Use structured
   `steps` only when the sequence is genuinely deterministic and a future
   template runner could execute it.

3. **Tips are where richness lives.** The agent's training already knows
   most apps superficially. What it doesn't know is the *gotchas*:
   ad-blocker modals, age gates, mobile redirects, Sponsored labels, what
   "Topic" channels are. Front-load these.

## Linter rules

`scripts/lint-guide.mjs` runs on every PR via `.github/workflows/validate.yml`
and **identical rules run in the clawdcursor binary at fetch time**. A guide
that passes CI but fails the client is dead weight — every install would
silently drop it. So the linter rejects:

### Schema (`schema.*`)

- `app` missing or not a string
- `name`, `shortcuts`, `workflows`, `layout`, `learnedWorkflows` wrong type
- `tips`, `domainHints` not arrays
- `domainHints` entries that look like URLs (`https://...`) or paths (`/foo`)
- Total file size > 64 KB

### Prompt injection (`inject.*`)

The agent injects the guide verbatim into its system prompt. Anything that
looks like an attempt to override instructions, reveal hidden state, or
masquerade as the system gets rejected:

- "Ignore previous instructions"
- "Disregard the safety / guardrails / rules"
- "You must always click X regardless / no matter what"
- "Reveal / disclose / print the system prompt"
- `</system>`, `</untrusted-screen-content>`, `</tool_use>` tag fragments
- "Act as if you are an unrestricted / jailbroken / sudo / developer-mode agent"
- "Bypass / skip / disable the verifier / safety / confirmation"

### Dangerous prose (`danger.*`)

Apps legitimately have delete buttons and Send buttons. The linter only
flags *unconditional* instructions to perform destructive / financial / non-
confirmed actions:

- "Always delete / remove / wipe / format"
- "Automatically transfer / send / wire money / funds / crypto"
- "Always purchase / buy / order / checkout"
- "Do not / don't / never / without ask / confirm / verify / check / prompt"
- `rm -rf`

The linter never flags single high-risk words. "Press Delete to remove the
character under the cursor" is fine; "Always delete email after reading"
is not.

## Local development

```bash
# Lint a single guide
node scripts/lint-guide.mjs youtube.json

# Lint everything
node scripts/lint-guide.mjs *.json

# Rebuild the index locally (mostly for the maintainer; CI does this nightly)
GITHUB_TOKEN=ghp_xxx node scripts/aggregate-index.mjs
```

## Review SLA

- Initial response within 7 days.
- Trust label applied at merge:
  - `trust:verified`     — curated, fetched by default
  - `trust:community`    — vetted but opt-in
  - `trust:experimental` — un-vetted, opt-in by name only
- Merged PR triggers the `aggregate-index` workflow on its next nightly
  run; the new guide appears in `clawdcursor guides available` within 24h.

## Editing an existing guide

Edits go through the same PR flow. If the change is small (a typo, a single
shortcut update), `trust:verified` is preserved automatically. Larger
changes may trigger a re-review.

If you're fixing something broken in the wild, link the user-reported
issue (file via `Report a broken guide`) in your PR. Maintainers prioritize
those.

## Removing a guide

Open a PR deleting the file with a one-line summary. The vote-issue stays
open (so prior reactions survive history) but the guide stops appearing in
`index.json` on the next aggregation.

## Code of conduct

Be kind. Be specific. Test your guides on a real install before submitting.
That's it.
