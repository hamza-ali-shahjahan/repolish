export type Severity = "high" | "medium" | "low";

export type Manifest =
  | "package.json"
  | "pyproject.toml"
  | "Cargo.toml"
  | "go.mod"
  | "Gemfile"
  | "composer.json"
  | null;

/** Everything repolish learned by scanning the repo. The source of truth for both
 *  README generation and the honesty pass — claims are checked against THIS, not vibes. */
export interface RepoFacts {
  root: string;
  name: string;
  description: string | null;
  language: string | null;
  languages: string[];
  manifest: Manifest;
  packageManager: string | null;
  installCmd: string | null;
  runCmd: string | null;
  binName: string | null;
  scripts: Record<string, string>;
  dependencyCount: number;
  hasTests: boolean;
  testEvidence: string[];
  hasCI: boolean;
  ciFiles: string[];
  /** OSes the CI matrix actually runs on, normalized to "windows" | "macos" | "linux". */
  ciOSes: string[];
  ciRunsTests: boolean;
  hasBenchmarks: boolean;
  license: string | null;
  repoOwner: string | null;
  repoName: string | null;
  repoUrl: string | null;
  existingReadme: string | null;
  existingReadmePath: string | null;
}

/** One flagged overclaim from the honesty pass. */
export interface Finding {
  rule: string;
  severity: Severity;
  claim: string;
  line: number;
  snippet: string;
  reason: string;
  suggestion: string;
}
