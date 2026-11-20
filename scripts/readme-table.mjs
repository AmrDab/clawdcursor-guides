#!/usr/bin/env node
/**
 * Regenerates the "Browse guides" table in README.md from the guide files,
 * between the <!-- guides-table:start --> and <!-- guides-table:end --> markers.
 *
 * Usage: node scripts/readme-table.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const START = '<!-- guides-table:start -->';
const END = '<!-- guides-table:end -->';
const OS_LABEL = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

const files = readdirSync('.')
  .filter(f => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('package'))
  .sort();

const rows = ['| App | Kind | Platform | Shortcuts | Workflows | Tips | Verified |', '|---|---|---|---|---|---|---|'];
for (const file of files) {
  let g;
  try { g = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
  const count = (o) => (o && typeof o === 'object' ? Object.keys(o).length : 0);
  const dash = (n) => (n ? String(n) : '–');
  const kind = g.kind ?? '–';
  const platform = Array.isArray(g.os) && g.os.length ? g.os.map(o => OS_LABEL[o] ?? o).join(', ') : 'all';
  const title = typeof g.name === 'string' && g.name ? g.name : file.replace(/\.json$/, '');
  rows.push(`| [${title}](./${file}) | ${kind} | ${platform} | ${count(g.shortcuts)} | ${dash(count(g.workflows))} | ${dash(Array.isArray(g.tips) ? g.tips.length : 0)} | ${g.lastVerified ?? '–'} |`);
}

const readme = readFileSync('README.md', 'utf8');
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a === -1 || b === -1 || b < a) {
  console.error(`README.md needs ${START} and ${END} markers`);
  process.exit(1);
}
writeFileSync('README.md', readme.slice(0, a + START.length) + '\n' + rows.join('\n') + '\n' + readme.slice(b));
console.log(`Wrote ${files.length} rows to README.md`);
