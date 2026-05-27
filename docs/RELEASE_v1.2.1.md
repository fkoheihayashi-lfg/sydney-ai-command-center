# Sydney Console v1.2.1 — Public QA Foundation

## Summary

Sydney Console v1.2.1 is the public QA foundation for a local-first personal project operations console. It demonstrates a portfolio-ready path through project focus, read-only project context, AI-assisted summary drafting, and explicit human-gated outbound actions.

Public package version: `1.2.1`.

## What This Release Demonstrates

- Today / Board / AI Tools / Review surfaces for daily project focus and wrap-up.
- Read-only GitHub Projects and GitHub Activity context for project awareness.
- AI Summary draft generation for PM-style updates.
- Manual approval gate before AI Summary Discord posting.
- Explicit manual-only Daily Summary and Test Discord sends.
- Public screenshots and README setup path for fresh GitHub visitors.

## Public Demo Flow

1. Today Focus: review priorities, blockers, and next action.
2. Board / GitHub Read-only: inspect project context without write controls.
3. AI Tools / Manual Approval Gate: generate and review an AI draft before any post action.
4. Review Wrap-up: capture local notes and end-of-day context.

## Safety Guarantees

- No GitHub writes.
- No GraphQL mutations.
- GitHub data is context, not absolute truth.
- AI summaries remain drafts unless explicitly approved.
- No automatic background Discord posting.
- Secrets are not committed.
- API errors are sanitized for public release.

## QA Status

- `npm run typecheck` passes.
- Screenshot-safe public demo path exists in README.
- README, `.env.example`, package version, release note, screenshots, and MIT license are aligned.
- Public branch cleanup removed internal-only notes from root and internal-history docs.
- Smoke tests cover `/dashboard` and the Today / Board / AI Tools / Review surfaces.

## Known Limitations

- Local-first / no auth / no SaaS mode.
- Smoke tests only.
- No GitHub Actions workflow yet.
- `AresCommandCenter.tsx` is monolithic and planned for future component extraction.
- Some widgets may show unavailable or static demo states depending on configuration.
