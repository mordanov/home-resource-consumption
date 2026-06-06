# ADR-001: JWT Access Tokens + Refresh Token Rotation Over Session Cookies

**Status:** Accepted  
**Date:** 2026-06-06  
**Deciders:** Software Architect  
**Technical Story:** T019 — Phase 2 Foundation (FR-0)

---

## Context

The Home Resource Consumption Tracker requires a stateless, secure authentication mechanism for a React SPA frontend communicating with a FastAPI backend via a REST API.

Two primary options were evaluated:

1. **Server-side sessions with HTTP cookies** — a session ID stored in a cookie maps to a server-side session store (Redis or DB row).
2. **JWT access tokens + rotating refresh tokens** — short-lived signed JWTs for resource access, a long-lived opaque token for renewal, stored as an `HttpOnly` cookie.

Key constraints:
- The backend is a single Docker Compose service — no separate session store is in scope for v1.
- The frontend is a React SPA that must handle token refresh transparently (Axios interceptor).
- Security requirements mandate that a compromised refresh token be detectable and revocable.

---

## Decision

**Use short-lived JWT access tokens (15 min, HS256) with rotating refresh tokens (30 days, SHA-256 hashed in DB).**

Concretely:
- **Access token**: signed JWT, payload `{ "sub": "<user_id>", "exp": ... }`, stored in-memory (Zustand) in the browser — never in `localStorage` or `sessionStorage`.
- **Refresh token**: 64-byte `secrets.token_urlsafe()` opaque string; stored as `SHA-256(token)` in the `refresh_tokens` table with `expires_at` and `revoked` columns; delivered to the browser as an `HttpOnly; Secure; SameSite=Strict` cookie.
- **Rotation**: every `/auth/refresh` call atomically revokes the old token and issues a new pair. Detecting a reuse of a revoked token triggers immediate revocation of all sessions for that user (refresh token family invalidation pattern).

---

## Rationale

| Criterion | Session Cookies | JWT + Rotation (chosen) |
|---|---|---|
| Statefulness | Requires session store (Redis/DB) — adds infra dependency | Access token is stateless; refresh state lives in one DB table |
| Revocation | Instant — delete the session row | Access token: not revocable mid-life (15 min window is acceptable); refresh token: fully revocable |
| SPA compatibility | Requires CSRF protection (double-submit cookie or synchronised token) | Bearer token in memory eliminates CSRF risk for API calls |
| Infrastructure | Redis or extended DB schema | Single `refresh_tokens` table — no extra service |
| Token theft detection | Not applicable (session is the secret) | Refresh token rotation detects replay: reusing a revoked token signals compromise |
| Horizontal scaling | Requires sticky sessions or shared session store | Stateless JWT verification scales without coordination |

The 15-minute access token expiry bounds the blast radius if an access token leaks — an attacker can act for at most 15 minutes before the token expires and cannot be refreshed without the `HttpOnly` cookie.

The in-memory access token (no `localStorage`) protects against XSS exfiltration of the long-lived secret; the `HttpOnly` cookie protects the refresh token from JavaScript access entirely.

---

## Consequences

**Positive:**
- No Redis or shared session store needed in v1.
- Refresh token rotation provides a security audit trail (each row records issuance time).
- Stateless JWT verification reduces DB hits on every authenticated request.
- Clear compromise detection via revoked-token reuse.

**Negative / Trade-offs:**
- Access tokens cannot be individually revoked before expiry. Mitigated by the 15-minute window and the ability to revoke the refresh token (forcing re-login on next access token expiry).
- The `refresh_tokens` table grows over time and must be periodically pruned (expired + revoked rows). A background cleanup job or scheduled DB task is out of scope for v1 but should be added before production.
- Implementing the Axios interceptor for transparent refresh requires careful handling of concurrent 401 responses (single in-flight refresh promise pattern — see T030).

**Out of scope for v1:**
- Refresh token family tracking (full invalidation on reuse detection) — the `revoked` flag covers the basic case.
- Multi-device session listing/management.
- Token binding (device fingerprint).

---

## Alternatives Rejected

- **Pure session cookies with Redis**: Adds an infrastructure dependency (Redis) not currently in the Docker Compose stack. Deferred until multi-instance scaling is needed.
- **Sliding-window JWT (no refresh token)**: Long-lived JWTs with `exp` extension on activity have no revocation mechanism. Rejected on security grounds.
- **OAuth2 / OIDC (external IdP)**: Out of scope per FR-0 and the project constitution ("No SSO, OAuth, or social login").
