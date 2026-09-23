/**
 * Golden-set evaluation against the real Gemini API (AI_PIPELINE §8). Manual only — it needs a
 * key and spends quota, so it never runs in CI. Usage:
 *
 *   echo GEMINI_API_KEY=... > .env.local   (gitignored)
 *   npm run eval
 *
 * Prints a Markdown table to paste into the README. The key is read from .env.local or the
 * environment, sent only as a request header, and never printed.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { segmentClauses } from '../src/core/parsing/segmenter';
import { analyseDocument } from '../src/core/analysis';
import { generateContent, repairJson } from '../src/core/gemini/client';
import { redact } from '../src/core/gemini/errors';
import {
  buildAnalysisUserPrompt,
  buildAskUserPrompt,
  buildSystemPreamble,
} from '../src/core/gemini/prompts';
import { ANALYSIS_SCHEMA, ASK_SCHEMA, DEFAULT_MODEL } from '../src/core/gemini/responseSchemas';
import { processAskResponse } from '../src/core/gemini/processors';
import {
  askCorrect,
  goldenAnswers,
  goldenExpectedSchema,
  rate,
  scoreAnalysis,
  scoreRules,
  type Tally,
} from '../src/core/eval/golden';

const DIR = 'tests/fixtures/agreements';

function readEnvFile(): Record<string, string> {
  if (!existsSync('.env.local')) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]!] = m[2]!.replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = { ...readEnvFile(), ...process.env };
const apiKey = env.GEMINI_API_KEY ?? '';
const model = env.VITE_DEFAULT_MODEL || DEFAULT_MODEL;
const system = buildSystemPreamble({ language: 'en', readingLevel: 'standard', city: null });

const add = (a: Tally, b: Tally): Tally => ({ hit: a.hit + b.hit, total: a.total + b.total });
// Nothing measured shows as a dash, never as a flattering 100%.
const pct = (t: Tally) =>
  t.total === 0 ? '— (not measured)' : `${(rate(t) * 100).toFixed(0)}% (${t.hit}/${t.total})`;
const percentile = (xs: number[], p: number) =>
  xs.length
    ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!
    : 0;

async function callJson(userPrompt: string, schema: object, maxOutputTokens: number) {
  const started = performance.now();
  const { text } = await generateContent({
    model,
    apiKey,
    system,
    userPrompt,
    responseSchema: schema,
    temperature: 0.2,
    maxOutputTokens,
  });
  return { json: JSON.parse(repairJson(text)) as unknown, ms: performance.now() - started };
}

async function main() {
  const names = readdirSync(DIR)
    .filter(f => f.endsWith('.txt'))
    .map(f => f.replace(/\.txt$/, ''))
    .sort();

  let rulesRecall: Tally = { hit: 0, total: 0 };
  let rulesPrecision: Tally = { hit: 0, total: 0 };
  let verdicts: Tally = { hit: 0, total: 0 };
  let absence: Tally = { hit: 0, total: 0 };
  let quotes: Tally = { hit: 0, total: 0 };
  let refusals: Tally = { hit: 0, total: 0 };
  let answers: Tally = { hit: 0, total: 0 };
  const latencies: number[] = [];

  for (const name of names) {
    const text = readFileSync(`${DIR}/${name}.txt`, 'utf8');
    const expected = goldenExpectedSchema.parse(
      JSON.parse(readFileSync(`${DIR}/${name}.expected.json`, 'utf8'))
    );
    const clauses = segmentClauses(text);
    const interview = goldenAnswers(expected);

    const local = analyseDocument({ answers: interview, clauses, localOnly: true });
    const rules = scoreRules(local, expected);
    rulesRecall = add(rulesRecall, rules.recall);
    rulesPrecision = add(rulesPrecision, rules.precision);
    if (!apiKey) continue;

    try {
      const analysis = await callJson(
        buildAnalysisUserPrompt(interview, clauses),
        ANALYSIS_SCHEMA,
        8192
      );
      latencies.push(analysis.ms);
      const result = analyseDocument({ answers: interview, clauses, modelResponse: analysis.json });
      const s = scoreAnalysis(result, expected);
      verdicts = add(verdicts, s.verdicts);
      for (const [key, want] of Object.entries(expected.expectVerdicts)) {
        const got = result.matches.find(m => m.key === key)?.verdict ?? 'no row';
        if (got !== want) console.log(`  ${name}: ${key} expected ${want}, got ${got}`);
      }
      for (const id of expected.expectAbsent) {
        const got = result.gaps.find(g => g.id === id)?.state;
        if (got !== 'absent') console.log(`  ${name}: ${id} expected absent, got ${got}`);
      }
      absence = add(absence, s.absence);
      quotes = add(quotes, s.quotes);

      for (const q of expected.questions) {
        const ask = await callJson(buildAskUserPrompt(q.q, clauses), ASK_SCHEMA, 1536);
        const res = processAskResponse({ clauses, modelResponse: ask.json });
        const ok = askCorrect(res, q, clauses);
        if (q.expect === 'not_in_document') refusals = add(refusals, { hit: ok ? 1 : 0, total: 1 });
        else answers = add(answers, { hit: ok ? 1 : 0, total: 1 });
      }
      console.log(`✓ ${name}`);
    } catch (e) {
      const err = e as { code?: string; details?: string; message?: string };
      const why = err.code
        ? `${err.code}${err.details ? ` — ${err.details.replace(/\s+/g, ' ').slice(0, 240)}` : ''}`
        : String(err.message ?? e);
      console.log(`✗ ${name}: ${redact(why)}`);
      process.exitCode = 1;
    }
  }

  const rows: Array<[string, string, string]> = [
    ['Rule recall (offline)', pct(rulesRecall), '100%'],
    ['Rule precision (offline)', pct(rulesPrecision), '100%'],
  ];
  if (apiKey) {
    rows.push(
      ['Quote verification rate', pct(quotes), '≥ 95%'],
      ['Verdict accuracy', pct(verdicts), '≥ 90%'],
      ['Absence detection', pct(absence), '100%'],
      ['Refusal accuracy ("not in your agreement")', pct(refusals), '100%'],
      ['Answer accuracy (status + cited clause)', pct(answers), '—'],
      [
        'Analysis latency p50 / p95',
        `${(percentile(latencies, 0.5) / 1000).toFixed(1)} s / ${(percentile(latencies, 0.95) / 1000).toFixed(1)} s`,
        '< 20 s p50',
      ]
    );
  } else {
    console.log('\nNo GEMINI_API_KEY found: showing the offline metrics only.');
  }
  console.log(`\nModel: ${apiKey ? model : '(none)'} · ${names.length} agreements\n`);
  console.log('| Metric | Result | Target |\n|---|---|---|');
  for (const [metric, result, target] of rows) console.log(`| ${metric} | ${result} | ${target} |`);
}

void main();
