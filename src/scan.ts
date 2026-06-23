import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import type { Manifest, RepoFacts } from "./types.ts";

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "target",
  "vendor", "__pycache__", ".venv", "venv", ".cache", "coverage", ".turbo",
]);

const EXT_LANG: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
  ".mjs": "JavaScript", ".cjs": "JavaScript", ".py": "Python", ".rs": "Rust",
  ".go": "Go", ".rb": "Ruby", ".php": "PHP", ".java": "Java", ".kt": "Kotlin",
  ".swift": "Swift", ".c": "C", ".h": "C", ".cpp": "C++", ".cc": "C++",
  ".cs": "C#", ".sh": "Shell", ".lua": "Lua", ".ex": "Elixir", ".exs": "Elixir",
};

function read(path: string): string | null {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

function firstExisting(root: string, names: string[]): string | null {
  for (const n of names) if (existsSync(join(root, n))) return join(root, n);
  return null;
}

/** Bounded recursive ext census — skips heavy dirs, caps files + depth so we never
 *  hang on a giant repo. We only need rough language proportions, not a full crawl. */
function censusLanguages(root: string): { languages: string[]; primary: string | null } {
  const counts: Record<string, number> = {};
  let seen = 0;
  const MAX_FILES = 4000;
  const MAX_DEPTH = 4;

  const walk = (dir: string, depth: number) => {
    if (depth > MAX_DEPTH || seen >= MAX_FILES) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (seen >= MAX_FILES) return;
      if (e.startsWith(".") && depth === 0 && e !== ".github") continue;
      if (SKIP_DIRS.has(e)) continue;
      const full = join(dir, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { walk(full, depth + 1); continue; }
      seen++;
      const lang = EXT_LANG[extname(e).toLowerCase()];
      if (lang) counts[lang] = (counts[lang] ?? 0) + 1;
    }
  };
  walk(root, 0);

  const languages = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([l]) => l);
  return { languages, primary: languages[0] ?? null };
}

function parseGitRemote(root: string): { owner: string | null; name: string | null; url: string | null } {
  const cfg = read(join(root, ".git", "config"));
  if (!cfg) return { owner: null, name: null, url: null };
  const m = cfg.match(/url\s*=\s*(\S+)/);
  if (!m) return { owner: null, name: null, url: null };
  return parseRepoUrl(m[1]!);
}

function parseRepoUrl(raw: string): { owner: string | null; name: string | null; url: string | null } {
  // git@github.com:owner/repo.git  OR  https://github.com/owner/repo(.git)
  const ssh = raw.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
  if (ssh) {
    const owner = ssh[1]!, name = ssh[2]!;
    return { owner, name, url: `https://github.com/${owner}/${name}` };
  }
  return { owner: null, name: null, url: null };
}

function detectLicense(root: string, manifestLicense: string | null): string | null {
  if (manifestLicense) return manifestLicense;
  const f = firstExisting(root, ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "COPYING"]);
  if (!f) return null;
  const txt = (read(f) ?? "").slice(0, 800).toLowerCase();
  if (txt.includes("mit license")) return "MIT";
  if (txt.includes("apache license")) return "Apache-2.0";
  if (txt.includes("gnu general public")) return "GPL-3.0";
  if (txt.includes("bsd ")) return "BSD";
  if (txt.includes("mozilla public")) return "MPL-2.0";
  if (txt.includes("the unlicense")) return "Unlicense";
  return "custom";
}

function scanCI(root: string): { hasCI: boolean; files: string[]; oses: string[]; runsTests: boolean } {
  const dir = join(root, ".github", "workflows");
  if (!existsSync(dir)) return { hasCI: false, files: [], oses: [], runsTests: false };
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return { hasCI: false, files: [], oses: [], runsTests: false }; }
  const files = entries.filter((e) => e.endsWith(".yml") || e.endsWith(".yaml"));
  const oses = new Set<string>();
  let runsTests = false;
  for (const f of files) {
    const txt = (read(join(dir, f)) ?? "").toLowerCase();
    if (/ubuntu|linux/.test(txt)) oses.add("linux");
    if (/macos|mac-os|osx/.test(txt)) oses.add("macos");
    if (/windows/.test(txt)) oses.add("windows");
    if (/\b(test|vitest|jest|pytest|go test|cargo test|npm test|pnpm test|bun test)\b/.test(txt)) runsTests = true;
  }
  return { hasCI: files.length > 0, files, oses: [...oses], runsTests };
}

function detectTests(root: string, scripts: Record<string, string>): { has: boolean; evidence: string[] } {
  const evidence: string[] = [];
  for (const d of ["test", "tests", "__tests__", "spec"]) {
    if (existsSync(join(root, d))) evidence.push(`${d}/ directory`);
  }
  const t = scripts["test"];
  if (t && !/no test specified|exit 1/i.test(t)) evidence.push(`package.json test script: \`${t}\``);
  // Shallow scan top two levels for test-named files.
  const probe = (dir: string, depth: number) => {
    if (depth > 2 || evidence.length > 6) return;
    let entries: string[]; try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (SKIP_DIRS.has(e) || e.startsWith(".")) continue;
      const full = join(dir, e);
      let st; try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { probe(full, depth + 1); continue; }
      if (/(\.test\.|\.spec\.|_test\.go$|^test_.*\.py$)/.test(e)) {
        evidence.push(`test file: ${e}`);
        return;
      }
    }
  };
  probe(root, 0);
  return { has: evidence.length > 0, evidence };
}

function detectBenchmarks(root: string): boolean {
  for (const d of ["bench", "benches", "benchmark", "benchmarks"]) {
    if (existsSync(join(root, d))) return true;
  }
  return false;
}

export function scanRepo(root: string): RepoFacts {
  if (!existsSync(root)) throw new Error(`Path does not exist: ${root}`);
  if (!statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);

  let name = basename(root);
  let description: string | null = null;
  let manifest: Manifest = null;
  let packageManager: string | null = null;
  let installCmd: string | null = null;
  let runCmd: string | null = null;
  let binName: string | null = null;
  let scripts: Record<string, string> = {};
  let dependencyCount = 0;
  let manifestLicense: string | null = null;
  let repoFromManifest: ReturnType<typeof parseRepoUrl> | null = null;

  const pkgPath = join(root, "package.json");
  const pyProj = join(root, "pyproject.toml");
  const cargo = join(root, "Cargo.toml");
  const goMod = join(root, "go.mod");
  const gemfile = join(root, "Gemfile");
  const composer = join(root, "composer.json");

  if (existsSync(pkgPath)) {
    manifest = "package.json";
    try {
      const pkg = JSON.parse(read(pkgPath) ?? "{}");
      if (pkg.name) name = String(pkg.name).replace(/^@[^/]+\//, "");
      description = pkg.description ?? null;
      scripts = pkg.scripts ?? {};
      manifestLicense = pkg.license ?? null;
      dependencyCount =
        Object.keys(pkg.dependencies ?? {}).length +
        Object.keys(pkg.peerDependencies ?? {}).length;
      if (pkg.bin) binName = typeof pkg.bin === "string" ? name : Object.keys(pkg.bin)[0] ?? null;
      if (pkg.repository) {
        const url = typeof pkg.repository === "string" ? pkg.repository : pkg.repository.url;
        if (url) repoFromManifest = parseRepoUrl(String(url));
      }
    } catch { /* malformed package.json — fall through to best-effort */ }
    packageManager = existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock")) ? "bun"
      : existsSync(join(root, "pnpm-lock.yaml")) ? "pnpm"
      : existsSync(join(root, "yarn.lock")) ? "yarn"
      : "npm";
    installCmd = `${packageManager} install`;
    runCmd = binName ? `${packageManager === "npm" ? "npx" : packageManager} ${binName} --help`
      : scripts["start"] ? `${packageManager} run start`
      : scripts["dev"] ? `${packageManager} run dev`
      : `${packageManager} start`;
  } else if (existsSync(pyProj)) {
    manifest = "pyproject.toml";
    const txt = read(pyProj) ?? "";
    name = txt.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1] ?? name;
    description = txt.match(/^\s*description\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
    dependencyCount = (txt.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m)?.[1]?.split(",").filter((s) => s.trim()).length) ?? 0;
    packageManager = existsSync(join(root, "poetry.lock")) ? "poetry" : "pip";
    installCmd = packageManager === "poetry" ? "poetry install" : "pip install .";
    runCmd = `python -m ${name.replace(/-/g, "_")}`;
  } else if (existsSync(cargo)) {
    manifest = "Cargo.toml";
    const txt = read(cargo) ?? "";
    name = txt.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1] ?? name;
    description = txt.match(/^\s*description\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
    manifestLicense = txt.match(/^\s*license\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
    packageManager = "cargo";
    installCmd = "cargo build --release";
    runCmd = `cargo run -- --help`;
  } else if (existsSync(goMod)) {
    manifest = "go.mod";
    const txt = read(goMod) ?? "";
    const mod = txt.match(/^module\s+(\S+)/m)?.[1];
    if (mod) name = basename(mod);
    packageManager = "go";
    installCmd = `go install ./...`;
    runCmd = `go run .`;
  } else if (existsSync(gemfile)) {
    manifest = "Gemfile";
    packageManager = "bundler";
    installCmd = "bundle install";
    runCmd = `bundle exec ${name}`;
  } else if (existsSync(composer)) {
    manifest = "composer.json";
    try {
      const c = JSON.parse(read(composer) ?? "{}");
      description = c.description ?? null;
      if (c.name) name = String(c.name).replace(/^[^/]+\//, "");
    } catch { /* best-effort */ }
    packageManager = "composer";
    installCmd = "composer install";
    runCmd = `php ${name}`;
  }

  const { languages, primary } = censusLanguages(root);
  const ci = scanCI(root);
  const tests = detectTests(root, scripts);
  const license = detectLicense(root, manifestLicense);
  const gitRemote = repoFromManifest?.url ? repoFromManifest : parseGitRemote(root);

  const readmePath = firstExisting(root, ["README.md", "Readme.md", "readme.md", "README", "README.rst"]);
  const existingReadme = readmePath ? read(readmePath) : null;

  return {
    root,
    name,
    description,
    language: primary,
    languages,
    manifest,
    packageManager,
    installCmd,
    runCmd,
    binName,
    scripts,
    dependencyCount,
    hasTests: tests.has,
    testEvidence: tests.evidence,
    hasCI: ci.hasCI,
    ciFiles: ci.files,
    ciOSes: ci.oses,
    ciRunsTests: ci.runsTests,
    hasBenchmarks: detectBenchmarks(root),
    license,
    repoOwner: gitRemote.owner,
    repoName: gitRemote.name,
    repoUrl: gitRemote.url,
    existingReadme,
    existingReadmePath: readmePath,
  };
}
