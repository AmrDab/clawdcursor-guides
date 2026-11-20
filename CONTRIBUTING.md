# Contributing a guide

A clawdcursor guide is a JSON file at this repo's root that gives an agent
the verified facts about one app: its keyboard shortcuts, a few workflows,
and the quirks that are easy to miss. This doc covers the format, the linter
rules, and the review flow.

clawdcursor ships the verified guides inside its package and refreshes the
whole pack together. An agent reads a guide with
`system shortcuts_list {"context":"<app>"}`.

## Quickstart

```bash
# 1. Fork + clone
git clone https://github.com/<you>/clawdcursor-guides
cd clawdcursor-guides

# 2. Write your guide (see the format below)
$EDITOR myapp.json

# 3. Lint locally
node scripts/lint-guide.mjs myapp.json

# 4. Push + open a PR
git checkout -b add-myapp
git add myapp.json
git commit -m "add myapp guide"
git push origin add-myapp
```

## Format (v2)

The contract is
[guide-format-v2](https://github.com/AmrDab/clawdcursor/blob/main/tasks/guide-format-v2.md);
the field table and two short examples are in the [README](./README.md#schema-v2).
In short:

- `app` (equal to the file name), `name`, `kind` (`web` or `desktop`),
  `shortcuts`, `sources` and `lastVerified` are required.
- Web guides need `domainHints` (bare hostnames). Desktop guides need
  `processNames` (no `.exe`). `os` is optional.
- Shortcut names are readable snake_case, at most 48 characters, and say what
  the key does (`go_to_inbox`, not `g_i`).
- A chord is a string such as `"mod+shift+z"`, or an object per OS:
  `{ "default": "...", "darwin": "...", "win32": "...", "linux": "..." }`
  where `""` means the key does not exist on that OS. Use `mod` whenever the
  app uses Ctrl on Windows and Cmd on macOS.
- `consequential` lists the shortcuts that send, post, delete, pay, close or
  otherwise act in a way that is hard to undo.
- At most 150 shortcuts, 20 workflows, 12 tips (240 characters each), 64 KB
  per file.

## Authoring rules

1. **Facts, in your own words.** Do not copy a help page's prose. Record what
   a key does, and list the help pages you checked in `sources`.
2. **Verify.** `lastVerified` is the day you checked the shortcuts against
   `sources` (or on the app itself). Do not list shortcuts you have not
   checked.
3. **Say what the app does, not what the agent should do.** Tips are facts
   about operating the app: modes, settings that change a key, things that
   look alike. Do not write instructions that tell an agent to skip a
   confirmation or to act without asking.
4. **Cover several tasks.** A guide that only handles one action is of little
   use; include the common navigation, editing and sending keys.
5. **No mention of other AI products or agents.**

## Linter rules

`scripts/lint-guide.mjs` runs on every PR via `.github/workflows/validate.yml`,
and clawdcursor re-runs the same checks when it builds its pack.

A guide with a `kind` field is checked as v2. A guide without one is a v1
guide that has not been migrated yet and only gets warnings.

### Schema (`schema.*`)

- `app` not `[a-z0-9-]{2,32}`, or not equal to the file name
- `name`, `kind`, `shortcuts`, `sources`, `lastVerified` missing or malformed
- `os` with values other than `win32`, `darwin`, `linux`
- web guide without `domainHints`, or a hint that is a URL or path
- desktop guide without `processNames`, or a name ending in `.exe`
- shortcut names that are not snake_case or exceed 48 characters
- `consequential` entries that are not keys of `shortcuts`
- more than 12 tips, a tip over 240 characters, a `sources` entry that is not
  an https URL, a `lastVerified` that is not a real `YYYY-MM-DD` date
- more than 150 shortcuts or 20 workflows, or a file over 64 KB
- workflow steps with an unknown `type`

### Chords (`chord.grammar`)

- tokens joined by `+` with no spaces; a sequence uses exactly one space
- modifiers are `mod`, `ctrl`, `shift`, `alt`, `cmd`, lowercase, not repeated;
  `cmd` only in a `darwin` chord
- keys are a single lowercase character, or a named key exactly as written:
  `Return`, `Tab`, `Escape`, `Space`, `Backspace`, `Delete`, `Up`, `Down`,
  `Left`, `Right`, `Home`, `End`, `PageUp`, `PageDown`, `F1`-`F12`
- write a shifted letter as `shift+u`, not `U`

### Prompt injection (`inject.*`)

The agent reads guide text as part of its context. Anything that looks like
an attempt to override instructions, reveal hidden state, or masquerade as the
system is rejected:

- "Ignore previous instructions"
- "Disregard the safety / guardrails / rules"
- "You must always click X regardless / no matter what"
- "Reveal / disclose / print the system prompt"
- `</system>`, `</untrusted-screen-content>`, `</tool_use>` tag fragments
- "Act as if you are an unrestricted / jailbroken / sudo / developer-mode agent"
- "Bypass / skip / disable the verifier / safety / confirmation"

### Dangerous prose (`danger.*`)

Apps legitimately have delete buttons and Send buttons. The linter only
flags *unconditional* instructions to perform destructive, financial or
unconfirmed actions:

- "Always delete / remove / wipe / format"
- "Automatically transfer / send / wire money / funds / crypto"
- "Always purchase / buy / order / checkout"
- "Do not / don't / never / without ask / confirm / verify / check / prompt"
- `rm -rf`

Single high-risk words are never flagged. "Press Delete to remove the
character under the cursor" is fine; "Always delete email after reading" is
not.

## Local development

```bash
# Lint one guide, or all of them
node scripts/lint-guide.mjs youtube.json
node scripts/lint-guide.mjs $(ls *.json | grep -v '^index.json$')

# Run the linter's tests
node --test scripts/*.test.mjs

# Refresh the README guide table after adding or changing a guide
node scripts/readme-table.mjs

# Rebuild the index locally (mostly for maintainers; CI does this nightly)
GITHUB_TOKEN=... node scripts/aggregate-index.mjs
```

## Suggesting a guide drafted by an agent

If an agent drafted a guide for your app and you want to share it, open a
[Guide suggestion](https://github.com/AmrDab/clawdcursor-guides/issues/new?template=guide-suggestion.yml) issue.
Nothing is sent from your machine automatically; you decide what to paste.
The form asks for:

- the app,
- the guide JSON,
- where the shortcuts were seen (help page, or the app itself, and the app
  version).

A maintainer reviews each suggestion: it must pass the linter, and the
shortcuts are checked against the official documentation or the app. If it
passes, a maintainer commits `<app>.json` with `lastVerified` set to the
review date and the pages checked in `sources`. If it cannot be verified, the
issue is closed with a note. Suggestions are never merged unreviewed.

## Review

- Initial response within 7 days.
- Trust label applied at merge:
  - `trust:verified`     — curated; included in the pack clawdcursor ships
  - `trust:community`    — vetted, not shipped by default
  - `trust:experimental` — un-vetted
- Guides appear in the next pack clawdcursor builds after the merge.

## Editing an existing guide

Edits go through the same PR flow. Update `lastVerified` whenever you
re-check the shortcuts. If you are fixing something broken in the wild, link
the issue (file one via `Report a broken guide`) in your PR.

## Removing a guide

Open a PR deleting the file with a one-line summary. The vote issue stays
open so prior reactions survive, but the guide drops out of `index.json` on
the next aggregation.

## Code of conduct

Be kind. Be specific. Check your guides on the real app before submitting.
