# Publishing `mxpf-ai-harness`

Public package under npm account **`sreekuttan.m.achari`**.  
Repo: https://github.com/sreekuttan-m-achari/MXPF-AI-HARNESS

**Recommended:** Trusted Publishing (OIDC) — no long-lived CI token.  
npm itself warns against “Bypass 2FA” granular tokens for CI; prefer this path.

Docs: [Trusted publishers](https://docs.npmjs.com/trusted-publishers/)

---

## Right path (do this)

### Step 1 — Cancel the npm “Granular Access Token” form

You do **not** need `GIT_CI_PUBLISH_TOKEN` for the recommended setup. Close that page.

GitHub showing **no repository secrets** is expected for Trusted Publishing.

### Step 2 — First publish once from your laptop (bootstrap)

OIDC cannot create a brand-new package; npm needs one version on the registry before you can attach a Trusted Publisher.

```bash
cd ~/AI/MXPF-AI-HARNESS
git pull
npm ci
npm test && npm run build
npm login    # sreekuttan.m.achari (browser / OTP as prompted)
npm publish --access public
npm view mxpf-ai-harness version   # expect 0.1.0
```

If `0.1.0` already exists on npm, skip this step.

### Step 3 — Connect Trusted Publisher on npm

1. Open https://www.npmjs.com/package/mxpf-ai-harness  
2. **Package settings** → **Trusted Publisher** (or **Publishing access** / **Connections**)  
3. **GitHub Actions** → fill exactly:

| Field | Value |
|-------|--------|
| Organization or user | `sreekuttan-m-achari` |
| Repository | `MXPF-AI-HARNESS` |
| Workflow filename | `publish.yml` *(name only, not the path)* |
| Environment | *(leave empty unless you use GitHub Environments)* |
| Allowed actions | enable **`npm publish`** |

4. Save.

### Step 4 — Push CI that uses OIDC

Ensure `main` has the latest `.github/workflows/publish.yml` (permissions include `id-token: write`, no required `NPM_TOKEN`).

```bash
git push origin main
```

### Step 5 — Later releases (no token)

Bump `package.json` + CHANGELOG → tag → GitHub Release:

```bash
git tag v0.1.1 && git push origin v0.1.1
gh release create v0.1.1 --title "mxpf-ai-harness 0.1.1" --notes "..."
```

The **Publish npm** workflow authenticates via OIDC. No GitHub secret needed.

---

## If you still want a token today (not recommended)

Only if you cannot do Step 2 locally:

1. On npm, create a **Granular** token (or classic **Automation** token).
2. Under **Packages and scopes**: grant **Read and write** on `mxpf-ai-harness` (or “all packages” if it does not exist yet).
3. Leave **Allowed IP ranges** empty unless you lock to GitHub’s IPs (usually skip).
4. **Bypass 2FA** may be required for CI tokens — npm warns for a reason; prefer Trusted Publishing after first publish.
5. Copy token → GitHub → [New repository secret](https://github.com/sreekuttan-m-achari/MXPF-AI-HARNESS/settings/secrets/actions) named exactly `NPM_TOKEN`.
6. Re-run the failed workflow: `gh run rerun <run-id> --failed`

---

## What CI does

| Workflow | Trigger | Publishes? |
|----------|---------|------------|
| `ci.yml` | PR / push to `main` | No — test + build only |
| `publish.yml` | GitHub Release published | Yes — via OIDC (or optional `NPM_TOKEN` fallback) |

---

## Checklist

- [ ] First `npm publish` from laptop (0.1.0) **or** package already on npm
- [ ] Trusted Publisher: `sreekuttan-m-achari` / `MXPF-AI-HARNESS` / `publish.yml`
- [ ] Do **not** add a CI granular token unless you need the fallback
- [ ] Tag `vX.Y.Z` matches `package.json` version
- [ ] GitHub Release published → watch Actions → **Publish npm**
