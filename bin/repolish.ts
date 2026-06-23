#!/usr/bin/env bun
import { run } from "../src/index.ts";

const HELP = `repolish — make any repo's first impression look premium AND honest.

USAGE
  repolish <repo-path> [options]

OPTIONS
  --write          Write .repolish/README.draft.md + honesty-report.md into the repo
  --out <dir>      With --write, write to <dir> instead of <repo>/.repolish
  --json           Emit structured JSON (facts + readme + findings)
  --strict         Exit non-zero if any HIGH-severity overclaim is found
  -h, --help       Show this help
  -v, --version    Show version

EXAMPLES
  repolish .                 # audit + draft for the current repo, printed
  repolish ../my-lib --write # save a README draft + honesty report
  repolish . --json | jq .findings
`;

function main(argv: string[]): number {
  const args = argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) { process.stdout.write(HELP); return 0; }
  if (args.includes("-v") || args.includes("--version")) { process.stdout.write("repolish 0.0.0\n"); return 0; }

  const positional = args.filter((a) => !a.startsWith("-"));
  const outIdx = args.indexOf("--out");
  const path = positional[0] ?? ".";

  try {
    return run({
      path,
      write: args.includes("--write"),
      out: outIdx >= 0 ? args[outIdx + 1] : undefined,
      json: args.includes("--json"),
      strict: args.includes("--strict"),
    });
  } catch (err) {
    process.stderr.write(`repolish: ${(err as Error).message}\n`);
    return 2;
  }
}

process.exit(main(process.argv));
