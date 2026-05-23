#!/usr/bin/env node
/**
 * Index aggregator — rebuilds index.json from the guides in this repo's
 * root + vote-issue reactions on the GitHub repo.
 *
 * Schema (matches RegistryIndex in clawdcursor's remote-loader.ts):
 *   {
 *     "schemaVersion": 1,
 *     "generatedAt": "<ISO timestamp>",
 *     "guides": {
 *       "<app>": {
 *         "version": "1.0.0",
 *         "trust": "verified" | "community" | "experimental",
 *         "upvotes": <count>,
 *         "downvotes": <count>,
 *         "submitter": "@user",
 *         "etag": "sha1-content-hash"
 *       }
 *     }
 *   }
 *
 * Trust level is read from the corresponding `vote: <app>` issue's labels.
 * If the issue has label `trust:verified`, the guide is verified. Same for
 * `trust:community` and `trust:experimental`. Default if no label: community.
 *
 * Upvotes/downvotes are 👍 and 👎 reactions on the issue body.
 *
 * Run by .github/workflows/aggregate.yml on a nightly schedule.
 *
 * Env:
 *   GITHUB_TOKEN  — required, must have read access to issues + reactions
 *   GH_REPO       — "owner/repo", default "AmrDab/clawdcursor-guides"
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import * as crypto from 'node:crypto';

const REPO = process.env.GH_REPO || 'AmrDab/clawdcursor-guides';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(2);
}

async function ghApi(path, opts = {}) {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Accept': 'application/vnd.github+json',
      ...opts.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status}`);
  return res.json();
}

async function listVoteIssues() {
  // GET /repos/{owner}/{repo}/issues?labels=vote&state=open&per_page=100
  // Falls back to title filter if no `vote` label is in use.
  const issues = await ghApi(`/repos/${REPO}/issues?state=all&per_page=100`);
  return issues.filter(i => typeof i.title === 'string' && i.title.toLowerCase().startsWith('vote:'));
}

async function reactionsFor(issueNumber) {
  // GET /repos/{owner}/{repo}/issues/{n}/reactions
  const r = await ghApi(`/repos/${REPO}/issues/${issueNumber}/reactions`);
  let up = 0, down = 0;
  for (const reaction of r) {
    if (reaction.content === '+1' || reaction.content === 'heart' || reaction.content === 'hooray') up++;
    if (reaction.content === '-1' || reaction.content === 'confused') down++;
  }
  return { up, down };
}

function trustFromLabels(labels) {
  for (const l of labels) {
    const name = (l.name || '').toLowerCase();
    if (name === 'trust:verified')     return 'verified';
    if (name === 'trust:community')    return 'community';
    if (name === 'trust:experimental') return 'experimental';
  }
  return 'community';
}

function appFromTitle(title) {
  // "vote: youtube" → "youtube"
  const m = title.match(/^vote:\s*([a-z0-9_-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

async function main() {
  // 1. Scan repo root for *.json guides (everything except index.json).
  const files = readdirSync('.')
    .filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'package.json' && f !== 'package-lock.json');

  const guides = {};
  for (const file of files) {
    const app = file.replace(/\.json$/, '');
    let parsed = {};
    try { parsed = JSON.parse(readFileSync(file, 'utf8')); }
    catch { console.warn(`skipping malformed ${file}`); continue; }

    const content = readFileSync(file);
    const etag = crypto.createHash('sha1').update(content).digest('hex').slice(0, 16);

    guides[app] = {
      version: parsed.version || '1.0.0',
      trust: 'community', // default; vote-issue label overrides below
      upvotes: 0,
      downvotes: 0,
      etag,
    };
  }

  // 2. Walk vote issues to overlay trust + ratings.
  try {
    const issues = await listVoteIssues();
    for (const issue of issues) {
      const app = appFromTitle(issue.title);
      if (!app || !guides[app]) continue;
      const { up, down } = await reactionsFor(issue.number);
      guides[app].upvotes = up;
      guides[app].downvotes = down;
      guides[app].trust = trustFromLabels(issue.labels || []);
      if (issue.user?.login) guides[app].submitter = '@' + issue.user.login;
    }
  } catch (err) {
    console.warn('vote-issue aggregation failed (proceeding without ratings):', err.message);
  }

  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    guides,
  };

  writeFileSync('index.json', JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote index.json with ${Object.keys(guides).length} guides.`);
}

main().catch(err => { console.error(err); process.exit(1); });
