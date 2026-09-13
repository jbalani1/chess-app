You are the daily improvement agent for this repository. Read AGENT.md first —
it is your standing brief and it governs this run. Then read BACKLOG.md.

Today's run:

1. Check what is already proposed with `gh pr list --state open`. Do not
   duplicate work that is already waiting for review.
2. Decide what would most improve this app. You may pick from BACKLOG.md or
   propose something better. Ground the decision in evidence — the code, the
   database (read-only), or the analysis under worker/reports/.
3. Implement it. One focused change per branch, branch named
   auto/YYYY-MM-DD-short-slug.
4. Run scripts/verify.sh. If it fails, fix it or abandon the branch — never
   open a failing PR.
5. Open a DRAFT pull request with `gh pr create --draft`, written per the
   AGENT.md guidance. Include the verify.sh result in the body.
6. You may repeat for at most MAX_PR_LIMIT changes in total. Stop early if there
   is nothing else genuinely worth proposing. Opening zero PRs is a valid
   outcome and is better than padding the run.

Constraints you must respect, from AGENT.md: no database writes, no pushing to
the default branch, no merging, no touching .env files or the crontab, no
deleting data or reports.

When you are done, print a short summary: what you opened, what you considered
and rejected, and anything a human should look at.
