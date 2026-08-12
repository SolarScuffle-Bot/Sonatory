# Sonatory hard-free relay

The reference relay is an optional opaque synchronization service. It does not receive item names, notes, images, or decrypted operations. The browser remains the working replica and continues locally when the relay is unavailable or full.

## Cost boundary

Deploy this Worker only on a Cloudflare **Workers Free** account with the SQLite-backed Durable Object migration already declared in `wrangler.toml`. Cloudflare documents that Free-plan overages fail instead of becoming billable, while a Paid-plan Worker can incur usage charges. Sonatory cannot turn a paid Cloudflare account into a no-billing account through code; the operator must keep the deployment on the Free plan and must not attach a paid capacity product.

The Worker additionally enforces logical allocations of 25 MB per personal Vault and 100 MB per Group, even if a client asks for more. SQLite `SQLITE_FULL` errors are translated to `507 quota_exhausted`; local work must remain queued and usable.

References:

- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [SQLite-backed Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

## Configuration

Set `ALLOWED_ORIGINS` to the exact comma-separated application origins before deployment. An empty value denies all cross-origin browser callers. Do not use `*`; authorization headers and recovery metadata should never be exposed to arbitrary sites.

Example development override:

```toml
[vars]
ALLOWED_ORIGINS = "http://127.0.0.1:4173"
```

Production should name only the actual static application origin. Custom/self-hosted clients may implement the same `/v1/spaces/{vault|group}/{guid}` contract.

## Protocol routes

- `POST /v1/spaces/{kind}/{guid}` — idempotent encrypted-boundary allocation.
- `POST /v1/spaces/{kind}/{guid}/handshake` — signed five-minute challenge and short-lived session.
- `GET /v1/spaces/{kind}/{guid}/events?after=N&limit=N` — bounded opaque Pull.
- `POST /v1/spaces/{kind}/{guid}/events` — atomic canonical Push.

Events, operation receipts, and device heads are stored separately so a growing boundary is never serialized into one oversized snapshot. A valid authenticated sync renews the hosted-expiry date. The Worker exposes that date and a warning flag beginning 90 days before the 12-month inactivity expiry; its alarm deletes the expired hosted copy, never the client replicas.

## Before enabling the public UI

The Worker contract and browser cryptography are implemented and tested, but production enablement still requires durable browser key/outbox persistence, Recovery Kit acknowledgment/recovery, policy-epoch rotation, invitation redemption, abuse allocation controls, deployment monitoring, and independent security review. Until those gates pass, the ordinary UI correctly keeps hosted collaboration disabled.
