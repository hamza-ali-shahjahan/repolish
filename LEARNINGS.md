# Repolish — launch-polish learnings

Durable lessons about making a repo's first impression *premium and honest* at launch
time — the job repolish exists to do. Each entry is a learning, why it matters, and
(where it applies) how repolish could enforce it. This is a knowledge log, not a spec;
roadmap items are clearly marked as **not built yet**.

> The throughline: **polish that a machine can't read isn't polish.** A launch is now
> judged by humans *and* by crawlers, search engines, and LLMs. Repolish's premium-
> but-honest output has to survive all four.

---

## Principles (reinforced)

- **Honesty means *visible* evidence.** A claim is only as good as the content a reader
  — or a crawler — can actually see and verify. "Trust me" lines, hidden metadata, and
  claims that live only in config don't count. This is the spine of the honesty pass:
  flag the claim unless the repo's own visible evidence backs it.
- **Counts and facts come from the filesystem, not the marketing.** If a README says
  "35 agents · 41 skills," those numbers should be derivable from the tree. Hand-typed
  counts drift; derived ones can't. Prefer claims a tool could recompute.

## Learnings

### 1. If it isn't in the static text, crawlers and AI can't read it
Content rendered only by client-side JavaScript (a changelog or FAQ fetched at runtime)
is invisible to many search bots and to LLM crawlers (GPTBot, ClaudeBot, PerplexityBot),
which often see just a "Loading…" placeholder. **Why it matters:** a page can look
perfect in a browser and be blank to the systems that decide discoverability. The fix is
to **pre-render / bake** the content into the initial HTML and let JS only enhance it.
**Repolish angle (idea, not built):** when polishing a project that ships a static site,
flag launch-critical content that exists only behind client-side fetches.

### 2. A dedicated, answer-shaped `FAQ.md` aids LLM discoverability
LLMs cite a project more confidently when the same answers appear across more than one
high-authority surface (e.g. the project site *and* its GitHub repo). A separate
`FAQ.md` — plain markdown, real questions phrased the way people ask them — gives models
a clean source to quote instead of scraping issues or guessing. **Why it matters:** it
also lets you correct narrative drift (the wrong summary an LLM already repeats) at a
source it trusts. **Repolish angle (idea, not built):** offer to scaffold a `FAQ.md`
stub, or note its absence in the polish report.

### 3. One canonical source — kill duplicate and schema-only surfaces
Don't answer the same questions in two places that can disagree, and don't ship
structured data (JSON-LD) whose content isn't also visible on the page. Pick one
canonical home, make its content visible, and link to it. **Why it matters:** duplicate
or invisible-only surfaces dilute signal and rot out of sync. Mirrors repolish's
existing instinct to leave out comparison rows it can't back up.

### 4. Pre-render pipelines must fail open
If launch content is generated at build time (e.g. baking release notes into a page), a
transient failure of the upstream source should **keep the last good output**, never
break the build. **Why it matters:** discoverability tooling shouldn't be able to take
down a deploy. A polish/launch helper should degrade quietly, not loudly.

### 5. Website AEO is adjacent, not in scope (boundary note)
The broader answer-engine checklist — `llms.txt`, an AI-bot-friendly `robots.txt`,
sitemap, canonical tags, FAQPage/Breadcrumb JSON-LD, one `<h1>`, internal links — lives
at the **product website** layer, not the code-repo README that repolish polishes, and
several items need network access that repolish deliberately avoids. **Why it's here:**
so a future "launch discoverability" feature stays honest about where the repo/offline
boundary is, rather than pretending an offline README tool can audit a live site.

---

## Roadmap candidates (not built)

- A **discoverability check**: flag a launch-bound repo missing a `FAQ.md` or other
  answer-shaped docs that help LLM citation.
- A **"claim not backed by visible evidence"** rule extending the honesty pass beyond
  named overclaims to any superlative without on-repo support.
- An optional **`FAQ.md` scaffold** alongside the README draft.

Keep these gated by repolish's two non-negotiables: **offline + deterministic**, and
**never invent a claim** — every check must point at evidence already in the repo.
