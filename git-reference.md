# Git & GitHub Reference Guide

> Keep this file in your project root. Quick lookup for commits, branches, pushing, and recovery.

---

## 1 · Daily Commits

A commit is a saved snapshot. Commit often — small saves are easier to roll back.

```bash
git status                          # see what changed (run this constantly)
git add .                           # stage ALL changed files
git add filename                    # stage one specific file
git commit -m "Add invoice filter"  # save snapshot with a description
git log --oneline                   # see recent commits
```

> **Commit message tip:** Describe *what* changed, not *how*. 
> ✅ `"Add low-stock alert"` — ❌ `"fix stuff"`

---

## 2 · Branches

A branch is an isolated copy where you can build freely. Your live app runs off `main` — everything else is safe to break.

```bash
git branch                     # list all branches (* = current)
git checkout -b wave1-inventory # create new branch and switch to it
git checkout main              # switch back to main
git branch -d wave1-inventory  # delete branch after merging
```

> **Naming tip:** Name branches after the feature or wave: `wave1-inventory`, `fix-login-bug`, `add-export-csv`

---

## 3 · Pushing to GitHub

```bash
git push origin main           # push main → triggers live Vercel deploy
git push origin branch-name    # push branch → Vercel preview URL only (not live)
git pull origin main           # pull latest changes from GitHub
```

> ⚠️ Never push untested AI code directly to `main`. Push to a feature branch first, review the Vercel preview, then merge.

---

## 4 · Feature Branch Workflow

Use this loop for every wave or major task.

```bash
# 1. Start a new branch
git checkout -b wave1-inventory

# 2. Build and commit as you go
git add .
git commit -m "Add low-stock threshold logic"

# 3. Push branch → Vercel creates preview URL (not live)
git push origin wave1-inventory

# 4. Test the preview. Happy? Merge to main.
git checkout main
git merge wave1-inventory
git push origin main

# 5. Clean up
git branch -d wave1-inventory
```

---

## 5 · Merging

```bash
git checkout main         # switch to main first
git merge branch-name     # merge feature branch in
git status                # check for conflicts if merge pauses
```

> **If you see a conflict:** Open the file, find the `<<<` / `===` / `>>>` markers, pick which version to keep, then:
> ```bash
> git add .
> git commit
> ```

---

## 6 · Undoing Mistakes

Every mistake is reversible.

### Option A — Vercel Rollback *(fastest, no code needed)*
Dashboard → your project → Deployments → `...` next to any past deploy → **Rollback**. Done in 5 seconds.

### Option B — Undo last commit, keep your changes
```bash
git reset --soft HEAD~1   # un-commits but keeps edits staged
```

### Option C — Safely reverse a live deploy *(recommended)*
```bash
git revert HEAD           # creates an undo commit (safe, no history rewrite)
git push origin main      # Vercel rebuilds the fixed version
```

### Option D — Discard all uncommitted changes *(nuclear)*
```bash
git checkout -- .         # throws away ALL uncommitted edits — no undo
```

---

## 7 · Cheat Sheet

| Command | What it does |
|---|---|
| `git status` | What changed? |
| `git add .` | Stage everything |
| `git add file` | Stage one file |
| `git commit -m "msg"` | Save snapshot |
| `git push origin main` | Deploy to live site |
| `git push origin branch` | Push to preview only |
| `git pull origin main` | Get latest from GitHub |
| `git checkout -b name` | New branch |
| `git checkout main` | Switch to main |
| `git merge branch` | Merge branch into current |
| `git log --oneline` | Recent commit history |
| `git revert HEAD` | Safely undo last commit |
| `git stash` | Temporarily shelve changes |
| `git stash pop` | Restore shelved changes |