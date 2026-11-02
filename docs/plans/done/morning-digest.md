---
plan: morning-digest
status: done
owner: rook
opened: 2026-10-29
---

# Morning digest

The night's run log is a JSONL file nobody reads. By breakfast someone has to know what ran,
what retried, what failed, and whose it was, without opening `runs/`. rig already serves the
status board; the digest is one more page on it.

Out of scope: notifications, history across nights, auth (rig only listens on localhost).

## 1. Run log reader

Read `runs/<night>.jsonl` into one row per job: job, owner, runs, retries, last status, last
error, first and last time. One JSON object per line (`at`, `job`, `status`: `ok | retry | fail`,
`owner`, optional `error`).

- A line that doesn't parse is counted, never thrown. The night still renders.
- `owner` can be `null`. Keep the row; show the owner as `—`.
- Lives in `src/digest/`. Commit `src/digest/types.ts` first (the `DigestRow` type and the
  `readNight(runsDir, night)` signature), so every part of section 2 can start against it.

Done when: reader tests pass on `runs/2026-10-28.jsonl` (5 jobs, 1 bad line).

## 2. Digest page

Four small parts. Each needs only `src/digest/types.ts` from section 1, so once that is in they
can go to four workers at once. Small, well-specified work: a cheaper model is fine here.

### 2a. Page

`GET /digest/:night` renders the rows with the usual layout: one table, sorted by job, retries of
3 or more and any `fail` marked. A night with no file returns 404; an empty file renders
"nothing ran".

Done when: `/digest/2026-10-28` renders locally.

### 2b. JSON

`GET /api/digest/:night` returns the same rows as JSON. Agents read this one; the page and the
JSON must never disagree (ADR 0001).

Done when: the JSON for 2026-10-28 has the same jobs, in the same order, as the page.

### 2c. Board link

The status board links each night on disk to its digest, with its ok / retry / fail counts beside
it.

Done when: both nights on disk link to a digest that renders.

### 2d. Route tests

Route tests for 2a and 2b: 200, 404 for a night with no file, the empty night, a night with a bad
line. Use a temp runs dir; `runs/` is read-only.

Done when: `pnpm test` is green with the new tests.

## 3. Preview for review

The reviewer reads the page from a copy, not from the lane. Run rig and save `/digest/2026-10-28` as
one HTML file, lane banner included (a command, not a browser's "save as"; the page is
self-contained, ADR 0001). Put it on your own public host, one where you can upload over it later (any bucket
or static host, ADR 0003), so it opens from a public HTTPS link. Send the reviewer the link and the
issues for this plan.

Done when: the preview link is sent to the reviewer.

## 4. Clean up

The preview carries this lane's marker on a public link (ADR 0003). Take the marker off: save the
page again with `LANE_MARKER` unset (the banner reads "no marker set") and upload it over the same
link. Move this plan to `docs/plans/done/` with its issue list.

Done when: the preview link no longer shows the lane marker.

## Completion notes

This archive is on the default branch. The coordinator verified public cleanup and closed
issues #7 and #8 only after review, human approval and the checks below.

- [x] Reader, page, JSON, board links and route tests completed (issues #1–#6 closed).
- [x] Public preview and this plan's issue links submitted to the reviewer.
- [x] Reviewer has seen the preview, confirmed by the course's latest claim.
- [x] Human explicitly approved marker-free replacement, deletion of old marked artifacts and
  the preview secret, plan archival and issue closure after review and verification.
- [x] Coordinator verified that the same public URL,
  `https://tauzen.github.io/mega-s01e04-rig/`, reads **no marker set**, with the digest intact.
  Replacement workflow run `41536383066` succeeded with `include_marker=false`. The exact URL
  returned HTTP 200 with `<span class="marker">no marker set</span>`, the original marker absent,
  5 job rows, 1 bad line and no scripts. Local proof is recorded in ignored
  `var/verify-clean-preview.py` and `var/challenge-log.jsonl` in the coordinator's worktree.
- [x] Coordinator confirmed deletion of the old marked artifact `13181494621` and repository
  secret `RIG_PREVIEW_MARKER`; both deletion commands exited successfully.
- [x] Archive with its full issue list merged, pushed and verified on the default branch.
  Issues #7 and #8 closed with the required closing comments after review and cleanup.

## Issue list

All eight issues are closed. GitHub remains the source of current issue status.

1. [Digest types and reader contract](https://github.com/tauzen/mega-s01e04-rig/issues/1)
2. [Run log reader](https://github.com/tauzen/mega-s01e04-rig/issues/2)
3. [Digest page: GET /digest/:night](https://github.com/tauzen/mega-s01e04-rig/issues/3)
4. [Digest JSON: GET /api/digest/:night](https://github.com/tauzen/mega-s01e04-rig/issues/4)
5. [Status board: link nights with counts](https://github.com/tauzen/mega-s01e04-rig/issues/5)
6. [Digest route tests](https://github.com/tauzen/mega-s01e04-rig/issues/6)
7. [Publish HTML preview for review](https://github.com/tauzen/mega-s01e04-rig/issues/7)
8. [Clean up public preview and archive plan](https://github.com/tauzen/mega-s01e04-rig/issues/8)
