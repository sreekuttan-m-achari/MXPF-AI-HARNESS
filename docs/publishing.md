# Publishing `mxpf-ai-harness`

Public package under npm account **`sreekuttan.m.achari`**.  
Repo: https://github.com/sreekuttan-m-achari/MXPF-AI-HARNESS

You can publish **manually** or via **GitHub Actions** when you create a GitHub Release.

---

## Option A — GitHub Actions (recommended)

### 1. Create an npm Automation token

1. Sign in at https://www.npmjs.com/ as `sreekuttan.m.achari`
2. **Access Tokens** → **Generate New Token** → type **Automation** (CI-friendly; bypasses 2FA on publish)
3. Copy the token once

### 2. Add the GitHub secret

1. Open https://github.com/sreekuttan-m-achari/MXPF-AI-HARNESS/settings/secrets/actions
2. **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: the Automation token

### 3. Ship a version

```bash
# 1. Bump version in package.json + CHANGELOG (keep them in sync)
# 2. Commit & push main
git push origin main

# 3. Tag matching package.json (e.g. 0.1.0 → v0.1.0)
git tag v0.1.0
git push origin v0.1.0

# 4. Create a GitHub Release from that tag (UI or gh)
gh release create v0.1.0 \
  --title "mxpf-ai-harness 0.1.0" \
  --notes-file docs/releases/2026-08-21-v0.1.0.md
```

Publishing the release triggers [`.github/workflows/publish.yml`](../.github/workflows/publish.yml): test → build → `npm publish --access public --provenance`.

### 4. Verify

```bash
npm view mxpf-ai-harness version
npm install mxpf-ai-harness
```

Package page: https://www.npmjs.com/package/mxpf-ai-harness

---

## Option B — Manual publish (one-off / first time)

```bash
cd ~/AI/MXPF-AI-HARNESS
npm test && npm run build
npm login   # sreekuttan.m.achari
npm publish --access public
git tag v0.1.0 && git push origin v0.1.0
```

Use this if CI secret is not set yet. After the first successful publish, prefer Option A.

---

## Option C — npm Trusted Publishing (OIDC, no long-lived token)

npm supports publishing from GitHub Actions via OIDC without `NPM_TOKEN`. Configure on the package settings at npmjs.com → **Trusted Publisher** → GitHub Actions (repo + workflow file). The publish workflow already requests `id-token: write`. You can switch from `NODE_AUTH_TOKEN` to trusted publishing once configured; until then keep `NPM_TOKEN`.

Docs: https://docs.npmjs.com/trusted-publishers

---

## Checklist before every release

- [ ] `package.json` `"version"` bumped
- [ ] `CHANGELOG.md` updated
- [ ] `npm test` / `npm run build` green locally (or wait for CI on `main`)
- [ ] Tag `vX.Y.Z` matches `"version"`
- [ ] GitHub Release published (for CI publish)
- [ ] `NPM_TOKEN` secret present (Option A)

---

## What CI does on every PR / push to `main`

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml): `npm ci` → `npm test` → `npm run build` (does **not** publish).
