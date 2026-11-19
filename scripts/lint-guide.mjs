#!/usr/bin/env node
/**
 * Standalone guide linter — vendored from clawdcursor's
 * `src/llm/knowledge/guide-linter.ts`. Identical rule set so client-side
 * and CI-side validation never diverge.
 *
 * SYNC RULE — when the regex tables in clawdcursor change, this file must
 * change too. Drift between client and CI is a silent supply-chain risk:
 * a guide passing CI but failing the client would just disappear from the
 * registry without explanation. The CI run in validate.yml uses this file
 * as the gate; clawdcursor re-runs the same checks at fetch time.
 *
 * Usage:
 *   node scripts/lint-guide.mjs <guide.json> [<guide.json> ...]
 *   exit 0 → all guides pass
 *   exit 1 → at least one guide failed
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

// v2 format contract: clawdcursor/tasks/guide-format-v2.md. A guide with a
// `kind` field is checked against it in full; a guide without one is a v1
// guide that has not been migrated yet and only gets warnings.
const APP_ID_RE = /^[a-z0-9-]{2,32}$/;
const SHORTCUT_NAME_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OS_VALUES = ['win32', 'darwin', 'linux'];
const CHORD_OS_KEYS = ['default', 'darwin', 'win32', 'linux'];
const MODIFIERS = ['mod', 'ctrl', 'shift', 'alt', 'cmd'];
const NAMED_KEYS = new Set([
  'Return', 'Tab', 'Escape', 'Space', 'Backspace', 'Delete',
  'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]);
const STEP_TYPES = ['pressKey', 'typeAtFocus', 'wait', 'verify'];
const MAX_SHORTCUTS = 150;
const MAX_WORKFLOWS = 20;
const MAX_TIPS = 12;
const MAX_TIP_LEN = 240;
const MAX_NAME_LEN = 48;

const INJECTION_PATTERNS = [
  { pattern: /\bignore (?:all |any |the )?(?:previous|prior|earlier|above) (?:instructions|rules|prompts?|directives)\b/i,
    rule: 'inject.ignore_prior' },
  { pattern: /\bdisregard (?:the |all )?(?:safety|security|guardrails?|rules)\b/i,
    rule: 'inject.disregard_safety' },
  { pattern: /\byou (?:must|should|need to|will|are required to) (?:always |never )?(?:click|press|type|execute|run) [^,.;\n]{0,80}(?:regardless|no matter|even if|without (?:asking|confirming))/i,
    rule: 'inject.unconditional_action' },
  { pattern: /\b(?:reveal|disclose|print|output|show|expose) (?:the |your )?(?:system prompt|instructions|prompt|hidden (?:rules|prompt))\b/i,
    rule: 'inject.reveal_prompt' },
  { pattern: /<\/?(?:system|untrusted-screen-content|tool_use|user)>/i,
    rule: 'inject.fake_tags' },
  { pattern: /\bact as (?:if you (?:are|were)|an? unrestricted|an? jailbroken|developer mode|sudo mode)/i,
    rule: 'inject.persona_override' },
  { pattern: /\b(?:bypass|skip|disable|turn off) (?:the |all )?(?:safety|verifier|verification|confirmation|guards?|checks?)\b/i,
    rule: 'inject.bypass_safety' },
];

const DANGEROUS_PROSE = [
  { pattern: /\b(?:always|automatically) (?:delete|remove|purge|wipe|format)\b/i,
    rule: 'danger.always_destroy' },
  { pattern: /\b(?:always|automatically) (?:transfer|send|wire) (?:money|funds|cryptocurrency|crypto|bitcoin|btc|eth)\b/i,
    rule: 'danger.always_transfer' },
  { pattern: /\b(?:always|automatically) (?:purchase|buy|order|checkout)\b/i,
    rule: 'danger.always_purchase' },
  { pattern: /\b(?:do not|don't|never|without) (?:ask|asking|confirm|confirming|verify|verifying|check|checking|prompt|prompting)(?:\s+(?:the user|first|before))?/i,
    rule: 'danger.skip_confirmation' },
  { pattern: /\brm\s+-rf\b/i,
    rule: 'danger.rm_rf' },
];

const URL_OR_PATH_RE = /^(?:https?:\/\/|\/|\.\/|\.\.\/)/i;
const VALID_DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

function collectStrings(guide) {
  const out = [];
  for (let i = 0; i < (guide.tips ?? []).length; i++) {
    if (typeof guide.tips[i] === 'string') {
      out.push({ value: guide.tips[i], location: `tips[${i}]` });
    }
  }
  for (const [key, wf] of Object.entries(guide.workflows ?? {})) {
    if (typeof wf === 'string') {
      out.push({ value: wf, location: `workflows.${key}` });
    } else if (wf && typeof wf === 'object') {
      if (typeof wf.name === 'string') out.push({ value: wf.name, location: `workflows.${key}.name` });
      for (let i = 0; i < (wf.steps ?? []).length; i++) {
        if (typeof wf.steps[i].note === 'string') {
          out.push({ value: wf.steps[i].note, location: `workflows.${key}.steps[${i}].note` });
        }
      }
    }
  }
  for (const [region, desc] of Object.entries(guide.layout ?? {})) {
    if (typeof desc === 'string') out.push({ value: desc, location: `layout.${region}` });
  }
  for (const [key, prose] of Object.entries(guide.learnedWorkflows ?? {})) {
    if (typeof prose === 'string') out.push({ value: prose, location: `learnedWorkflows.${key}` });
  }
  return out;
}

/** Returns an error message for a malformed chord string, or null if valid. */
function chordProblem(chord, { allowCmd = true } = {}) {
  if (typeof chord !== 'string' || chord === '') return 'chord must be a non-empty string';
  for (const part of chord.split(' ')) {
    if (part === '') return `chord "${chord}" has a leading, trailing or doubled space; separate sequence steps with exactly one space`;
    const tokens = part.split('+');
    if (tokens.some(t => t === '')) return `chord "${part}" has an empty token; join tokens with "+" and no spaces`;
    const key = tokens[tokens.length - 1];
    const seen = new Set();
    for (const m of tokens.slice(0, -1)) {
      if (!MODIFIERS.includes(m)) return `"${m}" in "${part}" is not a modifier (use ${MODIFIERS.join(', ')}, lowercase)`;
      if (m === 'cmd' && !allowCmd) return `"cmd" in "${part}" is macOS only; use "mod" or put the chord under "darwin"`;
      if (seen.has(m)) return `modifier "${m}" repeated in "${part}"`;
      seen.add(m);
    }
    if (NAMED_KEYS.has(key)) continue;
    if (MODIFIERS.includes(key)) return `"${part}" ends in a modifier; a chord needs a key`;
    if ([...key].length !== 1) return `"${key}" in "${part}" is not a key (named keys: ${[...NAMED_KEYS].join(', ')})`;
    if (key !== key.toLowerCase()) return `key "${key}" in "${part}" must be lowercase; write shift+${key.toLowerCase()} for a shifted letter`;
  }
  return null;
}

/** Lint a shortcut value (string or per-OS object). Pushes errors onto `findings`. */
function checkChordValue(value, location, findings) {
  const err = (message) => findings.push({ severity: 'error', rule: 'chord.grammar', message, location });
  if (typeof value === 'string') {
    const p = chordProblem(value, { allowCmd: false });
    if (p) err(p);
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    err('chord must be a string or an object keyed by default/darwin/win32/linux');
    return;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) err('per-OS chord object must not be empty');
  for (const k of keys) {
    if (!CHORD_OS_KEYS.includes(k)) {
      err(`unknown OS key "${k}" (allowed: ${CHORD_OS_KEYS.join(', ')})`);
      continue;
    }
    if (value[k] === '') continue; // "not on this OS"
    const p = chordProblem(value[k], { allowCmd: k === 'darwin' });
    if (p) err(`${k}: ${p}`);
  }
}

function lintV2(raw, fileName, findings) {
  const err = (rule, message, location) => findings.push({ severity: 'error', rule, message, location });

  if (!APP_ID_RE.test(raw.app)) {
    err('schema.app', `app must match [a-z0-9-]{2,32} (got "${raw.app}")`, '$.app');
  }
  if (fileName && fileName !== `${raw.app}.json`) {
    err('schema.app', `app "${raw.app}" must equal the file name without .json (file is ${fileName})`, '$.app');
  }
  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    err('schema.name', 'name (display name) is required', '$.name');
  }
  if (raw.kind !== 'web' && raw.kind !== 'desktop') {
    err('schema.kind', `kind must be "web" or "desktop" (got ${JSON.stringify(raw.kind)})`, '$.kind');
  }
  if (raw.os !== undefined &&
      (!Array.isArray(raw.os) || raw.os.length === 0 || raw.os.some(o => !OS_VALUES.includes(o)))) {
    err('schema.os', `os must be a non-empty array of ${OS_VALUES.join(', ')}; omit it for every OS`, '$.os');
  }

  if (raw.kind === 'web') {
    if (!Array.isArray(raw.domainHints) || raw.domainHints.length === 0) {
      err('schema.domainHints', 'web guides need a non-empty domainHints array', '$.domainHints');
    } else {
      raw.domainHints.forEach((h, i) => {
        if (typeof h !== 'string' || !VALID_DOMAIN_RE.test(h)) {
          err('schema.domainHints', `domainHints[${i}] must be a bare hostname such as "docs.google.com"`, `domainHints[${i}]`);
        }
      });
    }
  }
  if (raw.kind === 'desktop') {
    if (!Array.isArray(raw.processNames) || raw.processNames.length === 0) {
      err('schema.processNames', 'desktop guides need a non-empty processNames array', '$.processNames');
    } else {
      raw.processNames.forEach((p, i) => {
        if (typeof p !== 'string' || !p.trim() || /\.exe$/i.test(p) || /[\\/]/.test(p)) {
          err('schema.processNames', `processNames[${i}] must be a process name without ".exe" or a path`, `processNames[${i}]`);
        }
      });
    }
  }

  const names = raw.shortcuts && typeof raw.shortcuts === 'object' && !Array.isArray(raw.shortcuts)
    ? Object.keys(raw.shortcuts) : null;
  if (raw.shortcuts === undefined) {
    err('schema.shortcuts', 'shortcuts is required', '$.shortcuts');
  } else if (names) {
    if (names.length > MAX_SHORTCUTS) err('schema.caps', `${names.length} shortcuts; max ${MAX_SHORTCUTS}`, '$.shortcuts');
    for (const n of names) {
      if (n.length > MAX_NAME_LEN || !SHORTCUT_NAME_RE.test(n)) {
        err('schema.shortcutName', `shortcut name "${n}" must be snake_case, at most ${MAX_NAME_LEN} characters`, `shortcuts.${n}`);
      }
      checkChordValue(raw.shortcuts[n], `shortcuts.${n}`, findings);
    }
  }

  if (raw.consequential !== undefined) {
    if (!Array.isArray(raw.consequential) || raw.consequential.some(c => typeof c !== 'string')) {
      err('schema.consequential', 'consequential must be an array of shortcut names', '$.consequential');
    } else if (names) {
      for (const c of raw.consequential) {
        if (!names.includes(c)) err('schema.consequential', `"${c}" is not a key of shortcuts`, '$.consequential');
      }
    }
  }

  if (raw.workflows && typeof raw.workflows === 'object' && !Array.isArray(raw.workflows)) {
    const ids = Object.keys(raw.workflows);
    if (ids.length > MAX_WORKFLOWS) err('schema.caps', `${ids.length} workflows; max ${MAX_WORKFLOWS}`, '$.workflows');
    for (const id of ids) {
      const wf = raw.workflows[id];
      if (typeof wf === 'string') continue;
      if (!wf || typeof wf !== 'object' || Array.isArray(wf)) {
        err('schema.workflows', 'workflow must be a prose string or { name, steps }', `workflows.${id}`);
        continue;
      }
      if (typeof wf.name !== 'string' || !wf.name) err('schema.workflows', 'workflow.name must be a non-empty string', `workflows.${id}.name`);
      if (!Array.isArray(wf.steps)) {
        err('schema.workflows', 'workflow.steps must be an array', `workflows.${id}.steps`);
        continue;
      }
      wf.steps.forEach((step, i) => {
        const loc = `workflows.${id}.steps[${i}]`;
        if (!step || typeof step !== 'object' || !STEP_TYPES.includes(step.type)) {
          err('schema.workflows', `step type must be one of ${STEP_TYPES.join(', ')}`, loc);
          return;
        }
        if (step.type === 'pressKey') {
          const p = chordProblem(step.key);
          if (p) err('chord.grammar', `pressKey key: ${p}`, `${loc}.key`);
        }
        if (step.type === 'wait' && !(Number.isFinite(step.ms) && step.ms >= 0)) {
          err('schema.workflows', 'wait step needs a numeric ms', `${loc}.ms`);
        }
      });
    }
  }

  if (Array.isArray(raw.tips)) {
    if (raw.tips.length > MAX_TIPS) err('schema.caps', `${raw.tips.length} tips; max ${MAX_TIPS}`, '$.tips');
    raw.tips.forEach((t, i) => {
      if (typeof t !== 'string') err('schema.tips', 'tip must be a string', `tips[${i}]`);
      else if (t.length > MAX_TIP_LEN) err('schema.tips', `tip is ${t.length} characters; max ${MAX_TIP_LEN}`, `tips[${i}]`);
    });
  }

  if (!Array.isArray(raw.sources) || raw.sources.length === 0) {
    err('schema.sources', 'sources must be a non-empty array of https URLs', '$.sources');
  } else {
    raw.sources.forEach((u, i) => {
      let ok = false;
      try { ok = typeof u === 'string' && new URL(u).protocol === 'https:'; } catch { /* */ }
      if (!ok) err('schema.sources', `sources[${i}] must be an https URL`, `sources[${i}]`);
    });
  }
  const d = raw.lastVerified;
  const dateOk = typeof d === 'string' && DATE_RE.test(d) &&
    !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
  if (!dateOk) err('schema.lastVerified', 'lastVerified must be a real date, "YYYY-MM-DD"', '$.lastVerified');
}

function lintV1Warnings(raw, fileName, findings) {
  findings.push({ severity: 'warning', rule: 'v1.not_migrated', location: '$',
    message: 'v1 guide (no "kind"): add the v2 fields (kind, name, sources, lastVerified, ...); it is only fully checked once it has "kind"' });
  if (fileName && fileName !== `${raw.app}.json`) {
    findings.push({ severity: 'warning', rule: 'schema.app', location: '$.app',
      message: `app "${raw.app}" does not match the file name ${fileName}` });
  }
}

export function lintGuide(raw, fileName) {
  const findings = [];

  if (!raw || typeof raw !== 'object') {
    findings.push({ severity: 'error', rule: 'schema.shape', message: 'guide must be a JSON object', location: '$' });
    return { ok: false, findings };
  }
  if (typeof raw.app !== 'string' || !raw.app) {
    findings.push({ severity: 'error', rule: 'schema.app', message: 'guide.app must be a non-empty string', location: '$.app' });
    return { ok: false, findings };
  }
  if (raw.name !== undefined && typeof raw.name !== 'string') {
    findings.push({ severity: 'error', rule: 'schema.name', message: 'guide.name must be a string', location: '$.name' });
  }
  for (const key of ['shortcuts', 'layout', 'workflows', 'learnedWorkflows']) {
    if (raw[key] !== undefined && (typeof raw[key] !== 'object' || Array.isArray(raw[key]))) {
      findings.push({ severity: 'error', rule: `schema.${key}`, message: `guide.${key} must be an object`, location: `$.${key}` });
    }
  }
  if (raw.tips !== undefined && !Array.isArray(raw.tips)) {
    findings.push({ severity: 'error', rule: 'schema.tips', message: 'guide.tips must be an array of strings', location: '$.tips' });
  }
  if (raw.domainHints !== undefined && !Array.isArray(raw.domainHints)) {
    findings.push({ severity: 'error', rule: 'schema.domainHints', message: 'guide.domainHints must be an array of strings', location: '$.domainHints' });
  }
  if (findings.some(f => f.severity === 'error')) {
    return { ok: false, findings };
  }

  if (Array.isArray(raw.domainHints)) {
    for (let i = 0; i < raw.domainHints.length; i++) {
      const h = raw.domainHints[i];
      if (typeof h !== 'string') {
        findings.push({ severity: 'error', rule: 'schema.domainHints', message: `domainHints[${i}] must be a string`, location: `domainHints[${i}]` });
        continue;
      }
      if (URL_OR_PATH_RE.test(h)) {
        findings.push({ severity: 'error', rule: 'schema.domainHints',
          message: `domainHints must be bare domains, not URLs or paths (got "${h}")`,
          location: `domainHints[${i}]` });
      } else if (!VALID_DOMAIN_RE.test(h)) {
        findings.push({ severity: 'warning', rule: 'schema.domainHints',
          message: `domainHints[${i}] doesn't look like a valid domain`,
          location: `domainHints[${i}]` });
      }
    }
  }

  for (const { value, location } of collectStrings(raw)) {
    for (const { pattern, rule } of INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        findings.push({ severity: 'error', rule, message: `text contains a prompt-injection pattern (${rule})`, location });
      }
    }
    for (const { pattern, rule } of DANGEROUS_PROSE) {
      if (pattern.test(value)) {
        findings.push({ severity: 'error', rule, message: `text instructs an unconditional dangerous action (${rule})`, location });
      }
    }
  }

  if (raw.kind !== undefined) lintV2(raw, fileName, findings);
  else lintV1Warnings(raw, fileName, findings);

  let approxSize = 0;
  try { approxSize = JSON.stringify(raw).length; } catch { /* */ }
  if (approxSize > 64_000) {
    findings.push({ severity: 'error', rule: 'schema.size', message: `guide is ${approxSize} bytes; max 64 KB`, location: '$' });
  }

  return { ok: !findings.some(f => f.severity === 'error'), findings };
}

function formatReport(label, result) {
  if (result.ok && result.findings.length === 0) return `${label}: OK`;
  const lines = [`${label}: ${result.ok ? 'OK with warnings' : 'FAILED'}`];
  for (const f of result.findings) {
    const tag = f.severity === 'error' ? '✗ ERROR' : '⚠ WARN';
    lines.push(`  ${tag}  ${f.rule}  @ ${f.location}: ${f.message}`);
  }
  return lines.join('\n');
}

// ── CLI ──
function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node scripts/lint-guide.mjs <file.json> [<file.json> ...]');
    process.exit(2);
  }
  
  let failed = false;
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`${basename(file)}: FAILED (JSON parse: ${err.message})`);
      failed = true;
      continue;
    }
    const result = lintGuide(parsed, basename(file));
    console.log(formatReport(basename(file), result));
    if (!result.ok) failed = true;
  }
  
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
