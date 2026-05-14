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

function lintGuide(raw) {
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
  const result = lintGuide(parsed);
  console.log(formatReport(basename(file), result));
  if (!result.ok) failed = true;
}

process.exit(failed ? 1 : 0);
