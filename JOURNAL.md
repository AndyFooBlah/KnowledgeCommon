# knowledge-common (@andyfooblah/knowledge-common) — Project Journal

Append-only project journal (per the global policy in `~/.claude/CLAUDE.md`).

- Every entry starts with a UTC timestamp and a tag, newest at the bottom:
  `- 2026-10-17T04:42Z [decision] …`
- Tags: `[step]` `[decision]` `[friction]` `[learning]` `[surprise]` `[incident]` `[idea]` `[milestone]`.
- **Append-only.** Never edit or delete a past entry; to correct one, append a new entry naming the earlier one's timestamp.

> Established 2026-10-17 per the new journal policy. The "Reconstructed backfill"
> section was recreated from git history and session records; its timestamps are
> the relevant commit times (UTC) and are approximate for anything predating
> establishment.

A pure TypeScript npm library (no React, no Firebase init) providing Gemini
`FunctionDeclaration`s + implementations for shared knowledge tools (Maps,
Weather, Wikipedia RAG, Jokes, Date/Time). Every Gemini call goes through the
consumer-supplied `gemini` broker — the library never holds an API key.

---

## Reconstructed backfill (from git history + session records)

- 2026-05-09T22:48Z [milestone] Wikipedia filter robustness (1.0.1) — tolerate trailing junk after the JSON array.
- 2026-07-02T05:25Z [milestone] Wikipedia RAG: embedding-based ranking replaces the LLM relevance filter (1.1.0) — a latency win for the live tool-call path.
- 2026-07-09T18:59Z [milestone] Pre-publication cleanup (1.2.0, #7): LICENSE, doc accuracy, dep hygiene, hardening.
- 2026-07-10T17:08Z [milestone] Published to npmjs.org; `@google/genai` peer widened to `v1 || v2` (1.2.1, #8). Consumers (LegacyBot) now install it as a real versioned npm package rather than a `file:` symlink.
- 2026-08-30T02:53Z [decision] Public API-surface hygiene now that it ships on npm: removed `getKnowledgeConfig` from the public exports (1.3.0, #4) and made `sanitizeForPrompt` escape quotes JSON-safely (#5).
- 2026-09-01T21:22Z [friction] Tried to publish 1.3.0 by pushing a `v1.3.0` tag. The tag-triggered CI passed tests + build but the `npm publish` step failed with `ENEEDAUTH` — the repo's `NPM_TOKEN` secret was missing/expired, and local npm was not logged in. Could not self-resolve (publishing needs the owner's npm credential). Left the publish blocked.
- 2026-09-11T05:07Z [decision] 1.3.1 (`3c68efa`) resolved that friction and more: replaced the shut-down `gemini-3.1-flash-lite-preview` date/time model, made the model IDs configurable, and switched publishing to **OIDC trusted publishing on the GitHub `release: published` event** (and skip when the version is already on npm). OIDC removes the long-lived `NPM_TOKEN` from CI entirely — the earlier auth blocker no longer applies. npm is now at 1.3.1.

---

## Live journal

- 2026-10-17T04:42Z [milestone] Journal established per the new global policy; backfilled above from git history + session records.
- 2026-10-17T04:42Z [idea] nl2time integration (assessed, not yet implemented): reimplement `computeTimeDifference` / `computeTimeOffset` on top of the deterministic `nl2time` npm library (`parse`/`resolve`/`describe`, offline, browser-safe, MIT), keeping the existing LLM `normalizeDate` as a fallback for genuinely vague phrases ("when I was young"), and preserving the tool names / signatures / human-readable output strings so LegacyBot needs only a version bump. This removes 1–2 Gemini round-trips per date question and makes the arithmetic DST/leap-year correct. Note the shut-down-model fix that an earlier plan folded into this pass is already done (1.3.1). Authorized by the owner but superseded in priority by the journal task; pick back up from here.
- 2026-11-08T17:31Z [step] Turned on Dependabot alerts and security updates, and added a standard `.github/dependabot.yml`: weekly grouped minor/patch updates with a 5-day cooldown (14 days for majors); security updates open immediately. Part of the cross-repo dependency security program (AndyFooBlah/andy-private-docs#57).
- 2026-11-08T18:56Z [step] Dependency program phase 2 (AndyFooBlah/andy-private-docs#57): CI now runs on all PRs and on `workflow_dispatch`, also builds the library (`build:lib`), and ends with the shared deps-merge / deps-fix jobs (tier standard, no deploy). Added the deps-toolchain action and deps-fixer workflow. `GEMINI_API_KEY` stays unset in CI, so the live model check keeps skipping.
- 2026-11-08T20:17Z [incident] The shared `deps / merge` job failed outright when DEPENDABOT_ALERTS_TOKEN was rejected (401), blocking green Dependabot merges. Fix: the alert lookup now runs only in high-tier repos, and a rejected token means "routine". A failed merge now asks Dependabot to rebase, and repos without a deploy workflow re-run CI on the base branch after a merge. Part of AndyFooBlah/andy-private-docs#57.
- 2026-11-08T20:42Z [friction] deps-fixer's Claude step refused to run: the CI job that hands a red PR to the fixer dispatches it as github-actions[bot], and claude-code-action rejects bot actors unless they are listed in allowed_bots. Added allowed_bots: github-actions. Part of AndyFooBlah/andy-private-docs#57.
- 2026-11-08T22:41Z [friction] First real deps-fixer run (VoiceCommon#45): Claude's fix passed CI, but the PR had fallen behind main and could not merge. deps-fixer now merges the base branch into the PR before Claude starts, so the fix is tested against current main and the PR picks up main's newer workflows. Claude resolves any conflicts. Part of AndyFooBlah/andy-private-docs#57.
- 2026-11-08T22:58Z [friction] deps-fixer's daily sweep picked up green PRs that were waiting for owner review, because an old failed deps/merge check (the earlier bad-token 401) still showed in their checks. The sweep now skips PRs labelled needs-owner-review or deps-gave-up, and ignores failed deps/* jobs. Part of AndyFooBlah/andy-private-docs#57.
- 2026-11-09T14:26Z [step] deps-fixer: TS 7 broke npm ci (typescript-eslint peer range <6.1) and unplugin-dts build (needs JS API); added .npmrc legacy-peer-deps=true and devDependency @typescript/typescript6 (PR #37).
