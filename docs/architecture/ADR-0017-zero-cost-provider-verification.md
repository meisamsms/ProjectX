# 0017: Zero-cost current-stage provider verification

Date: 2026-10-09.
Decision: CORE-AUTH-D007 — APPROVED, OWNER APPROVED / PROJECTX DEPLOYMENT DECISION.
Status: Policy approved; candidate topology specified, not implemented or verified.
Evidence: CHK-073. currentStageBudget = "$0".

## Decision and history

Paid Render provisioning is DEFERRED for this stage, including Add Card, paid web/private/database compute and workspace upgrades. No purchase, new paid trial or automatic paid fallback is authorized. D004/D005/D006 are unchanged. D005 remains an approved future Render development topology; resuming expenditure requires new owner authorization. This is a budget decision, not a Render technical failure.

CONFIRMED: Render supports free web services and limited free PostgreSQL (30-day expiration), but not free Private Services. Candidate A1 in `render.yaml` requires a private API service, so its exact Render realization is not a zero-cost topology. A free web service or $0 Hobby workspace does not make private compute free. [Render free service documentation](https://render.com/docs/free).

Current authorization is documentation/design only: no installation, account/tenant creation, tunnel, public exposure, infrastructure/configuration change, runtime edit, secret or synthetic identity creation. No hosted free database substitute is selected.

## Candidate and feasibility conclusion

Browser → temporary public HTTPS Quick Tunnel → existing local Candidate A1 gateway → local ProjectX API → local PostgreSQL 16. Auth0 supplies OIDC separately. Reuse existing Docker Desktop; no licensing/system changes. Expected incremental recurring infrastructure subscription cost is $0 using existing local equipment/connectivity, not a claim that electricity/connectivity are costless.

CONFIRMED public capability: Quick Tunnels supply temporary HTTPS without buying a domain or account; Cloudflare describes them as no-cost and development/testing-only. Random hostnames change on restart; availability is not guaranteed. [Quick Tunnel docs](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) and [Cloudflare announcement](https://blog.cloudflare.com/protected-quick-tunnels/).

INFERRED: baseline real-provider OIDC can fit this topology and public free-tier capabilities. Full safe compatibility is NOT ESTABLISHED. CORE-AUTH-02-ENV-LOCAL-001 is BLOCKED, not READY, on LOCAL-GATE-001/002 below. This does not prove incompatibility. The user's READY transition is conditional on viability; unresolved hard transport/confidentiality prerequisites prevent asserting it.

Only the gateway may be tunnel-exposed. Proposed host-process connector targets a gateway port published on Windows 127.0.0.1 only; container listener remains compatible with the already verified Docker bridge setup. API/DB stay on a dedicated local Docker network with no public or host-published ports. Do not expose Docker, management/metrics, development servers or database administration. All public visitors must still encounter ProjectX authentication/authorization; a random hostname is not an access control. No customer/reference data.

## Auth0 Free feature assessment

CONFIRMED public plan: Free is $0 with no card required, database connections and one included tenant. Pro MFA factors are not included. Use a dedicated development-only tenant, one confidential Regular Web Application and one synthetic staff identity; not a paid multi-environment subscription, custom domain, enterprise connection or trial-dependent feature. Actual account eligibility/configuration remains UNKNOWN. [Auth0 pricing](https://auth0.com/pricing).

| Required feature | Classification and disposition |
|---|---|
| Authorization Code + PKCE S256 | CONFIRMED documented Auth0 capability; Free baseline compatibility INFERRED, actual confidential client configuration NEEDS TESTING. Preserve client_secret_post, state, nonce and server-only exchange. |
| RS256 / JWKS | CONFIRMED documented signing/JWKS capability; tenant algorithm, exact issuer/audience and live key validation NEEDS TESTING. No token validation downgrade. |
| Exact callback / logout / origin | CONFIRMED documented settings. Register only current HTTPS origin and exact callback path /api/v1/staff-auth/callback; logout URL is current HTTPS origin + /. No wildcard or localhost fallback. |
| Synthetic identity | CONFIRMED Free database-connection capability; account/connection creation and exact issuer-subject binding NEEDS TESTING. No email auto-linking. |
| High-risk MFA / recent assurance | Free Pro MFA unavailable; other usable free assurance not established. Privileged success remains unverified and denied. Do not pay, use trial entitlements, infer assurance from auth_time alone or change D004. |

Sources: [Code/PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce/add-login-using-the-authorization-code-flow-with-pkce),
[application settings](https://auth0.com/docs/get-started/applications/application-settings),
[JWKS](https://tus.auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets).

This decision extends the D006 exact-root invariant to the proposed temporary development origin; it does not edit D006's historical Render wording. Local ProjectX logout still revokes the session and clears its cookie; it does not invoke Auth0 federated logout.

The existing controlled-verification matrix allows a separately proven fail-closed privileged-exposure alternative only if required ordinary core operations remain usable. Neither that proof nor positive MFA assurance exists here. Paid MFA is not silently substituted. If a required feature cannot be provided free within that existing acceptance boundary, STOP for owner decision; do not mark CORE-AUTH-02 VERIFIED.

## Compatibility review before execution

Repository evidence: deploy/gateway/{nginx.conf.template,start.sh,gateway.test.mjs}, apps/api/src/staff-auth/{config,oidc,routes}.ts and existing CHK-069/070. Prior local tests remain historical proof, not Quick Tunnel results.

| Boundary | Classification | Required proof / prohibition |
|---|---|---|
| Canonical Host | INFERRED compatible; NEEDS TESTING | Exact generated hostname fits existing validator. Connector must preserve that authority. Test correct Host and wrong/duplicate/port-suffixed/absolute-form Host rejection. No unconditional host rewrite that hides spoofed authority. |
| X-Forwarded-* / HTTPS | UNKNOWN — LOCAL-GATE-002 | Gateway strips untrusted host/IP forwarding and hardcodes upstream proto=https under its original fixed HTTPS ingress assumption. Prove public HTTP cannot reach auth/API or submit a body through this path as trusted HTTPS; test spoofed forwarding and direct-origin denial. Do not trust browser-supplied proto or weaken guards. |
| Origin / Referer | NEEDS TESTING | Preserve genuine headers; no tunnel rewrite or permissive credentialed CORS. Cross-origin/missing-invalid origin cases must retain current rejection rules. |
| Secure cookies | INFERRED compatible; NEEDS TESTING | Browser-facing HTTPS can support existing host-only Secure/HttpOnly/SameSite cookies. Prove attributes, HTTP non-use, JavaScript exclusion, fixation resistance, expiration and revocation; do not remove Secure. |
| Multiple Set-Cookie | NEEDS TESTING | Preserve separate callback session/transaction-clearing headers and deletion attributes; no folding, rewriting or cookie-domain widening. |
| API routing / no SPA fallback | CONFIRMED local config; NEEDS TESTING through tunnel | /api and /api/ stay upstream on errors/unknown paths and all methods. Verify 401/403/404/5xx are not HTML SPA success; no redirect or challenge masquerading as API response. |
| Callback query confidentiality | UNKNOWN — LOCAL-GATE-001 | Transport must preserve code/state without persisting or displaying them. No real callback until connector/application/gateway/platform logging reviewed; use inert canaries only in a separately authorized test. |
| Cloudflare platform/logging | UNKNOWN — LOCAL-GATE-001 | Cloudflare terminates public TLS and can process the request. Local quiet logs do not prove edge retention/redaction. Establish documented handling/access/retention and project-compatible controls; do not claim zero provider visibility. |
| Edge caching | INFERRED compatible; NEEDS TESTING | Gateway no-store/CDN no-store and default CDN policy are promising, not accountless Quick Tunnel proof. Repeated auth/API/error/redirect requests must not cache or replay another session's response; absence of Age alone is insufficient. |
| Hostname lifecycle | CONFIRMED changes; procedure NEEDS TESTING | No wildcard allowlists. Quiesce old environment, revoke local sessions/pending flows, remove old Auth0 URLs and replace all exact canonical values before resuming. No automatic startup with stale host. |
| CSRF same-origin | INFERRED compatible; NEEDS TESTING | One public origin for web and API. Verify legitimate same-origin mutations and CSRF token pass; absent/bad token, hostile Origin/Referer/Host and cross-site mutations fail. |

Cloudflare exposes an HTTP Host override setting; its existence is not proof that a particular connector version preserves original authority. [Origin parameters](https://developers.cloudflare.com/tunnel/reference/origin-parameters/).
Cloudflare explicitly warns that debug logs include URLs and headers. Avoid debug, log streaming and support bundles containing request material; selected release/error-path behavior still needs review. [Run parameters](https://developers.cloudflare.com/tunnel/reference/run-parameters/).
The current upstream logger emits request details at debug and errors separately; this unpinned source review is not certification of an installed release or edge logging. [cloudflared logger source](https://raw.githubusercontent.com/cloudflare/cloudflared/master/proxy/logger.go).
Cloudflare's default cache documentation describes bypass for no-store and Set-Cookie; no reviewed evidence here establishes the exact Quick Tunnel edge configuration. [Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/).

## Unresolved prerequisites and bounded next work

- LOCAL-GATE-001: Connector failure-path and Cloudflare platform callback/query/header confidentiality. Required predecessor: bounded read-only review of a selected connector release, official platform logging/retention controls and sanitized evidence access; no live credentials. A safe redaction/suppression plan must precede any callback. A local canary cannot prove inaccessible provider logs.
- LOCAL-GATE-002: Effective HTTPS-only ingress and canonical authority preservation for A1's fixed upstream HTTPS assertion. Required predecessor: establish a reviewed enforcement contract and exact non-secret test plan. If enforcement requires gateway changes or a different tunnel, stop and seek separately scoped authorization, not an automatic patch.
- LOCAL-GATE-003: Actual Auth0 Free entitlements, confidential client settings and existing matrix's privileged-assurance/fail-closed alternative remain NEEDS TESTING. A paid feature requirement requires an owner decision, not a card.
- These gates affect ENV-LOCAL-001, CORE-AUTH-02, SETTINGS-CORE-01 and future RESERVATIONS-CORE-01. No evidence supports marking environment readiness YES.

After read-only blockers are resolved and execution separately authorized, proposed sequence is:
1. Recheck $0/no-card/no-trial dependency and selected versions; keep credentials outside Git/chat/command output and outside gateway/web assets.
2. Build isolated local gateway/API/PG16 environment, preserving reviewed migration versus runtime authority. Runtime must not own DB/schema/tables or possess/assume SUPERUSER/BYPASSRLS/elevated roles; test RLS, grants and pool cleanup. Database TLS/role proof from the existing matrix remains required, not waived because local. Do not use the destructive disposable test runner against a verification dataset.
3. Bootstrap a temporary hostname with no live identity/callback enabled, fail closed; configure exact hostname/origin locally and keep that tunnel process alive while restarting local components. Never expose API/DB separately.
4. Perform separately authorized inert-canary routing/HTTP/Host/forwarding/cookie/cache/log tests, including origin failure. Retain only sanitized results, not query/header values. Any failed hard gate stops exposure.
5. Only then configure the exact development Auth0 registration and one synthetic mapping/membership/VenueAccess using reviewed secure handling. No production/reference users.
6. Only after ENVIRONMENT READY FOR CONTROLLED VERIFICATION: YES resume the existing full CORE-AUTH-02 matrix, including negative cases, revocation, two local API instances for multi-instance checks, key rotation/outage and allowed assurance boundary. Mocks do not replace real-provider evidence. Shut down exposure and remove obsolete allowlists at session end.

This is a proposed sequence, not permission to execute it in this task. No new authentication code or broader subsystem is authorized.

## Roadmap and verification

CORE-AUTH-02 remains IMPLEMENTED; provider NEEDS TESTING; environment NO.
Paid ENV-001 is PLANNED with DEFERRED metadata because DEFERRED is not an allowed task status.
ENV-LOCAL-001 is BLOCKED pending the bounded safety prerequisites above, not READY or implemented.
SETTINGS-CORE-01 remains PLANNED pending VERIFIED CORE-AUTH-02.
Part 3 and every previous VERIFIED task/check remain unchanged; U-001/U-002/U-003 and all SevenRooms classifications preserved. This is ProjectX design, not parity evidence.

Documentation validation: pnpm map:check; git diff --check; unique IDs/task DAG, previous decisions/checks/VERIFIED objects and documentation-only scope. No runtime/provider tests in this task.
