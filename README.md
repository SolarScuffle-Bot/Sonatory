# Sonatory

Sonatory is a dependency-less, local-first inventory workspace for people, Groups, and nested Containers. It runs as a static web application and keeps the domain model independent from its HTML projection.

## Local development

Use Node.js 20 or newer.

```text
npm start
```

Open `http://127.0.0.1:4173/`. No package installation is required.

## Quality gates

```text
npm run check
npm run build
npm run verify:dist
```

`check` performs JavaScript syntax checks plus the deterministic domain, persistence, security, relay, import, HTTP, service-worker, and UI-contract test suites. `build` creates an allowlisted static artifact in `dist/`; `verify:dist` checks its runtime graph and Cloudflare security-header contract.

GitHub Actions repeats those gates on Node 20 and 22 under Linux and Windows, then packages the exact verified `dist/` directory. Production deployment is allowed only after every matrix job passes.

## Cloudflare Pages deployment

The workflow's deployment job uses the official Wrangler action and is deliberately opt-in. Configure these repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` with Pages edit permission for this account

Then set the repository variable `CLOUDFLARE_DEPLOY_ENABLED` to `true`. The verified artifact deploys to the `sonatory` Pages project only on pushes to `main`. The app itself requires no paid binding, build dependency, database, or analytics service.

Cloud synchronization is a separate encrypted relay boundary. See [relay/README.md](relay/README.md); static hosting does not enable invitations or claim that recovery-key and offline-outbox release gates are complete.
