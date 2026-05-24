# feishu-iam v0.1.6 Deploy Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `feishu-iam` 具备最小 Docker Compose 部署闭环，可部署到 `bpmt-120:/home/bpmt/feishu-iam`，并让后续 `/land-and-deploy` 执行真实 runtime health check。

**Architecture:** 单 `feishu-iam` Node/Fastify 容器服务 API 和 Vite 静态资源，配套 `postgres` 容器。远端复用现有 `/home/bpmt/nginx` 作为公网反向代理，不在本 compose 中新增 nginx 容器。

**Tech Stack:** React 19、Vite、Fastify、PostgreSQL、Docker Compose、GitHub Actions、Vitest、Playwright/gstack browse。

---

## Source Inputs

- Office-hours design doc: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-main-design-20260524-150137.md`
- Engineering review: `docs/superpowers/plans/2026-05-24-v0.1.6-deploy-infra-eng-review.md`
- Remote target: `bpmt-120:/home/bpmt/feishu-iam`
- Existing health endpoint: `GET /api/health`

## Scope

### In Scope

1. Docker image can build frontend and server.
2. Runtime image can serve `dist/` static files and Fastify API from one origin.
3. `docker-compose.yml` starts `feishu-iam` and `postgres`.
4. `.env.example` documents production deployment variables.
5. GitHub Actions verifies tests, build, and Docker image build.
6. README/CHANGELOG/VERSION/package metadata describe `v0.1.6`.
7. Deploy to `bpmt-120:/home/bpmt/feishu-iam`.
8. Remote health check and deploy report.

### Out of Scope

- New IAM business features.
- Kubernetes.
- Dedicated frontend nginx container.
- GHCR push unless needed by deploy.
- Database backup automation.
- Monitoring/alerting.
- High availability.
- Username/password login.
- Committing real Feishu credentials or exported Feishu data.

## File Structure

### Create

- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `server/src/plugins/staticAssets.ts`
- `server/tests/staticAssets.test.ts`
- `.gstack/deploy-reports/2026-05-24-v0.1.6-deploy.md`

### Modify

- `server/src/app.ts`
- `server/src/config/env.ts`
- `server/src/main.ts`
- `server/tests/helpers/testApp.ts`
- `.env.example`
- `README.md`
- `CHANGELOG.md`
- `VERSION`
- `package.json`
- `package-lock.json`

## Tasks

### Task 1: Fastify Static Frontend Serving

- [x] Add failing server tests for static asset serving:
  - `/api/health` still returns JSON.
  - `/login` falls back to `index.html`.
  - `/assets/app.js` serves asset content.
  - missing `/api/unknown` does not return frontend HTML.
- [x] Implement `server/src/plugins/staticAssets.ts`.
- [x] Add `staticAssetsDir` option to `buildApp`.
- [x] Add `STATIC_ASSETS_DIR` env support, defaulting to `dist` in production.
- [x] Verify `npm run server:test -- server/tests/staticAssets.test.ts`.

### Task 2: Docker And Compose

- [x] Add multi-stage `Dockerfile`.
- [x] Add `.dockerignore`.
- [x] Add root `docker-compose.yml` with `feishu-iam` and `postgres`.
- [x] Ensure compose uses `./data/postgres` and no default app log mount.
- [x] Verify `docker compose config`.
- [x] Verify `docker build`.

### Task 3: CI And Documentation

- [x] Add GitHub Actions workflow for server tests, frontend tests, build, and Docker image build.
- [x] Update `.env.example`.
- [x] Update README with v0.1.6 deployment instructions and remote deployment notes.
- [x] Update CHANGELOG, VERSION, package metadata to `0.1.6`.
- [x] Verify package-lock metadata changes are version-only.

### Task 4: Verification And Deployment

- [x] Run local verification:
  - `npm run server:build`
  - `TEST_DATABASE_URL=postgres://... npm run server:test`
  - `npm test`
  - `npm run build`
  - `docker compose config`
  - `docker build -t feishu-iam:v0.1.6-local .`
- [x] Run local compose smoke if Docker is available:
  - start compose on an unused local port;
  - `curl /api/health`;
  - browser check frontend page.
- [ ] Commit, push, create PR, merge, tag and release.
- [ ] Deploy to `bpmt-120:/home/bpmt/feishu-iam`.
- [ ] Pick next free remote port from nginx/listeners.
- [ ] Health-check remote runtime and write deploy report.

## Expected Outputs

- `v0.1.6` release exists.
- Remote `/home/bpmt/feishu-iam` contains deployed compose project.
- Remote selected port responds to `/api/health`.
- Deploy report records commit, port, compose services and health result.
