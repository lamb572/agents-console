# Pool worktrees live beside the checkout, outside every git dir

Every Ticket, verify candidate, Conversation and the merge checkout got its worktree at `<common git dir>/pool-worktrees/<pool key>/<id>`, inside the main checkout's `.git`. Nothing recorded why beyond the comment that put it there: a worktree under `.git` never shows in the checkout's status, so an in-place Ticket cannot sweep one into a commit. The placement breaks any project built on Vite. Vite refuses to serve a file under `**/.git/**` (its default `server.fs.deny`), so in a pool worktree Vitest fails on its own setup file ("Cannot find module /src/test-setup.ts"), and a Ticket that runs a Vite or Vitest project's tests can only checkpoint. This was seen live on 2026-11-02, on a React, Vite and Vitest todo app.

**A pool's worktrees live at `<parent>/.<checkout name>.agent-console/pool-worktrees/<pool key>/<id>`**, beside the main checkout. For `~/Repos/my-app` that is `~/Repos/.my-app.agent-console/pool-worktrees/…`. The root sits outside every git dir, so Vite serves the files. It also sits outside the checkout, so the reason for the old placement still holds: a worktree never shows in the checkout's status, and the checkout's own test runners, linters and type checkers never find each worktree's copy of the project. The root is anchored on the main checkout, the common git dir's parent, so the pools of every linked checkout (a Line's worktree among them) share one root, each under its own pool key, as they shared the old one. The path keeps a `pool-worktrees` component, so the folder-trust seed's test for a directory the engine made (ADR-0025) is unchanged. It is computed from the repository alone, so nothing new is read from the environment.

**A worktree an older engine made stays where it is.** Git will not check one branch out at two paths, and a parked Ticket's work, or a live Conversation's, sits in the old worktree. When a directory exists at the old path for a Ticket or the merge checkout, the engine keeps using it until it is removed. Every new worktree goes beside the checkout.

**A repository whose common git dir is not a `.git` directory beside a checkout keeps the old root**, for example one cloned with `--separate-git-dir`. There is no checkout to sit beside.

**Considered Options**:
- `<checkout>/.scratch/pool-worktrees`, where a Line's own worktree already lives. Rejected: it is inside the checkout, so the checkout's test runners, which do not exclude `.scratch`, would collect every worktree's copy of the tests.
- A per-user state directory, such as `$XDG_STATE_HOME/agent-console/pool-worktrees`. Rejected for now: every caller of the path would need the home directory threaded through, and the engine reads the environment only at its edge. It also hides a pool's worktrees far from the project.
- Overriding Vite's deny list in each project. Rejected: it is per project, and the Console should not ask projects to loosen a default that protects them.

**Consequences**:
- A folder `.<name>.agent-console` appears beside each repository a pool runs on. The engine removes each worktree it is done with, as before, and leaves the folder.
- The checkout's parent directory must be writable.
- Tests that build a git repo in a temp directory now put it one level in, so the worktrees beside it stay inside the temp directory.
