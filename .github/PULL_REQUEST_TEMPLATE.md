<!--
Thanks for contributing a guide!

Before submitting, please:
  1. Run `node scripts/lint-guide.mjs <yourfile>.json` locally — CI runs the same linter.
  2. Read CONTRIBUTING.md if you haven't.
-->

## What

<!-- One sentence: which app, what changed. -->
<!-- e.g. "Add discord.json — 27 shortcuts + 5 workflows for voice + DM". -->

## Why

<!-- What's the agent's task it should be able to handle now that it couldn't before? -->

## Checklist

- [ ] File is at the repo root (`<app>.json`), not in a subdirectory.
- [ ] `app` field is lowercase, no spaces (matches the filename).
- [ ] `node scripts/lint-guide.mjs <file>` passes locally.
- [ ] Workflows are prose hints, not rigid step machines (unless the steps are genuinely deterministic).
- [ ] Tips cover real failure modes — what trips the agent up, not just nice-to-knows.
- [ ] No content tells the agent to perform unconditional destructive / financial actions.
- [ ] No content includes "ignore previous instructions" or similar prompt-injection patterns.

## Trust level

<!--
Maintainers will apply a label after review:
  trust:verified     — fetched by default. ~12 guides at launch.
  trust:community    — vetted PR, available with opt-in.
  trust:experimental — un-vetted, opt-in only.
Don't add the label yourself.
-->
