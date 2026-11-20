# clawdcursor-guides

Verified app guides for [clawdcursor](https://github.com/AmrDab/clawdcursor),
served at <https://clawdcursor.com/app-guides>.

## What this is

clawdcursor is a free, open-source MCP server that lets an AI use a real
computer. For popular apps, the keyboard shortcuts, workflow patterns and
quirks are well known, and an **app guide** gives the agent those facts up
front instead of having it rediscover them from the screen.

A guide is a single JSON file at this repo's root, named `<app>.json`.
clawdcursor ships the verified guides inside its package and refreshes the
whole pack at once; it does not fetch guides one by one. Agents read a guide
through the `system` tool: `system shortcuts_list {"context":"<app>"}`.

Guides an agent saves on a user's own machine (with the user's OK) live in
`~/.clawdcursor/guides/<app>.json`, use the same format, and are never
uploaded or fetched from the network.

## Browse guides

<!-- guides-table:start -->
| App | Kind | Platform | Shortcuts | Workflows | Tips | Verified |
|---|---|---|---|---|---|---|
| [Google Chrome](./chrome.json) | desktop | Windows, macOS, Linux | 60 | 3 | 8 | 2026-11-18 |
| [Discord](./discord.json) | desktop | Windows | 31 | 1 | 4 | 2026-11-18 |
| [Microsoft Edge](./edge.json) | desktop | Windows, macOS | 64 | 2 | 7 | 2026-11-18 |
| [Microsoft Excel](./excel.json) | desktop | Windows, macOS | 121 | 4 | 8 | 2026-11-18 |
| [Figma](./figma.json) | desktop | all | 46 | 2 | 8 | 2026-11-18 |
| [File Explorer](./file-explorer.json) | desktop | Windows | 41 | 3 | 6 | 2026-11-18 |
| [Finder](./finder.json) | desktop | macOS | 54 | 2 | 6 | 2026-11-18 |
| [GitHub](./github.json) | web | all | 70 | 3 | 7 | 2026-11-18 |
| [Gmail](./gmail.json) | web | all | 84 | 3 | 8 | 2026-11-18 |
| [Google Calendar](./google-calendar.json) | web | all | 21 | 1 | 6 | 2026-11-18 |
| [Google Docs](./google-docs.json) | web | all | 133 | 1 | 12 | 2026-11-18 |
| [Google Drive](./google-drive.json) | web | all | 61 | 1 | 7 | 2026-11-18 |
| [Google Maps](./google-maps.json) | web | all | 13 | – | 6 | 2026-11-18 |
| [Google Sheets](./google-sheets.json) | web | all | 92 | 3 | 10 | 2026-11-18 |
| [Jira](./jira.json) | web | all | 27 | 1 | 5 | 2026-11-18 |
| [Linear](./linear.json) | web | all | 66 | 3 | 9 | 2026-11-18 |
| [LinkedIn](./linkedin.json) | web | all | 17 | 2 | 6 | 2026-11-18 |
| [Paint](./mspaint.json) | desktop | Windows | 9 | 4 | 5 | 2026-11-18 |
| [Notion](./notion.json) | desktop | all | 53 | 2 | 9 | 2026-11-18 |
| [Outlook (new)](./olk.json) | desktop | Windows | 37 | 2 | 8 | 2026-11-18 |
| [Outlook (classic)](./outlook.json) | desktop | Windows | 54 | 3 | 8 | 2026-11-18 |
| [Microsoft PowerPoint](./powerpoint.json) | desktop | Windows, macOS | 96 | 2 | 7 | 2026-11-18 |
| [Reddit](./reddit.json) | web | all | 25 | 1 | 6 | 2026-11-18 |
| [Slack](./slack.json) | desktop | all | 63 | 2 | 9 | 2026-11-18 |
| [Spotify](./spotify.json) | desktop | all | 28 | 1 | 3 | 2026-11-18 |
| [Microsoft Teams](./teams.json) | desktop | Windows, macOS | 71 | 3 | 8 | 2026-11-18 |
| [Trello](./trello.json) | web | all | 46 | 3 | 8 | 2026-11-18 |
| [Visual Studio Code](./vscode.json) | desktop | Windows, macOS, Linux | 114 | 4 | 9 | 2026-11-18 |
| [WhatsApp Web](./whatsapp-web.json) | web | all | 15 | – | 3 | 2026-11-18 |
| [Microsoft Word](./word.json) | desktop | Windows, macOS | 118 | 4 | 8 | 2026-11-18 |
| [X](./x-com.json) | web | all | 25 | 3 | 5 | 2026-11-18 |
| [YouTube](./youtube.json) | web | all | 34 | 1 | 8 | 2026-11-18 |
<!-- guides-table:end -->

Regenerate this table with `node scripts/readme-table.mjs`. See
[`index.json`](./index.json) for machine-readable metadata (auto-generated
nightly from this repo and vote-issue reactions). Guides without a `kind`
are in the older v1 format and are being migrated to v2.

## Submitting

See [CONTRIBUTING.md](./CONTRIBUTING.md). Short version:

1. Write `<app>.json` in the v2 format (see below).
2. Run `node scripts/lint-guide.mjs <app>.json` locally.
3. Open a PR. CI re-runs the linter; a maintainer reviews it against the
   official help pages listed in `sources`.

### Guides drafted by an agent

When an agent has drafted a guide for an app that is not covered, its user
can choose to send it here. Nothing is sent automatically. The user opens a
[Guide suggestion](https://github.com/AmrDab/clawdcursor-guides/issues/new?template=guide-suggestion.yml) issue and
pastes the JSON, the app, and where the shortcuts were seen (including the
app version).

A maintainer reviews every suggestion by hand:

1. The JSON must pass `node scripts/lint-guide.mjs` (format, chord grammar,
   injection and danger rules).
2. Each shortcut is checked against the app's official documentation, or on
   the app itself, and the pages are recorded in `sources`.
3. Accepted guides are committed as `<app>.json` by a maintainer with
   `lastVerified` set to the day they were checked. Only then do they enter
   the pack that clawdcursor ships. Suggestions that cannot be verified are
   closed with a note.

## Voting

Every guide has a `vote: <app>` Issue. React with 👍 to upvote or 👎 to
downvote. The nightly aggregator counts reactions and writes them into
`index.json`.

## Trust levels

Maintainers label merged PRs with one of:

- `trust:verified` — curated; included in the pack clawdcursor ships
- `trust:community` — vetted PR, not shipped by default
- `trust:experimental` — un-vetted

## Schema (v2)

The contract is
[guide-format-v2](https://github.com/AmrDab/clawdcursor/blob/main/tasks/guide-format-v2.md).
Fields:

| Field | Required | Notes |
|---|---|---|
| `app` | yes | lowercase id, `[a-z0-9-]{2,32}`, equal to the file name |
| `name` | yes | display name |
| `kind` | yes | `"web"` or `"desktop"` |
| `os` | no | any of `win32`, `darwin`, `linux`; omitted = every OS |
| `domainHints` | web | bare hostnames, no scheme or path |
| `processNames` | desktop | process names without `.exe` |
| `shortcuts` | yes | `{ name: chord }`; chord is a string or a per-OS object |
| `consequential` | no | shortcut names that are hard to undo (send, delete, pay, close) |
| `workflows` | no | `{ id: { name, steps } }`, or a prose string |
| `layout` | no | `{ region: short description }` |
| `tips` | no | up to 12 strings, 240 characters each |
| `sources` | yes | https URLs of the official help pages |
| `lastVerified` | yes | `YYYY-MM-DD`, the day the shortcuts were checked |

Chords are tokens joined by `+` (`mod+shift+z`); a sequence is separated by
one space (`g i`). Modifiers are `mod` (Ctrl on Windows and Linux, Cmd on
macOS), `ctrl`, `shift`, `alt`, `cmd`. Named keys are `Return`, `Tab`,
`Escape`, `Space`, `Backspace`, `Delete`, `Up`, `Down`, `Left`, `Right`,
`Home`, `End`, `PageUp`, `PageDown` and `F1`–`F12`.

A web app:

```jsonc
{
  "app": "gmail",
  "name": "Gmail",
  "kind": "web",
  "domainHints": ["mail.google.com"],
  "shortcuts": {
    "compose": "c",
    "go_to_inbox": "g i",
    "send": "mod+Return"
  },
  "consequential": ["send"],
  "tips": ["Single-letter shortcuts only work when they are turned on in Gmail settings."],
  "sources": ["https://support.google.com/mail/answer/6594"],
  "lastVerified": "2026-11-18"
}
```

A desktop app, with a per-OS chord (`""` means the key does not exist there):

```jsonc
{
  "app": "excel",
  "name": "Microsoft Excel",
  "kind": "desktop",
  "os": ["win32", "darwin"],
  "processNames": ["EXCEL"],
  "shortcuts": {
    "bold": "mod+b",
    "edit_cell": { "win32": "F2", "darwin": "ctrl+u" }
  },
  "sources": ["https://support.microsoft.com/office/keyboard-shortcuts-in-excel"],
  "lastVerified": "2026-11-18"
}
```

The linter in [`scripts/lint-guide.mjs`](./scripts/lint-guide.mjs) is the
source of truth for what is accepted and what is rejected. clawdcursor runs
the same rules when it builds its pack.

## License

[MIT](./LICENSE)
