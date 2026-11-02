# Review preview · issue #7

Publishing and reviewer submission need explicit human approval.
Issue #7 stays open through the reviewer actually viewing the preview, not just receiving the
preview URL and the plan's issue links. Initial submission alone does not finish review.
Digest issues #2–#6 must land first. Never commit a preview, attach it to an issue/chat, or
change `runs/`.

## Local export (no publishing)

Use Node 24 and pnpm 12.16.1. From the repository root, with dependencies already available:

```sh
pnpm install --frozen-lockfile
preview_dir=$(mktemp -d "${TMPDIR:?}/rig-preview.XXXXXX")
LANE_MARKER= bash scripts/export-preview.sh "$preview_dir"
```

The script starts `node --import tsx scripts/preview-server.ts <temporary-readiness-file>`, binds only `127.0.0.1:8787`,
waits at most 30 health attempts, then uses `curl --fail` to export `/digest/2026-10-28`.
It stops its server on exit. Keep port 8787 free. The only completed output is
`$preview_dir/index.html`, with inline styles and no client JS; no front-end build is needed.
The server does not load `.env` or start the heartbeat. For a marked local export, supply
`LANE_MARKER` through your existing secure environment, never a literal in a command or log.
Do not print the HTML. Delete the temporary output when finished.

## After explicit publishing approval only

The approval must cover publishing the prepared commits and lane banner to this repository's
public GitHub Pages URL, configuring Pages, storing the secret, and reviewer submission.
Anyone with the URL can read the preview; the marker can be removed by overwriting it, but
public copies cannot be recalled. Workflow artifacts also hold the HTML for up to one day.

1. Integrate the digest work and this change, run `pnpm test` and `pnpm typecheck`, then push
   the approved commits to the default branch of `tauzen/mega-s01e04-rig`. Pushing alone
   cannot deploy: this workflow has only `workflow_dispatch`, no push or PR trigger.
2. In repository **Settings → Pages → Build and deployment → Source**, select
   **GitHub Actions** (`build_type: workflow`). Check the `github-pages` environment permits
   the selected branch and use required reviewers if available. Do not select a branch folder;
   previews are deployment artifacts, never git content.
3. In **Settings → Secrets and variables → Actions → New repository secret**, create
   `RIG_PREVIEW_MARKER` using the approved marker through the private input. Never paste its
   value into issues, workflow inputs, commands, logs or chat.
4. In **Actions → Publish review preview → Run workflow**, select the approved default branch,
   leave `include_marker` checked, and run it. Approve the `github-pages` deployment if asked.
   The job installs locked dependencies, exports `$RUNNER_TEMP/rig-preview/index.html`, uploads
   only that directory using `upload-pages-artifact@v3` (one-day retention), then deploys with
   `deploy-pages@v4`. Overlapping runs are serialized. A missing secret or HTTP error fails it.
5. Open the deployment's HTTPS URL (normally `https://tauzen.github.io/mega-s01e04-rig/`),
   verify the digest and banner, then send that URL and issue links #1–#8 from this repository
   through the course reviewer submission. Do not send the HTML or marker separately.
   Keep issue #7 open after submission until the course confirms the reviewer has actually
   seen the preview and review is finished. Do not replace the marked preview before then.

## Cleanup at the same URL (separate approval if not already covered)

Wait until review is finished and issue #7's reviewer-viewing gate is satisfied. Obtain explicit
human approval for marker-free replacement, marked artifact/secret deletion, plan archival and
issue closure before taking those actions. Issue #8 stays open while review, approval, public
verification or archival is pending.

1. Dispatch the same workflow on the same approved branch with `include_marker` **unchecked**.
   This explicitly sets `LANE_MARKER` to an empty string even while the secret exists.
2. Verify the same HTTPS URL now reads **no marker set**, with the digest intact. Artifact
   expiry alone does not replace the deployed site; this new deployment is required.
3. In **Actions**, open every earlier marked preview run and delete its `github-pages` artifact
   if still present (including failed/cancelled deployments that uploaded one). Artifacts expire
   after one day, but deleting them now removes the retained marked copies sooner. Delete the
   repository secret when no longer needed. Do not delete git history: it contains no preview.
4. Archive `plan.md` as `docs/plans/done/morning-digest.md` with `status: done`, the original
   checkable sections and the full plan issue list from GitHub. An archive may be prepared on a
   branch, but must not be merged as finished until public cleanup verification passes.
5. Record verified cleanup under issue #8. Close it only after review is finished, human
   approval is recorded, the same URL reads **no marker set** with the digest intact, approved
   marked artifact/secret cleanup is confirmed, and the finished archive with issue links has
   landed. Use the closing-comment format in `AGENTS.md`; a preparatory commit must use
   `refs #8`, not `closes #8`.
   To remove the entire site instead, use Pages **Unpublish site**
   after approval; the normal plan requires the marker-free replacement at the original URL.
