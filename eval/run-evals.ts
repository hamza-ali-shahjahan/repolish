import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyze, scanRepo, generateReadme, honestyPass } from "../src/index.ts";
import { renderBanner } from "../src/banner.ts";
import type { RepoFacts } from "../src/types.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const p = (rel: string) => ROOT + rel;

const ok = (b: boolean) => (b ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m");
const pct = (n: number) => (n * 100).toFixed(0) + "%";

let allPass = true;
function record(pass: boolean) { allPass = allPass && pass; }

// ── E1 — README structural completeness ───────────────────────────────────
console.log("\n\x1b[1mE1 — README structural completeness\x1b[0m  (target: M1 ≥ 0.95)");
const repoDirs = [
  "/test/fixtures/repos/js-tool",
  "/test/fixtures/repos/py-lib",
  "/test/fixtures/repos/go-cli",
];
let cells = 0;
let present = 0;
for (const rel of repoDirs) {
  const facts = scanRepo(p(rel));
  const md = generateReadme(facts);
  const bashBlock = md.match(/```bash\n([\s\S]*?)```/)?.[1] ?? "";
  const checks: Record<string, boolean> = {
    // hero must center AND show the real name as its block-letter wordmark (guard)
    hero: md.includes(`<div align="center">`) && md.includes(renderBanner(facts.name).split("\n")[0]!),
    tagline: /\n\*\*[^\n]+\*\*\n/.test(md),
    badges: md.includes("img.shields.io"),
    comparison: md.includes("## How it compares") && md.includes("|---"),
    // quick-start guard: a REAL command in the block, not the literal "TODO"
    quickstart:
      md.includes("## Quick start") &&
      !!facts.installCmd &&
      bashBlock.includes(facts.installCmd) &&
      !bashBlock.includes("TODO"),
  };
  const got = Object.values(checks).filter(Boolean).length;
  cells += 5;
  present += got;
  const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(`  ${facts.name.padEnd(12)} ${got}/5${missing.length ? "  missing: " + missing.join(", ") : ""}`);
}
const m1 = present / cells;
const e1pass = m1 >= 0.95;
record(e1pass);
console.log(`  → M1 = ${present}/${cells} = ${pct(m1)}   ${ok(e1pass)}`);

// ── E2 — honesty detection ─────────────────────────────────────────────────
console.log("\n\x1b[1mE2 — honesty detection\x1b[0m  (target: recall ≥ 0.8 AND control FP ≤ 1)");

function makeFacts(readme: string, over: Partial<RepoFacts>): RepoFacts {
  return {
    root: "/fixture", name: "fixture", description: null, language: null, languages: [],
    manifest: null, packageManager: null, installCmd: null, runCmd: null, binName: null,
    scripts: {}, dependencyCount: 0, hasTests: false, testEvidence: [], hasCI: false,
    ciFiles: [], ciOSes: [], ciRunsTests: false, hasBenchmarks: false, license: null,
    repoOwner: null, repoName: null, repoUrl: null, existingReadme: readme,
    existingReadmePath: "README.md", ...over,
  };
}

const overText = readFileSync(p("/test/fixtures/honesty/overclaim.md"), "utf8");
const cleanText = readFileSync(p("/test/fixtures/honesty/clean.md"), "utf8");

// Expected seeded lines (1-based) = lines carrying a SEED marker.
const seededLines = overText.split(/\r?\n/)
  .map((l, i) => ({ l, n: i + 1 }))
  .filter((x) => /<!--\s*SEED:/i.test(x.l))
  .map((x) => x.n);

const overFacts = makeFacts(overText, { hasTests: false, hasCI: false, ciOSes: [], dependencyCount: 3, hasBenchmarks: false });
const overFindings = honestyPass(overFacts);
const detectedLines = new Set(overFindings.map((f) => f.line));
const matched = seededLines.filter((n) => detectedLines.has(n));
const recall = matched.length / seededLines.length;

const cleanFacts = makeFacts(cleanText, {
  hasTests: true, hasCI: true, ciOSes: ["linux", "macos", "windows"], dependencyCount: 2, hasBenchmarks: true,
});
const fp = honestyPass(cleanFacts);

const e2pass = recall >= 0.8 && fp.length <= 1;
record(e2pass);
console.log(`  seeded overclaims: ${seededLines.length}   detected: ${matched.length}   recall = ${pct(recall)}`);
if (matched.length < seededLines.length) {
  console.log(`  missed lines: ${seededLines.filter((n) => !detectedLines.has(n)).join(", ")}`);
}
console.log(`  control false positives: ${fp.length}${fp.length ? " → " + fp.map((f) => f.claim).join(", ") : ""}`);
console.log(`  → recall ${pct(recall)}, FP ${fp.length}   ${ok(e2pass)}`);

// ── E3 — no-crash on real repos ────────────────────────────────────────────
console.log("\n\x1b[1mE3 — runs without crashing on real repos\x1b[0m");
const realRepos = [
  ...repoDirs.map((r) => p(r)),
  ROOT.replace(/\/$/, ""),                       // repolish itself
  "/Users/hamza/Claude/Scope Intelligence",      // optional external real repo
].filter((d, i) => i < 4 || existsSync(d));
let crashes = 0;
for (const dir of realRepos) {
  try {
    const r = analyze(dir);
    const okRun = r.readme.length > 0;
    if (!okRun) throw new Error("empty readme");
    console.log(`  ${ok(true)}  ${r.facts.name.padEnd(18)} ${r.findings.length} finding(s)`);
  } catch (e) {
    crashes++;
    console.log(`  ${ok(false)}  ${dir} — ${(e as Error).message}`);
  }
}
const e3pass = crashes === 0;
record(e3pass);
console.log(`  → ${realRepos.length} repos, ${crashes} crash(es)   ${ok(e3pass)}`);

// ── Verdict ─────────────────────────────────────────────────────────────────
console.log(`\n\x1b[1mACCEPTANCE: ${allPass ? "\x1b[32mMET\x1b[0m" : "\x1b[31mNOT MET\x1b[0m"}\x1b[0m  (E1 ∧ E2 ∧ E3)\n`);
process.exit(allPass ? 0 : 1);
