import type { Finding, RepoFacts, Severity } from "./types.ts";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s: string) => c("1", s);
const dim = (s: string) => c("2", s);
const red = (s: string) => c("31", s);
const yellow = (s: string) => c("33", s);
const blue = (s: string) => c("34", s);
const green = (s: string) => c("32", s);

const SEV_TAG: Record<Severity, (s: string) => string> = {
  high: (s) => red(s),
  medium: (s) => yellow(s),
  low: (s) => blue(s),
};

export function renderFactsSummary(f: RepoFacts): string {
  const yn = (b: boolean) => (b ? green("yes") : dim("no"));
  const rows = [
    `${bold("repolish")} · ${bold(f.name)}`,
    `  language     ${f.language ?? dim("unknown")}${f.languages.length > 1 ? dim(` (+${f.languages.length - 1})`) : ""}`,
    `  manifest     ${f.manifest ?? dim("none")}${f.packageManager ? dim(` · ${f.packageManager}`) : ""}`,
    `  tests        ${yn(f.hasTests)}${f.testEvidence[0] ? dim(`  (${f.testEvidence[0]})`) : ""}`,
    `  CI           ${yn(f.hasCI)}${f.hasCI ? dim(`  (${f.ciOSes.join(", ") || "OS unknown"})`) : ""}`,
    `  license      ${f.license ?? dim("none")}`,
    `  README       ${f.existingReadmePath ? green("present") : dim("missing")}`,
  ];
  return rows.join("\n");
}

export function renderHonesty(findings: Finding[], f: RepoFacts): string {
  if (!f.existingReadme) {
    return `\n${bold("Honesty pass")}\n  ${dim("No existing README to audit. The generated draft is conservative by design.")}`;
  }
  if (findings.length === 0) {
    return `\n${bold("Honesty pass")}  ${green("✓ clean")}\n  ${dim("No overclaims detected against what the repo can prove.")}`;
  }
  const counts = { high: 0, medium: 0, low: 0 } as Record<Severity, number>;
  for (const fd of findings) counts[fd.severity]++;
  const head = `\n${bold("Honesty pass")}  ${red(`${counts.high} high`)} · ${yellow(`${counts.medium} medium`)} · ${blue(`${counts.low} low`)}`;
  const body = findings
    .map((fd) => {
      const tag = SEV_TAG[fd.severity](`[${fd.severity.toUpperCase()}]`);
      return [
        ``,
        `  ${tag} ${bold(fd.claim)}  ${dim(`(line ${fd.line})`)}`,
        `    ${dim("│")} ${fd.snippet}`,
        `    ${dim("→")} ${fd.reason}`,
        `    ${dim("fix:")} ${fd.suggestion}`,
      ].join("\n");
    })
    .join("\n");
  return head + body;
}
