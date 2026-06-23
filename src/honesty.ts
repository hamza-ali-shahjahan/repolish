import type { Finding, RepoFacts, Severity } from "./types.ts";

interface Rule {
  name: string;
  pattern: RegExp;
  severity: Severity;
  /** Fire only when this returns true. `undefined` = always fire (pure hype). */
  when?: (f: RepoFacts) => boolean;
  reason: (f: RepoFacts) => string;
  suggestion: string;
}

/** The pattern library. Each rule is a known overclaim SHAPE; evidence-gated rules
 *  only fire when the repo can't back the claim up. Patterns are deliberately tight
 *  to protect precision — we'd rather miss a vague claim than flag honest prose. */
const RULES: Rule[] = [
  {
    name: "production-ready",
    pattern: /\bproduction[- ]?(ready|grade)\b/i,
    severity: "high",
    when: (f) => !(f.hasTests && f.hasCI),
    reason: (f) =>
      `Claims production-readiness, but the repo has ${f.hasTests ? "" : "no detectable tests"}${!f.hasTests && !f.hasCI ? " and " : ""}${f.hasCI ? "" : "no CI"}.`,
    suggestion: `State what's actually proven (e.g. "used in our own production since <date>") or soften to "early but usable".`,
  },
  {
    name: "battle-tested",
    pattern: /\bbattle[- ]?tested\b/i,
    severity: "medium",
    when: (f) => !f.hasTests,
    reason: () => `"Battle-tested" implies real usage + tests; none were detected in the repo.`,
    suggestion: `Replace with concrete evidence (downloads, "in production at X") or remove.`,
  },
  {
    name: "enterprise-grade",
    pattern: /\benterprise[- ]?grade\b/i,
    severity: "medium",
    reason: () => `"Enterprise-grade" is marketing with no objective definition — readers can't verify it.`,
    suggestion: `Name the specific property you mean (SSO? audit logs? SLA?) instead of the label.`,
  },
  {
    name: "tested-on-os",
    pattern: /\btested on\s+(windows|macos|mac os|mac|linux)\b/i,
    severity: "high",
    when: (f) => true, // gated per-match below against ciOSes
    reason: (f) =>
      `Claims testing on an OS, but CI ${f.hasCI ? `only runs on: ${f.ciOSes.join(", ") || "unknown"}` : "is not set up"}.`,
    suggestion: `Only claim OSes your CI matrix actually runs, or say "should work on … (untested)".`,
  },
  {
    name: "cross-platform",
    pattern: /\b(cross[- ]?platform|works on all platforms|runs everywhere)\b/i,
    severity: "medium",
    when: (f) => f.ciOSes.length < 2,
    reason: (f) => `Claims cross-platform support, but CI runs on ${f.ciOSes.length} OS(es): ${f.ciOSes.join(", ") || "none"}.`,
    suggestion: `List the platforms you've actually verified, or add them to your CI matrix first.`,
  },
  {
    name: "full-coverage",
    pattern: /\b(100%\s*(test\s*)?coverage|fully tested|fully covered|complete test coverage)\b/i,
    severity: "high",
    when: (f) => !f.hasTests,
    reason: () => `Claims full/100% test coverage, but no tests were detected in the repo.`,
    suggestion: `Add a real coverage report and link it, or drop the claim.`,
  },
  {
    name: "benchmark-claim",
    pattern: /\b\d+(\.\d+)?\s*(x|×|%)\s*(faster|slower|less|more)\b|\b(blazing|lightning)[- ]?fast\b|\bfastest\b/i,
    severity: "medium",
    when: (f) => !f.hasBenchmarks,
    reason: () => `Performance/speed claim with no benchmark in the repo to back it.`,
    suggestion: `Add a reproducible benchmark (bench/ dir) and cite the exact number + machine, or remove the superlative.`,
  },
  {
    name: "zero-deps",
    pattern: /\b(zero[- ]?dependenc(y|ies)|no dependencies|dependency[- ]?free)\b/i,
    severity: "high",
    when: (f) => f.dependencyCount > 0,
    reason: (f) => `Claims zero dependencies, but the manifest declares ${f.dependencyCount}.`,
    suggestion: `Say "${0} runtime dependencies" only if true; otherwise state the real count or "minimal dependencies".`,
  },
  {
    name: "bug-free",
    pattern: /\b(bug[- ]?free|no bugs|never fails|100%\s*reliable|rock[- ]?solid)\b/i,
    severity: "high",
    reason: () => `Unfalsifiable reliability claim — no software is bug-free, and readers know it.`,
    suggestion: `Describe your testing instead (e.g. "covered by N tests, CI on every push").`,
  },
  {
    name: "security-superlative",
    pattern: /\b(bank[- ]?grade|military[- ]?grade|unhackable|100%\s*secure)\b/i,
    severity: "high",
    reason: () => `Absolute security claim that can't be verified and ages badly.`,
    suggestion: `State concrete measures (e.g. "secrets encrypted at rest", "no telemetry") instead of a grade.`,
  },
  {
    name: "unverifiable-superlative",
    pattern: /\b(the best|world'?s best|#1|number one|the only|the ultimate)\b/i,
    severity: "low",
    reason: () => `Unverifiable superlative — a reader can't check "best/only/#1".`,
    suggestion: `Make a specific, checkable comparison instead (what it does that a named alternative doesn't).`,
  },
  {
    name: "usage-claim",
    pattern: /\b(trusted by|used by)\s+(thousands|millions|hundreds|countless)\b/i,
    severity: "medium",
    reason: () => `Usage-scale claim with no source.`,
    suggestion: `Cite a real number with a source (npm downloads, GitHub stars) or remove it.`,
  },
];

const OS_IN_CI: Record<string, string> = {
  windows: "windows", macos: "macos", "mac os": "macos", mac: "macos", linux: "linux",
};

export function honestyPass(f: RepoFacts): Finding[] {
  const text = f.existingReadme;
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const findings: Finding[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*```/.test(line)) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;                       // don't audit code samples
    if (/^\s*(<!--|>)/.test(line)) continue;         // skip comments / blockquotes

    // Inline-code spans (`like this`) are examples/commands, not assertions —
    // blank them out before matching so docs ABOUT a claim don't self-flag.
    const scannable = line.replace(/`[^`]*`/g, (s) => " ".repeat(s.length));

    for (const rule of RULES) {
      const m = rule.pattern.exec(scannable);
      if (!m) continue;

      // Per-match gate for OS-specific testing claims.
      if (rule.name === "tested-on-os") {
        const os = OS_IN_CI[(m[1] ?? "").toLowerCase()];
        if (os && f.ciOSes.includes(os)) continue;   // CI actually runs it → honest, skip
      } else if (rule.when && !rule.when(f)) {
        continue;
      }

      findings.push({
        rule: rule.name,
        severity: rule.severity,
        claim: m[0],
        line: i + 1,
        snippet: line.trim(),
        reason: rule.reason(f),
        suggestion: rule.suggestion,
      });
    }
  }
  return findings;
}
