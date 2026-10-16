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

## 2026-10-10 safety review — CHK-074 / CORE-AUTH-02-ENV-LOCAL-001

This dated addendum supersedes the earlier *proposed execution sequence*, not the
D007 decision or historical findings. Review only: no executable was downloaded,
installed or run; no tunnel, account, identity, database, secret or resource was
created. Starting local and fetched remote SHA:
4c31545a87e6ac3b2ec440953c310e034fbf1a38. Budget remains $0.

### Pinned evidence and dispositions

CONFIRMED release metadata: cloudflared **2026.10.0**, published
**2026-10-05T17:43:45Z**, stable/non-prerelease, source commit
18cdfe0a6fc7b72a0702d255a1f984e776ce0498. Official
[release](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.0) and
[latest-release API](https://api.github.com/repos/cloudflare/cloudflared/releases/latest)
were checked on 2026-10-10. Published Windows amd64 executable SHA256:
86aee4017b26625cee8484c113558f48effa4cd47f7aa05fcf425604e5d2b23c.
This is a future integrity pin, not evidence of an installed binary. Source links
below target that tag, not master. A different release requires renewed review.

| Gate | Disposition | Evidence classification / meaning |
|---|---|---|
| LOCAL-GATE-001 | BLOCKED | CONFIRMED unsafe default failure-log path; platform access/retention/redaction UNKNOWN. Real callback confidentiality BLOCKED. A fake-only diagnostic experiment is eligible; it cannot certify inaccessible provider logs. |
| LOCAL-GATE-002 | READY FOR INERT-CANARY TEST | Connector authority/header behavior partly CONFIRMED; actual public HTTP policy, edge normalization and end-to-end compatibility NEEDS TESTING. Not permission to expose ProjectX. |
| LOCAL-GATE-003 | BLOCKED | Public Free baseline documented; actual tenant/client eligibility and no-trial dependence NEEDS ACCOUNT CHECK. Assurance/fail-closed controlled proof NEEDS TESTING. |

No entire gate is RESOLVED BY DOCUMENTATION. The unsafe default is a hard blocker
to real callbacks, not proof that every possible configuration is incompatible.
No owner policy change is presently required to *design* a non-secret diagnostic
experiment. Its execution still requires separate authorization. LOCAL-001 remains
BLOCKED; CORE-AUTH-02 IMPLEMENTED; provider NEEDS TESTING; environment readiness NO.

### LOCAL-GATE-001: successful requests are not the only logging path

CONFIRMED tagged source:

- [proxy/logger.go](https://github.com/cloudflare/cloudflared/blob/2026.10.0/proxy/logger.go)
  logRequest emits the full request URL and request headers at debug. Query,
  code/state, Cookie and Authorization are therefore at risk. Normal successful
  requests do not use this debug dump at ordinary local info level.
- [connection/quic_connection.go](https://github.com/cloudflare/cloudflared/blob/2026.10.0/connection/quic_connection.go#L203-L220)
  handleDataStream emits the request destination in an error-level event on a
  dispatch failure. Its buildHTTPRequest uses that destination as the HTTP URL.
  [quick_tunnel.go](https://github.com/cloudflare/cloudflared/blob/2026.10.0/cmd/cloudflared/tunnel/quick_tunnel.go)
  selects QUIC by default. INFERRED: an edge destination carrying a callback query
  can expose code/state on failure even at local info/warn/error levels.
  Exact edge destination content under induced failures NEEDS TESTING with fakes.
  This is source evidence of risk, not an observed real callback leak.
- [logger/create.go](https://github.com/cloudflare/cloudflared/blob/2026.10.0/logger/create.go#L73-L84)
  applies the configured level to ordinary writers but independently forwards
  events to the management logger.
  [management/logger.go](https://github.com/cloudflare/cloudflared/blob/2026.10.0/management/logger.go)
  sends events to active sessions and returns early without sessions; this alone
  does not prove persistent storage. The
  [tunnel command](https://github.com/cloudflare/cloudflared/blob/2026.10.0/cmd/cloudflared/tunnel/cmd.go)
  registers management routing without excluding Quick Tunnels. Disabling
  management diagnostics is not demonstrated to disable log streaming.
- Errors may propagate nested URL/error strings. Trace error truncation is not
  redaction. [diagnostic collection](https://github.com/cloudflare/cloudflared/blob/2026.10.0/diagnostic/diagnostic.go)
  and [host log collection](https://github.com/cloudflare/cloudflared/blob/2026.10.0/diagnostic/log_collector_host.go)
  can collect logs/diagnostics; heap/crash/support artifacts may contain material.
  Exact crash contents and all failure-path header exposure remain UNKNOWN.
  No claim that every info/error event contains cookies or Authorization.

CONFIRMED documentation: local logs normally go to standard output/error, while
files can be configured. Remote log streaming has its own filter, independent of
local level. The documented dashboard/tail workflow uses account/tunnel
authorization. UNKNOWN: which user-accessible management/log products, if any,
are available for this accountless Quick Tunnel, and their exact retention.
Absence of a dashboard is not proof of confidentiality.
[Cloudflare observability](https://developers.cloudflare.com/tunnel/observability/).

CONFIRMED trust boundary: Cloudflare terminates browser TLS, processes decrypted
URL/query/headers, and may process traffic/log data under its policy. The general
[privacy policy](https://www.cloudflare.com/privacypolicy/) describes purpose- and
obligation-dependent retention; it supplies no reviewed Quick-Tunnel-specific
code/state exclusion or exact retention period. UNKNOWN: actual edge callback
field retention and operator access. Never claim Cloudflare cannot see a code.
A local canary cannot prove provider-internal deletion or absence of storage.

UNKNOWN: an accountless provider control guaranteeing callback-query redaction.
The reviewed local log-level/file switches are not field-level redaction.
Raising local level alone is insufficient evidence because of the independent
management path. No suppression setting is approved here. A candidate fatal-only,
no-file/no-capture configuration would need its own failure/crash/management
review; changing transport to HTTP/2 is not an automatic remedy either.

Required standard (unchanged): no gateway/application intentional query or
code/state logs; no debug/trace, streaming or support bundles while real callback
secrets exist; no persistent operator-accessible code logs; no callback screenshots
or copied URLs; sanitized evidence only. Repository nginx uses metadata-only
access logging and disabled error output; staff-auth routes record bounded safe
events, not raw callback queries. CONFIRMED static controls are not platform proof.
Official evidence is **insufficient** to certify the whole standard. Real callback
use remains BLOCKED until connector failure paths and accessible logging are
controlled and platform handling has sufficient applicable evidence. If unavailable,
stop for a separately authorized alternative/owner decision; do not silently
accept the risk or purchase a service.

### LOCAL-GATE-002: authority and HTTPS are separate questions

CONFIRMED connector source:
[ingress/origin_proxy.go](https://github.com/cloudflare/cloudflared/blob/2026.10.0/ingress/origin_proxy.go)
rewrites URL scheme/host to the origin target but leaves request Host unchanged
unless an explicit httpHostHeader override is supplied. That override also sets
X-Forwarded-Host from the prior Host. It is optional, not automatic. QUIC reconstructs
Host from edge HttpHost metadata and appends edge-provided HTTP headers.
The edge's actual metadata and malformed-authority policy remain NEEDS TESTING.
Do not use an unconditional Host override to make spoofed authority pass.

The generated public URL is HTTPS; a proposed loopback origin URL is HTTP.
UNKNOWN: whether plain public HTTP for the Quick Tunnel hostname is rejected,
redirected or forwarded. Generic zone
[Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/)
is not proof of policy on trycloudflare.com. Generic edge documentation says XFP
reflects the client protocol, but applicability and spoof rejection must be tested.
Current gateway overwrites upstream XFP with https regardless of received value.
Consequently, if a public HTTP auth/API request reaches it, its assertion is false.
Hard stop: no real ProjectX exposure until effective HTTPS-only ingress is proven
or a separately authorized correction is reviewed. Never weaken Host, cookies or
CSRF and never trust a browser-provided proto.

The table separates general edge documentation from actual Quick Tunnel proof.
Source: [Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/),
tagged connector above, and repository deploy/gateway/nginx.conf.template,
apps/api/src/staff-auth/{config,routes}.ts.

| Header | Browser/client input | Cloudflare behavior | cloudflared behavior | Gateway receives | ProjectX handling | Classification |
|---|---|---|---|---|---|---|
| Host | Browser derives URL authority; crafted client can send malformed/duplicate authority | Actual QT wrong/duplicate Host and HTTP/2 authority policy UNKNOWN | Uses edge HttpHost; no default override | Expected public hostname, not yet observed | Exact canonical Host check; rejects invalid authority except limited health route; API repeats guard | INFERRED compatibility / NEEDS TESTING edge |
| X-Forwarded-Host | Can be spoofed by non-browser clients | No reviewed QT-specific overwrite/removal guarantee | Passes supplied header; only explicit Host override sets it | Possibly untrusted supplied value | Gateway removes it; API rejects presence if it survives | CONFIRMED local stripping / UNKNOWN edge |
| X-Forwarded-Proto | Can be spoofed | General docs overwrite with client HTTP/HTTPS; QT proof outstanding | Passes edge value | Expected external scheme | Gateway always replaces with https; not a check of incoming scheme | NEEDS TESTING; HTTP acceptance blocks real use |
| Forwarded | Can be spoofed | QT addition/removal UNKNOWN | No reviewed HTTP-path authority sanitization | May be supplied/untrusted | Gateway removes; not an identity or authority input | CONFIRMED local removal / UNKNOWN edge |
| CF-Connecting-IP | Client can attempt spoof | General docs set client IP; Worker/subrequest caveats | Passes edge header | Expected edge-defined IP | Not explicitly removed by gateway; API does not use it for identity/authority | INFERRED QT delivery; never trusted identity |
| CF-Ray | Client can attempt spoof | General docs add edge request ID | Passes edge header | Expected edge request ID | Not an authentication/authorization input | INFERRED QT delivery / NEEDS TESTING |
| Origin | Browser chooses actual initiating origin; not present on every request | No reviewed QT rewrite guarantee | No rewrite in reviewed HTTP forwarding path | Expected original or absent header | Gateway passes; API validates exact configured HTTPS origin for mutations | INFERRED / NEEDS TESTING |
| Referer | Browser/referrer policy may omit or reduce it | No reviewed QT rewrite guarantee | No rewrite in reviewed HTTP forwarding path | Expected original or absent header | Gateway passes; API validates same-origin fallback under existing rules | INFERRED / NEEDS TESTING |

For STAFF_APP_ORIGIN=https://<temporary-trycloudflare-host>, compatibility of the
existing Origin/Referer plus CSRF-token checks is INFERRED, not demonstrated.
Missing/invalid headers must preserve existing rejection behavior. No permissive
CORS, browser identity headers, alternate-origin metadata or origin rewriting
workaround is approved.

### Cookies, caching and temporary host lifecycle

INFERRED cookie compatibility: browser HTTPS can retain Secure, HttpOnly,
SameSite=Lax, host-only and Path=/ attributes. Tagged
[proxy/proxy.go](https://github.com/cloudflare/cloudflared/blob/2026.10.0/proxy/proxy.go)
clones response headers; the normal path has no cookie Domain/Path/Secure/SameSite
rewrite. QUIC response metadata iterates each header value separately;
[HTTP/2 response handling](https://github.com/cloudflare/cloudflared/blob/2026.10.0/connection/http2.go)
and [header serialization](https://github.com/cloudflare/cloudflared/blob/2026.10.0/connection/header.go)
also retain separate values. This does not prove browser-facing HTTP/2/HTTP/3
edge preservation. Multiple Set-Cookie and effective browser attributes NEEDS
TESTING, including login-transaction clearing and session creation in one response.

EDGE CACHE SAFETY = NEEDS TESTING. General
[cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/),
[cache control](https://developers.cloudflare.com/cache/concepts/cache-control/) and
[CDN cache control](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/)
document no-store controls and configuration-sensitive Set-Cookie/Authorization
handling. They do not establish the accountless QT zone configuration. Existing
gateway sends Cache-Control and CDN-Cache-Control no-store; transport must retain
them on dynamic API, callback redirects and failures. No-cache alone is not
no-store; no Age header alone is not evidence of no caching.

CONFIRMED: [Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
describes temporary/generated hostnames changing on a new tunnel. ProjectX forbids
wildcard Auth0 allowlists. Future rollover procedure, not executed:
1. Quiesce the old verification session and stop new logins.
2. Revoke ProjectX sessions.
3. Invalidate pending login transactions.
4. Stop the old tunnel.
5. Obtain the new hostname with a fake/inert target only.
6. Update exact ProjectX Host/origin/callback/logout canonical configuration.
7. Update exact Auth0 callback/logout/origin allowlists.
8. Remove every obsolete allowlist value; never automatically reuse a stale host.
9. Recheck transport gates before restarting controlled verification.
Procedure execution remains NEEDS TESTING.

### Protected Quick Tunnel: optional, not adopted

OPTIONAL CANDIDATE / NEEDS TESTING. Current official Quick Tunnel docs describe
email restriction; it may reduce general public access but adds a separate login
boundary and is not a substitute for ProjectX authorization. Tagged
[handler](https://github.com/cloudflare/cloudflared/blob/2026.10.0/quicktunnelauth/handler.go),
[state](https://github.com/cloudflare/cloudflared/blob/2026.10.0/quicktunnelauth/state.go),
[callback](https://github.com/cloudflare/cloudflared/blob/2026.10.0/quicktunnelauth/callback.go)
and [isolation](https://github.com/cloudflare/cloudflared/blob/2026.10.0/quicktunnelauth/isolation.go)
show GET/HEAD login redirects and unauthorized non-GET/HEAD rejection. Its own
callback namespace is separate from ProjectX.

CONFIRMED source: the pending return path includes RequestURI (thus query) in
signed/base64, not encrypted, state-cookie data. That temporary cookie is
Secure/HttpOnly/SameSite=None and path-scoped to its own callback; the protected
session cookie is host-only Secure/HttpOnly/Lax. Unrelated ProjectX cookies are
preserved while the relay's own cookie namespace is isolated.
INFERRED: if its session is absent during an Auth0 callback, it introduces another
browser copy of code/state and another redirect/OTP delay, potentially outlasting
the ProjectX login transaction. Exact query preservation, SameSite interactions,
HTTP/2/3 cookie separation and timing NEEDS TESTING. Protected responses force
private/no-store and no-referrer; that does not certify all downstream behavior.

Automated unauthenticated 401s may originate from the relay, not ProjectX. Browser
pre-authentication, two-instance tests sharing one public origin and provider
callback tests need explicit separation of these layers; non-interactive access
is not assumed. Do not enable protection, select an email or send an OTP in this
review or in the baseline fake-only experiment. Any protected variant needs
separate authorization and evidence; it is not required for the baseline design.

### LOCAL-GATE-003: Free baseline versus actual account proof

Public plan claims and protocol documentation are not proof of a configured
account. The following labels concern the stated feature, not an existing tenant.

| Required item | Plan/account classification | Evidence / remaining check |
|---|---|---|
| One dedicated development tenant | CONFIRMED FREE | Public plan includes one tenant; account eligibility NEEDS ACCOUNT CHECK. No paid multi-environment tenant set. |
| Regular Web Application | NEEDS ACCOUNT CHECK | CONFIRMED documented app type; verify Free entitlement and confidential server configuration, not SPA substitution. |
| Database connection | CONFIRMED FREE | Public plan includes database connections; actual connection remains unconfigured. |
| One synthetic user | CONFIRMED FREE | Fits documented Free user/database baseline; create none now, verify eligible connection later. |
| Authorization Code | NEEDS ACCOUNT CHECK | CONFIRMED documented flow; verify client grant settings on actual Free plan. |
| Client secret / client_secret_post | NEEDS ACCOUNT CHECK | CONFIRMED confidential-client exchange capability; no secret created or exposed. |
| PKCE S256 | NEEDS ACCOUNT CHECK | CONFIRMED supported algorithm and confidential-client token exchange; preserve verifier/state/nonce. |
| RS256 | NEEDS ACCOUNT CHECK | CONFIRMED application signing setting; actual algorithm/issuer/audience proof absent. |
| JWKS | NEEDS ACCOUNT CHECK | CONFIRMED documented issuer key endpoint; actual key validation/rotation/outage untested. |
| Exact Allowed Callback URLs | NEEDS ACCOUNT CHECK | CONFIRMED documented setting; current exact HTTPS host + /api/v1/staff-auth/callback only. |
| Exact Allowed Logout URLs | NEEDS ACCOUNT CHECK | CONFIRMED documented setting; exact current HTTPS root under D006/D007. Local logout is not federated logout. |
| Allowed Web Origins, if needed | NEEDS ACCOUNT CHECK | CONFIRMED setting; server-side top-level Code flow is not a cross-origin browser token exchange. No CORS workaround; if needed, exact current origin only. |
| No credit card | CONFIRMED FREE | Public offer says no card; actual unexpected card requirement means STOP, not purchase. |
| No paid trial dependency | NEEDS ACCOUNT CHECK | Free plan exists beyond trial; verify every enabled setting is Free, never rely on Trial-tagged features. |
| Positive high-risk Pro MFA | PAID | Not included in public Free plan. Other acceptable free positive assurance UNKNOWN, not asserted. |

Sources: [Auth0 pricing](https://auth0.com/pricing),
[application settings](https://auth0.com/docs/get-started/applications/application-settings),
[confidential clients](https://auth0.com/docs/get-started/applications/confidential-and-public-applications),
[Code/PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce/add-login-using-the-authorization-code-flow-with-pkce),
[confidential PKCE token exchange](https://auth0.com/docs/api/authentication/authorization-code-flow-with-pkce/get-token-pkce),
[JWKS](https://tus.auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets),
[tenant creation](https://auth0.com/docs/get-started/auth0-overview/create-tenants).
Official [trial expiry guidance](https://support.auth0.com/center/s/article/Question-regarding-the-Free-and-the-Trial-plan)
distinguishes temporary trial entitlements from the eventual Free plan. A successful
trial-only test is not $0 baseline verification.

CONFIRMED repository acceptance: staff-session-verification.md already explicitly
permits the fail-closed privileged-exposure alternative **only with controlled
positive proof of required ordinary core operations**; staff-access-integration.md
keeps ordinary reservation operations free of repeated step-up and denies high-risk
actions without assurance. ADR-0017 previously retained this boundary. Thus no new
owner interpretation is needed merely to use that existing alternative. D004's
12h absolute / 30m idle / concurrent sessions and approximately 5-minute high-risk
assurance policy remain unchanged. Positive privileged MFA success is unavailable/
unverified in this candidate, and privileged operations stay denied.

This does not verify CORE-AUTH-02 now, waive any remaining matrix item or claim
unimplemented reservation workflows work. Future evidence must identify precisely
which ordinary operations were positively exercised and prove high-risk denial.
If required ordinary usability or any mandatory matrix item cannot be proven within
this boundary, STOP for owner decision; do not redefine acceptance or pay.

### Proposed LOCAL-002: disposable fake-only transport experiment

CORE-AUTH-02-ENV-LOCAL-002 — Disposable inert-canary Quick Tunnel transport verification.
PLANNED, not executed; explicit separate authorization required for download/
installation and temporary public exposure. Review found no proven unavoidable
incompatibility that prevents a **non-secret diagnostic experiment**. It did find
a default logging defect relative to this project's callback standard; successful
canaries alone cannot waive platform confidentiality or authorize real callbacks.

Owned scope: pinned connector, disposable loopback echo/mock HTTP server with fixed
fake responses and bounded in-memory observations, separate scratch environment,
no file serving/proxying arbitrary URLs, no general machine inspection endpoint.
NO ProjectX process/gateway/API, Auth0, PostgreSQL, real callback, secret, synthetic
identity or customer/reference data. Only fake code/state/cookies/Authorization
sentinels. Do not publish host IPs, generated hostname, request dumps or session
artifacts; retain sanitized per-case outcomes. Bind origin/metrics to loopback;
no new firewall/router/system changes. Baseline is unprotected, time-boxed and
stopped after testing. Anyone can reach the random URL; do not treat it as a secret.

Future verification cases (all NEEDS TESTING; exact commands reviewed before run):

1. **Authority/headers:** normal HTTPS request; wrong, duplicate, port-suffixed
   Host, absolute-form HTTP/1 request and HTTP/2 authority conflict where supported.
   Pair URL/TLS SNI and crafted Host cases and record whether edge rejects or origin
   sees them. Send fake XFH/XFP/Forwarded/CF-* values, repeated variants, matching/
   hostile/absent Origin and Referer. Record edge status and origin observations,
   not an assumption that the mock enforces ProjectX checks.
2. **HTTP boundary:** GET/HEAD/POST/PUT/PATCH/DELETE to fake /api/v1 and callback paths
   over public HTTP with redirect following disabled, fake body/query and unique
   request IDs. Compare in-memory origin counters. Public HTTP auth/API requests
   or bodies reaching origin => FAIL for existing fixed-HTTPS gateway design.
   A redirect is acceptable only if original HTTP request/body did not reach origin;
   do not convert a post-redirect HTTPS response into evidence about initial ingress.
3. **Cookies/redirects:** fixed fake responses issue two distinct Set-Cookie fields,
   one creation and one deletion, with Secure/HttpOnly/Lax/host-only/Path=/.
   Test separate field preservation, browser attributes, JS exclusion, HTTP non-use,
   same-origin requests and synthetic cross-site top-level redirect chain. Compare
   browser HTTP/2 and HTTP/3 when available; unavailable protocol => NEEDS TESTING.
   No actual OAuth login and no weakening attributes to pass.
4. **Cache:** repeated identical URLs from two independent fake cookie jars and
   fake Authorization contexts; origin-generated per-request counter/body marker,
   not a cache-busting query. Test 200/302/401/403/404/500 with combined and individual
   no-store/CDN-no-store controls, Set-Cookie and Authorization; fake callback302
   and dynamic API paths. Check headers, origin counters and cross-client replay.
   Any reuse/private-cookie crossover => FAIL; absent Age alone never PASS.
5. **Failure logs:** at normal info level use distinct fake query/header/cookie
   sentinels, then induce origin refusal, reset, timeout, invalid response and
   connector interruption. Search local stdout/stderr and any configured operator
   log surface for raw/encoded sentinels; retain only counts and redacted reasons.
   Do not run debug/trace, enable remote streaming or create support/heap bundles.
   Verify the source-predicted error-destination leak with fakes. Record the
   management channel as unresolved if inaccessible; no invented dashboard proof.
   Any proposed suppression needs a second reviewed fake-only case and applicable
   platform evidence; local silence is insufficient.
6. **Lifecycle/cleanup:** stop the tunnel/mock, confirm old endpoint no longer
   reaches the origin and loopback listeners are closed. Preserve only sanitized
   evidence. Full ProjectX/Auth0 revoke/allowlist rollover is outside this mock
   experiment and remains a later gate.

Dependencies: VERIFIED CORE-AUTH-01 and PEOPLE-CORE-01; completed CHK-074 design.
LOCAL-001 will depend on LOCAL-002 proof, not the reverse; no cycle with parent
CORE-AUTH-02. Test completion may document failures; it must not automatically
transition LOCAL-001 to READY. Review every unresolved log/platform, HTTP/authority,
cookie/cache and Free-account prerequisite before any later environment setup.
A hard failure means STOP and record a separately scoped predecessor, not fix
runtime/gateway, switch providers, buy infrastructure or expose ProjectX.

Validation for this documentation task: pnpm map:check, git diff --check, task DAG/
unique IDs and comparison of all previous CHK/VERIFIED/decision/reference records.
No runtime tests were executed. SevenRooms U-001/U-002/U-003 and every reference
classification remain unchanged; no provider behavior is SevenRooms evidence.

## 2026-10-10 inert-canary execution — CHK-075 / CORE-AUTH-02-ENV-LOCAL-002

CONFIRMED: owner explicitly authorized one temporary accountless fake-only tunnel.
Starting clean HEAD and fetched origin/people-03-accounts-read both equalled
be765315ce0bacb94c3c577e25a0da69ce8ce725. No ProjectX/gateway/API, Auth0,
PostgreSQL, real OAuth flow, real credentials/cookies or customer/reference data
participated. $0; no account, card, service installation, firewall/PATH/startup
change or paid resource. The earlier CHK-074 proposal and failures remain historical.

### Artifact, isolation and execution

CONFIRMED official pinned release: cloudflared 2026.10.0, published 2026-10-05.
The [tagged release](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.0)
was still retrievable. Windows X64 matched cloudflared-windows-amd64.exe.
Downloaded artifact SHA256 matched the release body and API asset digest:
86aee4017b26625cee8484c113558f48effa4cd47f7aa05fcf425604e5d2b23c.
Windows Authenticode reported Valid with Cloudflare, Inc. signer.
Executed --version reported 2026.10.0 (built 2026-10-05T08:39 UTC).
This is now actual binary-version evidence, not a rewrite of CHK-074's review-only claim.

CONFIRMED test-only hostname: anti-writing-leadership-clerk.trycloudflare.com.
Classification: CONFIRMED TEMPORARY TEST HOSTNAME; now stopped, never configured in
ProjectX or Auth0. Exposure window was within 2026-10-11 03:20:32–03:20:59 UTC
(2026-10-10 America/Chicago). Exactly one connector process/tunnel was started.
Two initial external curl attempts failed DNS resolution; a later request through
the same tunnel succeeded. No second tunnel/restart and no debug-mode run.

Disposable files were outside the repository in a dedicated user-local test
directory. Node mock listened only on 127.0.0.1:55004 (random OS-assigned port);
cloudflared metrics listened only on loopback port55010. Connector subprocess used
an explicit empty temporary config, cleared inherited application environment,
info logging, no auto-update, disabled management diagnostics and no Host override.
No login/named tunnel/certificate/token supplied; registered transport was QUIC.
Disabling management diagnostics is NOT a claim that management logging is disabled.

Command shape, not a new execution instruction:
cloudflared tunnel --config <temporary-empty-config> --no-autoupdate
--url http://127.0.0.1:<mock-port> --metrics 127.0.0.1:0 --loglevel info
--management-diagnostics=false --grace-period 3s --label PX_FAKE_LOCAL002.
Temporary Node orchestration/mock source SHA256:
a0792885c871322af680bd9e0841892bad2a411049153466a402375d83cde8ad.

The mock served fixed fake response logic only, with no filesystem/proxy/admin
endpoint or secret/environment/credential reads. Requests without the fixed
non-secret canary header received404. Request observations allowed only selected
headers and fake query fields; actual IPs and CF-Ray values were redacted.
It never routed to another local service. Tests used curl8.21.0 with certificate
verification, HTTP/1.1, no proxy, bounded timeouts and no redirect following.
A separate Node TLS socket sent the conflicting duplicate Host case explicitly;
no inference that curl alone transmits duplicate Host fields.

CONFIRMED direct-origin boundary: explicit loopback bind, no non-loopback listener
created by the mock, no firewall/NAT changes. An independent LAN/WAN probe was not
performed; do not describe this as a general machine network-security audit.
Actual browser behavior, HTTP/2 and HTTP/3 remain NEEDS TESTING; curl does not prove
browser cookie enforcement or CSRF.

### Public transport and authority observations

46 request observations included the local control, two initial DNS failures,
successful external cases, the raw duplicate-Host case and post-shutdown check.
Results below are CONFIRMED for this single ephemeral host and tested HTTP/1.1
path, not a universal Cloudflare guarantee.

| Case | External result | Mock observation / meaning |
|---|---|---|
| HTTPS normal | 200; certificate validation succeeded | Expected unique fake body and exact generated hostname arrived. HTTPS PUBLIC PATH = CONFIRMED. |
| Plain HTTP GET / HEAD | 200, no HTTPS redirect followed or needed | Each reached origin with X-Forwarded-Proto=http. |
| Plain HTTP POST / PUT / PATCH / DELETE | 200 | Each reached / with 16-byte fake body and proto=http. PUBLIC HTTP BOUNDARY = FAILED. |
| Normal Host | 200 | Generated hostname preserved. Normal CANONICAL HOST TRANSPORT = CONFIRMED. |
| Wrong Host fake-host.invalid | 403 | Origin request count unchanged. |
| Host with :443 | 200 | Origin received hostname without the default port. |
| Host with :8443, connection still to public443 | 200 | Origin received hostname:8443. Not a test of connecting to public8443. |
| Malformed Host containing a space | 400 | Origin request count unchanged. |
| Duplicate conflicting Host: valid first, fake-host.invalid second, raw TLS request | 200 | Origin received the first/canonical authority. No reliable rejection of duplicate authority can be claimed. Reverse order and other forms untested. |

Plain HTTP was tested at /, not every auth/API route. The observed acceptance
already fails the prompt's required boundary and establishes that this hostname
does not universally enforce HTTPS. INFERRED implication for existing ProjectX
design: its hardcoded upstream https cannot be justified by a fixed-HTTPS ingress
assumption on this transport. No actual ProjectX assertion or auth request was
executed. Normal Host pass-through does not establish strict end-to-end authority
rejection, especially after duplicate/default-port normalization.

| Header | Fake client input | Edge/connector result received by mock |
|---|---|---|
| X-Forwarded-Host | fake-host.invalid | Preserved unchanged; client-controlled authority survives. |
| X-Forwarded-Proto | http over HTTPS | Replaced with https. Ordinary public HTTP requests arrived as http. |
| Forwarded | for=192.0.2.44;host=fake-host.invalid;proto=http | Preserved unchanged; not trusted authority. |
| X-Forwarded-For | 192.0.2.44 (documentation-only fake IP) | Fake value retained followed by an added real-client-address value, redacted from evidence. |
| CF-Connecting-IP | Not supplied | Present at mock; actual IP omitted. No spoof test for this field. |
| CF-Ray | Not supplied | Present at mock; actual identifier omitted. No spoof test for this field. |
| Origin | Same-origin value, hostile fake-origin.invalid, absent | Supplied values preserved; absence preserved. |
| Referer | Same-origin fake path, hostile fake path, absent | Supplied values preserved; absence preserved. |

These are observed combined edge/connector outcomes; the experiment does not
independently locate every rewrite within Cloudflare. ProjectX gateway stripping
and CSRF remain existing source evidence only: no gateway was in this experiment.
No credentialed CORS, Host override or cookie downgrade was introduced.

### Cookie and cache transport

CONFIRMED external response: two distinct Set-Cookie fields survived for PX_FAKE_A
and PX_FAKE_B. Both retained Secure, HttpOnly, SameSite=Lax and Path=/; neither had
a Domain attribute added. No folding observed. This is HTTP/1.1 response transport
proof, not browser storage/JS exclusion/SameSite/delete-cookie/HTTP2/HTTP3 proof.
Those unexecuted cases remain NEEDS TESTING.

CONFIRMED SAFE FOR CANARY: 19 repeated cache cases produced a new origin marker and
one additional origin request per response; no replay observed. Three repeats each
for combined no-store/CDN-no-store, Cache-Control-only and CDN-Cache-Control-only;
two repeats each of302/401/403/404/500 with both directives and two fake Set-Cookie
fields, alternating fake Authorization and Cookie request headers. Repeated URLs
were unchanged within each case; origin counters, not merely missing Age, proved
fresh execution. All reported CF-Cache-Status=DYNAMIC and no Age; intended no-store
headers survived. The302 used a fake local redirect, not Auth0.
No browser cookie jars or real sessions were used. General edge cache safety for
all paths/protocols/configurations remains NEEDS TESTING; these positive samples
do not override the two hard blockers.

### Callback-query and header logging result

CONFIRMED successful fake callback: required code/state fake markers arrived intact
at the mock. No gateway or OAuth/OIDC provider existed in the test. At info level,
captured normal connector output contained zero occurrences of the successful
fake code/state, fake Authorization and fake Cookie sentinels.

CONFIRMED controlled failure: stopped the mock while keeping the same tunnel
running, then sent only PX_FAKE_CODE_FAILURE_001 and PX_FAKE_STATE_FAILURE_001
with fake Authorization/Cookie headers. External response502; no origin request.
One error-level connector event contained both failure markers in its destination
field (one occurrence each). Raw URL/log lines are deliberately not committed.

CONNECTOR CALLBACK LOG CONFIDENTIALITY = FAILED.
LOCAL-GATE-001 = BLOCKED FOR REAL CALLBACKS.
The prior source-level concern is now reproduced with fake data, not real secrets.

Authorization: Bearer PX_FAKE_AUTH_001 and the PX_FAKE_COOKIE_001 request cookie
were received intact during their successful cases. Neither sentinel appeared in
the captured normal or origin-refusal failure logs. This limited absence does not
certify all errors, diagnostics, streaming or crash paths. Debug was NOT executed:
prior pinned-source risk remains and another tunnel was not created. No debug,
support bundle, remote log streaming or protected-email flow was enabled.

PLATFORM INTERNAL LOG VISIBILITY = UNKNOWN. This experiment cannot establish
absence of provider retention, internal edge/security logs or support access.
No local-log result resolves that separate confidentiality requirement.

### Teardown, dispositions and next boundary

CONFIRMED: connector and mock terminated; their exact PIDs were absent, and neither
test/metrics port had a listener. Post-shutdown external request returned502 with
no fake response marker and zero origin requests. No cloudflared Windows service
or scheduled startup task was found by read-only checks. Temporary executable,
mock/config, raw connector log and temporary result file were removed from the
validated dedicated directory; directory no longer exists. No persistent PATH,
firewall, provider configuration or hostname configuration was created. Before
documentation edits, git status --short was empty. No binary/log/request dump is
included in the commit; sanitized outcomes are recorded here and in CHK-075.

| Gate / task | Current result |
|---|---|
| LOCAL-GATE-001 | BLOCKED: CONFIRMED error-level fake callback-query disclosure; platform internals UNKNOWN. |
| LOCAL-GATE-002 | BLOCKED: CONFIRMED public HTTP forwarding; normal authority/header/cookie/cache samples do not establish safe ProjectX ingress. Duplicate/default-port handling also requires independent review. |
| LOCAL-GATE-003 | BLOCKED / NEEDS ACCOUNT CHECK: no Auth0 work performed. |
| LOCAL-002 | BLOCKED: authorized experiment executed and cleaned up; intended real-provider transport safety failed. Not marked VERIFIED merely because measurements completed. |
| LOCAL-001 / CORE-AUTH-02 | BLOCKED / IMPLEMENTED respectively; provider NEEDS TESTING; environment readiness NO. |

No repair, rerun tunnel, provider switch, log suppression workaround or ProjectX
exposure is authorized by these results. D004/D005/D006/D007, historical gateway
evidence, all previous VERIFIED tasks/CHK records, and SevenRooms U-001/U-002/U-003
classifications remain unchanged. Protected Quick Tunnel remains optional/unselected;
positive privileged assurance remains unverified and high-risk operations denied.

Proposed next task: CORE-AUTH-02-ENV-LOCAL-003 — Investigate zero-cost verification
transport alternatives (PLANNED, separate design authorization). Documentation-only
comparison of $0 transport candidates against callback confidentiality, accountable
provider visibility/retention, effective HTTPS-only ingress, canonical authority,
cookies/CSRF and no-trial dependence. Identify whether an existing secure option
can satisfy every required boundary; do not assume any named alternative is safe.
Owned scope is design/evidence, not installing/exposing, accepting risk, changing
gateway/auth code, Auth0/PostgreSQL or purchasing. A materially changed trust
boundary or unresolved owner risk choice needs its own explicit decision before
implementation. This investigation is not started here.

The prerequisite affects LOCAL-001, CORE-AUTH-02, SETTINGS-CORE-01 and future
RESERVATIONS-CORE-01. Reservation-first scheduling and Part3 deferrals remain.
Validation: pnpm map:check; git diff --check; JSON/IDs/DAG/history/status and
five-document scope/secret checks. No application regression suite was rerun because
no application, gateway, tests, migrations, contracts or dependency files changed.

## CHK-076 — LOCAL-003 transport alternatives review (2026-10-11)

Status: DOCUMENTED; PROJECTX DESIGN RECOMMENDATION, NOT OWNER APPROVAL OR
RUNTIME VERIFICATION. Starting clean local/fetched origin:
`f872bc034e029a64a6c18ed3bc958016b5b13ae0`, branch `people-03-accounts-read`.
Only read-only source research and five documentation updates are authorized.
No installation, trust-store change, certificate, listener, tunnel, account,
provider configuration, database, real login, paid resource or push occurred.

### Outcome and unchanged gates

INFERRED: local-only trusted HTTPS is the preferred transport family because it
can remove the unnecessary public callback intermediary. Classification:
**PREFERRED / NEEDS INERT TEST**, not a selected implementation. There is no
currently proven replacement environment. LOCAL-GATE-001 and LOCAL-GATE-002
remain BLOCKED; LOCAL-GATE-003 remains BLOCKED / NEEDS ACCOUNT CHECK.
CORE-AUTH-02 remains IMPLEMENTED, LOCAL-001 BLOCKED, provider NEEDS TESTING and
ENVIRONMENT READY NO. Existing gateway compatibility is a separate unresolved
prerequisite, not concealed by API configuration compatibility.

CONFIRMED historical CHK-075 remains unchanged: Quick Tunnel forwarded public
HTTP to the mock and cloudflared error-level origin-failure logging included fake
callback code/state. Quick Tunnel is NOT APPROVED for real provider verification
under the current design. No repeated experiment, log suppression, or acceptance
of this exposure is proposed. Its failed task remains historical evidence; it
must not become a requirement to make that unsafe transport pass before a
separately approved alternative can be considered.

### Auth0 network model and exact local registration

CONFIRMED documentation: for the selected Authorization Code query response,
Auth0 redirects the user agent to the registered callback. The browser makes
that request; the local server subsequently makes an outbound token exchange.
Auth0 does not need an inbound server-to-server connection to this callback.
This finding does not cover webhooks, back-channel logout or other response
modes. See [Auth0 Authorization Code flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow/add-login-auth-code-flow).

CONFIRMED documentation: Auth0's Regular Web Application example uses an exact
HTTPS localhost callback with a non-default port and an HTTPS local root logout.
The port is a chosen fixed registered value, not a native-app arbitrary-port
exception. The application's callback path may be registered exactly; no wildcard
is necessary. See [Auth0 HTTPS localhost example](https://auth0.com/blog/securing-razor-pages-applications-with-auth0/)
and [application settings](https://auth0.com/docs/get-started/applications/application-settings).
Allowed Web Origins, if needed by an approved feature, contain scheme/host/port,
not a path. They are not permission to introduce credentialed cross-origin APIs.
The present server-side Code flow does not itself require an Auth0 SPA/CORS design.

CONFIRMED documentation: the [Regular Web PHP quickstart](https://auth0.com/docs/quickstart/webapp/php)
uses HTTP `127.0.0.1`. That is not direct proof of HTTPS IP-literal support on the
actual Free tenant. HTTPS `127.0.0.1` is INFERRED plausible, NEEDS ACCOUNT CHECK /
TESTING; do not equate it with documented HTTPS `localhost`. Never use that HTTP
example to relax ProjectX HTTPS requirements.

CONFIRMED advertised [Auth0 Free pricing](https://auth0.com/pricing): $0 and no
credit card for Free signup. INFERRED: ordinary Regular Web Code/PKCE local
verification can use baseline features without a paid trial; actual tenant
entitlements and the existing ordinary-positive / privileged-fail-closed route
remain NEEDS ACCOUNT CHECK. No premium MFA, custom-domain/card feature or trial
is assumed. Candidate comparison can precede account creation; LOCAL-GATE-003
cannot pass from pricing documentation alone.

### Static ProjectX compatibility and the gateway gap

CONFIRMED source at starting SHA:

- `apps/api/src/staff-auth/config.ts`: `loadStaffAuthConfig` requires HTTPS,
  root app origin, same-origin exact `/api/v1/staff-auth/callback` without query,
  and same-origin logout without query. Given all other valid configuration,
  `https://localhost:8443`, its exact callback and root logout satisfy those
  checks. A consistent `https://127.0.0.1:8443` set also satisfies them; mixed
  hosts/ports do not. This is static control-flow evidence, not an executed test.
- `deploy/gateway/start.sh`: the canonical host must contain a dot and cannot
  contain a colon. Bare `localhost` and `localhost:8443` are rejected. The nginx
  template checks raw Host and forwards the configured canonical host without a
  port. Thus adding external TLS does NOT make the current gateway compatible
  with the proposed non-default localhost authority. Do not strip the port,
  fake a different canonical Host, or weaken the API check to disguise this gap.
- A literal `127.0.0.1` canonical host passes that validator syntactically. An
  external default HTTPS port 443 might avoid the authority-port conflict, but
  requires separate Auth0 IP registration, port availability, TLS/SAN and gateway
  proof. The gateway's internal unprivileged PORT is not the browser TLS port.
  This alternative is INFERRED, not tested or approved.
- `deploy/gateway/nginx.conf.template`: access log fields are allowlisted
  request ID/status/size/timing, excluding URLs and headers; error destination
  is `/dev/null` at crit. Existing forwarding/Host/cookie/cache controls stay
  unchanged. Fixed upstream `X-Forwarded-Proto: https` only has meaning behind
  a genuinely trusted HTTPS edge; it does not turn plaintext into TLS.
- `apps/api/src/main.ts` starts the existing HTTP application, not a TLS wrapper;
  `apps/api/src/app.ts` disables automatic request logging and uses safe error
  logging. These facts do not prove a new terminator's logs safe.
- `apps/web/src/staff-auth/client.ts` rejects a cross-origin API. Keeping web and
  `/api/v1` on one exact HTTPS origin is required; no CORS workaround.

NEEDS TESTING / bounded follow-up review: canonical authority compatibility of
the chosen local edge with the unchanged gateway. A new gateway change, if
necessary, requires separate authorization and regression evidence. LOCAL-004
can test a fake endpoint without claiming it has solved this integration gap.

### Local TLS choices and trust lifecycle

These are design candidates, not installation instructions or authorization.
No public domain, paid CA or public inbound listener is required for local TLS.

| Method | Issuer / trust / private key | Suitability and limitations |
| --- | --- | --- |
| A: external TLS in front of existing gateway | Local CA from B/C; leaf and key outside Git on this machine | INFERRED architectural fit for retaining API-prefix, Host, forwarding and cookie rules. Does not resolve the canonical-host gap above. Browser TLS must terminate before the existing private HTTP hop. |
| B: Caddy local HTTPS | Caddy local root/intermediate; locally stored keys; root must be trusted by the actual browser | CONFIRMED supports localhost and IP names. Explicit loopback bind required; default binds are unsuitable. Automatic HTTP redirect listener/admin endpoint require bounded configuration review. Proxy access/error logs need independent proof. |
| C: mkcert + reviewed proxy | mkcert-generated local CA and leaf; local root-key file must remain secret; exact DNS/IP SANs | CONFIRMED certificate tooling, not a proxy. Can cover localhost/127.0.0.1/::1 distinctly. Each HTTP proxy adds authority/header/logging review. No assumption that installing a certificate makes the proxy safe. |
| D: existing Node/native TLS wrapper | Would require an approved local issuer/trust arrangement | CONFIRMED no such ProjectX startup wrapper exists. Platform TLS capability alone is not an already compatible deployment path. Do not invent a bespoke auth-aware Node proxy or enable Windows server features for this task. |
| E: stunnel + local certificate | Local CA/leaf as C; stunnel is a mature TLS byte-forwarder | INFERRED smallest parsing surface for a fake inert test: TLS termination without intentional HTTP URL parsing. Verify failure diagnostics, explicit loopback bind and HTTP/1.1 ALPN/upstream compatibility; not a claim of zero logging or complete ProjectX compatibility. |

Evidence: [Caddy local HTTPS](https://caddyserver.com/docs/automatic-https),
[bind](https://caddyserver.com/docs/caddyfile/directives/bind),
[global options](https://caddyserver.com/docs/caddyfile/options),
[mkcert](https://github.com/FiloSottile/mkcert),
[stunnel HOWTO](https://www.stunnel.org/howto.html),
[Windows configuration](https://www.stunnel.org/config_windows.html).

CONFIRMED source/documentation: mkcert's Windows backend calls
`CertOpenSystemStoreW` for ROOT, which Microsoft documents as current-user, not
local-machine, access. A reviewed current-user-only trust route is preferable
to machine-wide installation, but browser and organizational policy can still
prevent trust. See [mkcert Windows source](https://raw.githubusercontent.com/FiloSottile/mkcert/master/truststore_windows.go)
and [Microsoft certificate-store contract](https://learn.microsoft.com/en-us/windows/win32/api/wincrypt/nf-wincrypt-certopensystemstorew).
Pin/review the eventual executable/version before use; moving source is research,
not verification of an installed binary.

NEEDS TESTING for every viable option: actual browser store use, warning-free
chain validation, SAN match, browser restart/reload requirement and any enterprise
policy constraint. Windows trust-store changes require explicit owner approval;
no automatic elevation or machine-store fallback. Caddy may attempt trust
installation itself; a future test must bound/approve that behavior first.
Never bypass certificate warnings, disable validation, or use insecure flags.

Proposed cleanup: inventory existing roots first; track only the test CA's exact
fingerprint and stores; stop exact test listeners; remove that CA from each
approved store/profile (tool untrust/uninstall with identity verification), then
remove its isolated leaf/key/CA files outside Git. Preserve all pre-existing
trust. Verify distrust and absent listeners after cleanup. A browser restart may
be necessary; an OS restart/elevation requires separate permission. A trusted
local CA can impersonate other HTTPS sites if its key is stolen: use restricted
ACLs, no synced folder/repository, minimal lifetime, no shared CA key, no service
installation, and no persistent startup changes. This is not a production PKI.

### Confidentiality, HTTP and browser behavior

INFERRED target path: browser -> local trusted TLS -> private gateway -> API;
API -> Auth0 outbound token/JWKS traffic; API -> private restricted PostgreSQL16.
There is no public inbound tunnel. On a controlled browser/machine without a
forward proxy intercepting loopback, the callback query is not routed through a
third-party reverse proxy. Auth0 legitimately knows the code it issued. This
removes a transport intermediary, not all OAuth/browser/local disclosure risks.

NEEDS TESTING: only explicit loopback TLS is usable for browser/auth traffic;
inspect IPv4/IPv6 and Docker host publications. No `0.0.0.0`/LAN/public bind,
firewall change, public ACME validation or public DNS. Prefer no HTTP browser
listener. If an HTTP listener is deliberately approved, reject auth/API writes
before application processing; any redirect must be edge-only. Prove all six
methods and fake bodies do not reach the app. Private gateway/API HTTP hops
must not become an alternative trusted browser ingress; use private networking
and documented exposure checks. Local malicious processes are a separate risk,
not solved by loopback TLS or PKCE.

CONFIRMED documentation: [Caddy access logging](https://caddyserver.com/docs/caddyfile/directives/log)
has sensitive-header handling, but query filtering is a separate concern. Do
not assume access filtering covers error logs. Stunnel's protocol-neutral design
reduces HTTP-aware logging opportunity (INFERRED); normal/failure/debug, Windows
service/event/crash logs and any telemetry remain NEEDS TESTING. Never solve a
known leak merely by discarding logs. Prefer a component/configuration that
does not collect callback URLs in the first place, with minimal useful safe
error categories verified using fake sentinels.

Minimum future procedure: isolated browser profile without sync/extensions or
remote debugging; synthetic data only; no HAR/net-export, preserved DevTools
network log, screenshots of callback address bars, screen recording, or crash
upload containing URLs. Review browser history/address bar and OS/proxy/app
diagnostics using fake values first. Existing callback responses set no-store
and no-referrer and redirect to a clean root; this reduces exposure but does not
prove absence from history, diagnostics or extensions. Retain only redacted
results, not raw query-bearing logs. Test success AND origin refusal, timeout,
reset, malformed request and application failures before real OAuth approval.

CONFIRMED source (`oidc.ts`, `routes.ts`, `credentials.ts`, `store.ts`): keep
PKCE S256, exact state/nonce, one-use database login transaction, server-side
exchange, issuer/sub mapping, no email linking, session expiry/revocation, RLS
and privileged fail-closed controls. INFERRED: changing only a reviewed exact
origin need not weaken these. Auth0 documents local app impersonation risk;
trusted local host/processes remain an assumption, not something PKCE eliminates.
See [Auth0 app impersonation guidance](https://auth0.com/docs/secure/security-guidance/measures-against-app-impersonation).

CONFIRMED cookie contract: `__Host-` login/session cookies retain Secure,
HttpOnly, SameSite=Lax, host-only/no Domain, Path=/; deletion retains matching
name/host/path with Max-Age=0. Multiple Set-Cookie must not be folded. INFERRED:
top-level GET Code callback works with Lax; form_post is not substituted.
Cookies are not isolated by port, whereas Origin includes the port. Localhost
and 127.0.0.1 are different cookie hosts. Browser localhost Secure exceptions
mean cookie flags alone cannot prove HTTP rejection. Avoid concurrent unrelated
localhost apps and use an isolated profile. Actual storage, prefix enforcement,
deletion, JS inaccessibility and two-cookie handling remain NEEDS TESTING.
See [browser Set-Cookie reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
and [RFC6265](https://www.rfc-editor.org/info/rfc6265/).

CONFIRMED source: API Host equals configured origin authority, foreign forwarded
host is rejected, Origin (or Referer origin fallback) and session CSRF checks
remain required for mutations. INFERRED: one exact localhost HTTPS web/API
origin is compatible once ingress authority is solved. NEEDS TESTING: wrong
port/scheme/host, missing headers, CSRF replay and synthetic cross-site requests.

INFERRED multi-instance feasibility: two existing API processes can share the
same database-backed login/session state behind one browser origin. CONFIRMED:
current gateway takes one API host:port, not an explicit two-instance load
balancer. No ready-made two-instance local routing mechanism was established.
Future bounded verification must choose reviewed test-only deterministic routing
or a controlled A-to-B upstream switch without changing browser origin, cookies,
database or security checks; no public instance endpoint or sticky-session-only
proof. Demonstrate login/callback across instances, session reuse/revocation and
one-use races. This is not a new production load-balancer architecture, and none
of these runtime checks ran here.

### Public candidates: primary-source findings

CONFIRMED [Tailscale Funnel documentation](https://tailscale.com/docs/features/tailscale-funnel):
public TLS-only ingress, limited ports 443/8443/10000, tailnet DNS hostname,
TLS terminates on the local device; Funnel relay does not decrypt payloads.
Thus do not claim relay plaintext callback visibility. Exact HTTP rejection
and header/cookie behavior still need an inert test. CONFIRMED
[pricing](https://tailscale.com/pricing): Personal Free is for non-commercial
use; ProjectX eligibility is UNKNOWN, not established by a personal login.
Business trial availability is not sustainable $0 approval. Account/policy/HTTPS
configuration required; actual card/plan entitlement NEEDS ACCOUNT CHECK.
[Logging documentation](https://tailscale.com/docs/features/logging) describes
local and centrally collected diagnostics; callback fields in local failure
or uploaded diagnostics are UNKNOWN. Disabling telemetry is not proof of
request-log safety. Conditional candidate only, not preferred.

CONFIRMED [ngrok Free limits](https://ngrok.com/docs/pricing-limits/free-plan-limits):
assigned development domain and quotas; free browser interstitial can alter the
flow. [Pricing](https://ngrok.com/pricing) advertises $0 plus finite usage credit;
actual continuing entitlement must be reconciled with the limits before use.
HTTP card requirement was not established; do not use card-verified TCP as a
workaround. CONFIRMED [HTTPS termination](https://ngrok.com/docs/gateway/domains/tls-termination)
is at ngrok for HTTP endpoints, so it can see callback queries. The
[agent inspection interface](https://ngrok.com/docs/gateway/agent/web-inspection-interface)
captures requests including query/body/headers and permits replay. That default
is incompatible with real callback confidentiality. Free raw TLS passthrough
is not assumed. [HTTP endpoint documentation](https://ngrok.com/docs/gateway/endpoints/http)
also describes added forwarding headers. HTTPS URLs alone do not establish
absence of an HTTP endpoint; explicit rejection/redirect policy would need proof.
Request-inspection disabling would not prove cloud/error-log non-retention.
Not recommended under current evidence.

CONFIRMED [Cloudflare Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
supports managed named tunnels/hostnames, but account, suitable domain/DNS and
actual free entitlement must be checked; a new domain is not assumed free.
[Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/)
offers an edge redirect control absent from the tested Quick Tunnel, subject to
exact-host/method proof. Access policy is not query redaction. CONFIRMED
[connector logging controls](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/monitor-tunnels/logs/)
include local/remote diagnostics; no documented destination-query redaction
guarantee resolving CHK-075 was established. Edge TLS also exposes plaintext
to the provider. Named configuration alone does not fix a known connector error
path; no suppress-logs workaround. Not recommended without new specific evidence.

Other candidates: CONFIRMED [Codespaces billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces)
has account-dependent included quotas, not an unconditional $0 environment.
[Forwarded ports](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)
add private-port login or public exposure and a different hosting/logging boundary.
INFERRED no advantage here over local TLS; entitlement and confidentiality
UNKNOWN. No obscure reverse-SSH service recommended merely for price.

### Comparison (documentation facts versus untested deployment)

CONFIRMED (C) means cited documentation/source or historical CHK-075, not live
candidate proof. INFERRED (I), UNKNOWN (U), NEEDS TESTING (T) are explicit below.

| Requirement | Local HTTPS | Tailscale Funnel | ngrok Free | Cloudflare named/free | Quick Tunnel history |
| --- | --- | --- | --- | --- | --- |
| Incremental recurring cost | I $0 on existing machine | U ProjectX Free eligibility | C advertised $0; U durable quota entitlement | U $0 if eligible account/domain already available | C $0 canary |
| Card | C no transport purchase | U actual account | U HTTP eligibility; no paid workaround | U actual account/domain | C none used |
| Account | C no transport account; Auth0 later | C required | C required | C required + DNS | C none for transport |
| Stable hostname | I fixed exact local authority | C device/tailnet name dependent | C assigned dev domain | C owned configured hostname | C ephemeral |
| Public exposure | I none with loopback-only binding | C public | C public endpoint | C public edge; Access optional | C public |
| Public HTTP | I no public listener; local HTTP must fail pre-app | C TLS-only feature; T exact response | T explicit enforcement required | C redirect control; T deployed behavior | C FAILED: HTTP forwarded |
| Third-party callback query | I no transport intermediary; Auth0 expected | C relay cannot decrypt; U diagnostics | C cloud TLS sees query | C edge TLS sees query | C edge TLS; local query leak |
| Operator request logs | T local-only allowlist review | U request fields; C diagnostics | C inspection includes query | C connector/remote logs; U retention | C sampled info/error logs |
| Failure/error leakage | T fake-sentinel proof required | U local/uploaded fields | U full error retention, known inspection | U no documented query-safe correction | C FAILED fake code/state |
| HTTPS enforcement | T trusted local cert + no plaintext app ingress | C TLS-only ingress; T integration | T HTTPS endpoint alone insufficient | T exact redirect/reject boundary | C not HTTPS-only |
| Host/authority | C API accepts; gateway gap; T solution | T exact Host and forwarded headers | C forwarding added; T preservation | T canonical/forwarded handling | C CHK-075 normal preserved, duplicate normalized |
| Cookies | I compatible; T browser/port isolation cautions | T headers/browser | T interstitial and cookies | T complete path | C raw headers only; T browser |
| CSRF | I one exact origin; T browser | T one origin integration | T one origin integration | T one origin integration | T not ProjectX-tested |
| Auth0 exact callback | C HTTPS localhost example; T tenant | I exact HTTPS hostname | I exact assigned hostname | I exact configured hostname | I possible registration, NOT approved |
| Free-tier stability | I no service quota; local maintenance | U commercial eligibility/beta | U quotas/credit/interstitial | U account/domain/plan | C no availability guarantee |
| ProjectX changes | C API config fits; gateway authority unresolved | U none established | U none established | U none established | C no safe fix approved |
| Owner decision | Required local trust + D006 specialization | Required eligibility/public trust decision | Required; confidentiality unresolved | Required; confidentiality unresolved | No real-use approval |
| Major risk | Local CA/key/logs + gateway integration | Eligibility + diagnostic visibility + public attack surface | Callback inspection/cloud visibility | Known connector error path not resolved | Confirmed two failed gates |

### Owner decision required — proposed CORE-AUTH-D008 (NOT APPROVED)

QUESTION: May a $0, synthetic-only, local trusted HTTPS environment specialize
the development authority/logout root, subject first to LOCAL-004 fake transport
proof and later separately authorized gateway/account/environment integration?
WHY IT MATTERS: D006's Render-host wording does not authorize a localhost logout
root, and a local trust-store change affects this machine's HTTPS trust. D007
does not authorize arbitrary architecture substitutions. No D004–D007 record
is edited or revoked; D005 remains the future approved paid Render path, deferred
under D007. This is a deployment specialization requiring explicit owner approval,
not a new auth protocol or an approved production replacement.

- OPTION A: exact `https://localhost:8443` (proposed port only) with callback
  `/api/v1/staff-auth/callback` and logout `/`, per-user local certificate trust,
  fake-only LOCAL-004 first. Pros: official localhost precedent, no public tunnel,
  smallest third-party boundary. Cons: local root/key risk, browser proof and
  explicit gateway authority compatibility follow-up needed.
- OPTION B: exact `https://127.0.0.1` on 443 with IP SAN and root logout.
  Pros: current gateway host syntax may fit without non-default authority.
  Cons: Auth0 HTTPS IP acceptance and port/bind compatibility unproven; cannot
  infer readiness or authorize privileged changes.
- OPTION C: Tailscale Funnel only if sustainable $0 ProjectX eligibility and
  diagnostic confidentiality can be established. Pros: public trusted certificate
  and encrypted relay. Cons: accounts/software/public exposure, unresolved plan
  and local/platform-log risks; no permission to start a trial.
- OPTION D: defer real-provider verification and retain current blocked gates.
  Pros: no new trust, cost or exposure. Cons: delays required staff foundation
  and reservation work; does not implicitly authorize paid Render.

RECOMMENDED TECHNICAL DEFAULT: A for a separately authorized **fake-only** test,
with mkcert current-user trust + a reviewed mature TLS terminator (prefer reviewing
stunnel's byte-forwarding configuration first; Caddy remains an alternative).
Actual component/version, exact available port, certificate lifecycle and bounded
commands must be reviewed before execution. If elevation/restart/machine-wide
trust is required, STOP for approval. No option approved by this research.
Record the eventual owner choice in the decision registry in a separately
authorized decision task; D008 is only an unresolved proposal here.

### Next bounded task: CORE-AUTH-02-ENV-LOCAL-004

**Disposable localhost HTTPS transport verification** — PLANNED, execution
BLOCKED pending explicit owner trust/tooling/URI authorization. Part2 required
foundation for safe staff verification before SETTINGS-CORE-01 and reservation
book/check-in/seating. Scope: disposable fake app and synthetic markers only,
outside Git. No Auth0, ProjectX, database, account, public exposure or runtime
repository edits in its initial experiment. Passing it is necessary but not
sufficient to authorize actual ProjectX/Auth0 setup or declare LOCAL-001 READY.

Proposed acceptance and regression checks (not executed):

1. Review exact binaries/checksums/configuration and certificate/key storage;
   snapshot only relevant trust/listener state. No paid dependency or service.
2. Trusted browser TLS without warnings; correct localhost SAN; wrong-host and
   untrusted certificates fail; no insecure flags. Explicit IPv4/IPv6 loopback
   only, no LAN/public listener, no firewall/router/DNS change.
3. Fake callback code/state received intact; exact Host/port retained; reject
   malformed, duplicate/conflicting authority and spoofed forwarded trust.
   Prove behavior at each parsing boundary, not just successful TLS.
4. Plain HTTP GET/HEAD/POST/PUT/PATCH/DELETE, including fake bodies, must not be
   processed as trusted HTTPS. Verify no bypass to the origin's app routes.
5. Fake __Host-/Secure/HttpOnly/Lax/Path=/ cookies: distinct Set-Cookie fields,
   actual browser storage, no JS read, deletion, host distinction and port-sharing
   implications. Preserve Origin/Referer/CSRF-shaped headers and no-store on
   302/401/403/404/500; these are transport checks, not real CSRF verification.
6. Inspect safe normal and refused/timed-out/reset-origin, malformed-TLS/HTTP
   and application-error diagnostics for unique fake query/cookie/auth sentinels.
   Include terminator, fake app, browser, relevant Windows event/crash and any
   telemetry surface. Unexpected query persistence FAILS; do not merely hide logs.
7. Teardown exact test processes/listeners/certificates/trust entries/temp files;
   verify trust reversal and no startup/service changes. Keep redacted evidence.
8. Run pnpm map:check and git diff --check for evidence documentation; preserve
   CHK-075, all previous checks/26 VERIFIED tasks and reference classifications.

After a successful inert test, separately resolve gateway exact-authority and
two-instance verification arrangements, D006 specialization and Auth0 Free
account checks before authorizing any actual environment setup. Only a fully
ready environment permits resuming the existing real-provider matrix. Keep
RLS/restricted PostgreSQL16, issuer/sub, PKCE/state/nonce/one-use and privileged
fail-closed requirements intact. Do not start Settings, reservations or Export.

LOCAL-003 validation is documentation-only: pnpm map:check, git diff --check,
JSON/IDs/DAG and exact historical/VERIFIED/decision/reference/scope comparisons.
No runtime suite or provider behavior is claimed from this review. All findings
above concern ProjectX/transport design, never SevenRooms evidence or parity.

## CHK-077 — CORE-AUTH-D008 owner approval (2026-10-13)

CONFIRMED OWNER APPROVED / PROJECTX DEPLOYMENT DECISION:
**CORE-AUTH-D008 — Localhost HTTPS verification authority and trust policy**.
The owner explicitly selected **Option A** from CHK-076, with the bounded policy
below. This dated approval resolves the earlier proposed/unapproved policy state;
CHK-075/076 and all prior evidence remain unchanged as historical records.
Decision registry: `docs/project-map/decisions.json`, CORE-AUTH-D008.

This is DEVELOPMENT / VERIFICATION only, not production/staging approval,
production architecture, general certificate policy or permission for exposure.
D004-D007 are unchanged. D005 remains future approved paid Render development,
deferred under D007's current $0 budget. D006 remains historical authority for the
Render root logout; D008 specializes D006/D007 only for this local verification
path. No Auth0 federated logout, SSO termination or signed-out page is approved.

### Exact approved authority

| Setting | Approved value |
| --- | --- |
| Canonical origin | `https://localhost:8443` |
| Host/authority | `localhost:8443` |
| Callback URI | `https://localhost:8443/api/v1/staff-auth/callback` |
| Post-logout URI candidate | `https://localhost:8443/` |
| Post-logout path | `/` |
| Certificate SAN | DNS name `localhost` only |

No alternate hostname, IP-literal canonical URL, port, wildcard or localhost HTTP
application ingress is authorized. Do not add unnecessary SANs: 127.0.0.1, LAN or
machine hostname, wildcards and public domains require separate approval. Binding
a socket to a loopback IP does not authorize using that IP as the browser origin
or certificate name. Host/authority behavior remains NEEDS TESTING. The existing
gateway rejects bare localhost and non-default port authority: approval is NOT
gateway compatibility evidence or permission to change that validator.

### Trust and tooling policy, not execution permission

- CURRENT USER ONLY, where supported; local, temporary and reversible trust.
  If current-user-only trust is impossible, STOP for owner decision. No
  machine-wide/organization-wide trust or permanent system CA installation.
- **mkcert** is the preferred certificate-generation/local-trust candidate for
  the future fake-only experiment. Exact current version must be reviewed before
  download, with official source/checksum/signature evidence verified where
  available. No tool, root CA or certificate is installed/created here.
- **stunnel** is the FIRST TLS-terminator candidate to review because a narrow
  TLS byte-forwarder avoids an application-platform replacement. This approves
  neither a version nor installation/configuration/service registration/startup
  persistence. Review supported version, official artifact integrity, normal and
  failure logging, loopback bind, Host preservation, no public/LAN plaintext
  listener and cleanup before any separately authorized execution.
- If stunnel cannot satisfy the boundaries without weakening ProjectX, STOP.
  No silent Caddy/other switch; another terminator needs explicit documented
  justification and owner approval if materially different.
- Browser trust must be genuine and warning-free, with SAN matching; no Common
  Name-only shortcut, warning acceptance, disabled certificate validation,
  `--ignore-certificate-errors` or other insecure flags. No elevation or OS
  restart without separate approval. No permanent service or startup changes.
- Private keys stay local, temporary, restricted and outside Git. Inventory
  relevant current-user trust first; add only the minimum approved temporary
  trust during separately authorized LOCAL-004; create only the required test
  certificate; run fake tests; stop all processes; remove test certificate and
  locally added root/trust entry as appropriate, preserving pre-existing trust;
  remove keys/temp configuration; verify trust/listener/process cleanup; retain
  sanitized documentation only. Never commit certificate/private-key material.

### Future LOCAL-004 acceptance boundaries

LOCAL-004 remains **PLANNED**, eligible for separate explicit execution
authorization only AFTER D008 documentation is published with green CI. It is
not IMPLEMENTED, VERIFIED or DONE. Review exact bounded commands before execution.
This decision-recording task runs no experiment.

Initial test: fake disposable app, callback markers, cookies, headers and
authorization values only. No ProjectX, Auth0, PostgreSQL, real OAuth code/state/
nonce/session/credentials or customer/reference/employee data. Both TLS ingress
and fake backend bind only required loopback interfaces. No 0.0.0.0, LAN/public
exposure, router/port-forwarding/firewall change, public DNS or public tunnel.

HTTPS-only application/auth traffic: HTTP must be rejected before fake app
processing, or redirected safely at the edge before application/auth/body
processing. Body-bearing HTTP must not arrive at the app as trusted HTTPS.
Hardcoded forwarded https is not proof. CHK-075 is the unchanged negative
precedent, not a risk acceptance.

Required fake-only proof remains NEEDS TESTING:

1. Sentinel leakage in terminator normal/failure/error logs, fake-app logs,
   practical browser history, relevant Windows diagnostics/events and crash
   paths. Unacceptable persistent fake code/state leakage FAILS; suppression
   must not hide it. No real callback permitted.
2. Real-browser Secure/HttpOnly/SameSite=Lax/host-only/Path=/ behavior: two
   distinct Set-Cookie fields, storage, JavaScript exclusion, deletion, hostname
   handling and cookies' port-sharing implications. Raw curl headers alone fail
   to establish browser behavior.
3. Normal localhost:8443, wrong Host, missing Host where protocol permits,
   modified port, malformed and safely testable duplicate/conflicting authority;
   spoofed X-Forwarded-Host, X-Forwarded-Proto, Forwarded and X-Forwarded-For.
   Measure behavior; do not relax ProjectX authority trust.
4. Same-origin, hostile and absent Origin and Referer. This is transport proof,
   not actual ProjectX CSRF enforcement. No CORS workaround.

### Remaining gates and priority

Passing LOCAL-004 is necessary but insufficient for real environment setup.
Remaining prerequisites include exact gateway localhost:8443 compatibility,
deterministic multi-instance routing, actual Auth0 Free capabilities, separately
authorized local PostgreSQL16 restricted-runtime setup and real-provider
verification authorization. No Auth0 tenant/application/user, ProjectX setup,
database or real login is authorized by D008.

CORE-AUTH-02 IMPLEMENTED; LOCAL-001 BLOCKED; LOCAL-GATE-001/002 BLOCKED;
LOCAL-GATE-003 BLOCKED / NEEDS ACCOUNT CHECK; provider NEEDS TESTING; ENVIRONMENT
READY NO; SETTINGS-CORE-01 PLANNED awaiting VERIFIED authentication. Quick Tunnel
remains NOT APPROVED for real callbacks: public HTTP reached origin and fake
callback values appeared in connector error logs. No rerun or suppression fix.

Part2 REQUIRED FOUNDATION: trusted staff authentication precedes reservation-
required Venue settings and subsequent staff reservation workflows. Core gate
UNMET; Part3/Export remain deferred. No reference classifications or U-001/002/003
changed and no SevenRooms parity claims made.

Next execution task remains LOCAL-004, but the immediate administrative
prerequisite is separate exact-SHA publication approval for this decision commit
and green CI, followed by separate LOCAL-004 execution authorization. No push
in this task. Validate map/diff, JSON/IDs/DAG, all 76 prior checks, 26 VERIFIED
tasks, D004-D007, reference history and six-document-only scope; no runtime
verification claimed from recording owner policy.

## CHK-078 — LOCAL-004 package preflight stopped (2026-10-15)

CONFIRMED: the owner separately authorized the disposable fake-only experiment
after publication of `8d98e296f29401bc37eaa0e2fa82f3a758669424`. Local HEAD,
fetched remote and clean worktree matched. Starting-commit CI38499363640 /
job115642382623 passed both gates, DB210/210 in21 files on PostgreSQL16.15.
This is prior publication evidence, not localhost transport or provider proof.

**LOCAL-004 = BLOCKED — LOCAL-004-PACKAGE-001.** The authorized prompt explicitly
requires STOP if the available Windows package requires elevation or permanent
installation. No installer was executed and no UAC was triggered. No mkcert,
certificate, CA, trust, app, listener, browser experiment or alternate terminator
was started. D008 remains APPROVED; its authority/trust constraints are unchanged.

### Official artifact findings

- CONFIRMED: [mkcert latest-release API](https://api.github.com/repos/FiloSottile/mkcert/releases/latest)
  returned [v1.4.4](https://github.com/FiloSottile/mkcert/releases/tag/v1.4.4),
  published 2022-04-26. This establishes the latest upstream release, not a
  separately documented support commitment. The
  [version-pinned Windows source](https://raw.githubusercontent.com/FiloSottile/mkcert/v1.4.4/truststore_windows.go)
  uses CertOpenSystemStoreW ROOT. No `mkcert -install`, binary download or
  execution occurred; mkcert local SHA256 is NOT AVAILABLE. An explicit
  CurrentUser-only import/removal would need bounded review before execution.
- CONFIRMED: [stunnel downloads](https://www.stunnel.org/downloads.html) and
  [release notes](https://www.stunnel.org/NEWS.html) identify stable5.82,
  dated2026-09-17;5.83 is unreleased/beta. The listed stable Windows artifact is
  [stunnel-5.82-win64-installer.exe](https://www.stunnel.org/downloads/stunnel-5.82-win64-installer.exe).
  No Windows portable archive is listed on that inspected page.
- CONFIRMED: downloaded installer SHA256
  `722c1ad626919af2b0034666b4d19cc4795e925c32f60e8f3c59af4fb3ad2dfc`
  exactly matches the [official checksum](https://www.stunnel.org/downloads/stunnel-5.82-win64-installer.exe.sha256).
  PowerShell Get-AuthenticodeSignature returned Valid / Signature verified,
  signer Open Source Developer Michał Trojnara. Upstream detached PGP signature
  exists but was not independently verified; do not claim otherwise.
- CONFIRMED: static inspection of that signed installer found
  `requestedExecutionLevel="highestAvailable"`. The official5.82 source archive's
  tools/stunnel.nsi corroborates Highest execution level and persistent
  install/uninstall registry metadata, uninstaller and shortcuts. These are
  installer findings, not service execution or observed UAC behavior.
- INFERRED: highestAvailable can prompt an administrator for elevation; it does
  not prove every account must elevate. The installation/persistence model is
  outside this portable-only task regardless. The explicit stop condition was
  applied before execution, not tested by launching the installer.
- UNKNOWN: safe non-executing extraction and portable operation of its payload.
  No payload extraction/build/installer workaround was attempted after the
  stop condition. This does NOT establish stunnel runtime unsuitability or that
  portable operation is impossible. No Caddy/other switch is approved.

### Cleanup and evidence limitations

CONFIRMED: installer, checksum and source archive were downloaded only under
`C:\Users\barak\AppData\Local\Temp\projectx-local004-20261015-307bcb7`.
The resolved exact directory and parent were checked before removal. All three
files and the directory were removed; absence confirmed. An earlier empty
sandbox-temp directory was not present at the same absolute parent on the next
read; nothing was downloaded or executed there. No temporary material entered Git.

CONFIRMED: no test CA/leaf/private key or thumbprint was ever created; neither
CurrentUser nor LocalMachine trust was modified. Postchecks found zero
LOCAL004-labelled roots, zero8443 listeners, zero stunnel processes/services and
zero LOCAL004/stunnel-named scheduled tasks. No backend or port was allocated,
and no startup action occurred. These bounded checks are NOT a full trust-store
diff, unrelated-system audit or demonstrated certificate-trust reversal. No
certificate cleanup or post-removal browser test was applicable. No software was
installed, no system elevation/restart/purchase/public/LAN exposure occurred.

NEEDS TESTING: every runtime acceptance criterion remains unexecuted: trusted and
untrusted browser TLS; IP-literal rejection; HTTPS/plaintext methods/body isolation;
normal/wrong/missing/port-modified/malformed/duplicate Host; forwarding headers;
callback/query and Authorization/Cookie normal/failure logs; Origin/Referer;
multiple Set-Cookie and browser Secure/HttpOnly/Lax/host-only/deletion/port-sharing;
no-store/status; browser callback history and Windows diagnostic sentinel checks.
No sentinel was sent. Do not interpret NOT RUN as PASS or a security failure.

### Owner decision and exact resume boundary

QUESTION: Which bounded acquisition review may resolve LOCAL-004-PACKAGE-001
without launching the installer or relaxing the no-elevation/no-persistence policy?
WHY IT MATTERS: portable execution was required, but the reviewed official Windows
artifact is an installer; safe payload acquisition/execution has not been established.

- OPTION A — Separately authorize non-executing extraction feasibility and
  integrity/dependency review of the exact signed official package, using a
  reviewed already-available extraction method only. Pros: retains stunnel and
  avoids installer execution. Cons: extraction tooling and portable dependency/
  config behavior remain UNKNOWN; review alone does not authorize payload execution.
- OPTION B — Obtain an official upstream portable distribution/confirmation.
  Pros: clearer supported portable packaging. Cons: none listed at preflight;
  availability and timing UNKNOWN. No outbound contact authorized here.
- OPTION C — Separately approve review of a different terminator, such as Caddy.
  Pros: alternative packaging may fit. Cons: changed tool/trust/logging surface
  requires a new bounded review; no automatic switch or installation.
- OPTION D — Defer LOCAL-004. Pros: no additional system risk. Cons: staff
  real-provider verification and dependent reservation work remain blocked.

RECOMMENDED TECHNICAL DEFAULT: A, review only; no elevation, installer execution,
installation, certificate/trust change, service/startup or alternative tool.
EXACT CHANGE REQUESTED: separate owner authorization for this non-executing
portable acquisition review, not permission to run the installer. RESUME POINT:
LOCAL-004 step4 package gate; after a permitted acquisition path is reviewed,
revalidate repository/versions and remaining steps under bounded execution approval.

NEXT EXACT TASK: Owner decision — resolve LOCAL-004-PACKAGE-001 portable stunnel
acquisition boundary before resuming CORE-AUTH-02-ENV-LOCAL-004. LOCAL-005 is not
created/started because fake transport has not passed.

LOCAL-GATE-001/002 remain BLOCKED with CHK-075 failures preserved;003 BLOCKED /
NEEDS ACCOUNT CHECK; LOCAL-001 BLOCKED; CORE-AUTH-02 IMPLEMENTED; provider NEEDS
TESTING; ENVIRONMENT READY NO. Core readiness remains UNMET; required Part2
authentication precedes reservation Venue settings/book/check-in/seating. Part3
Export remains deferred. All77 prior checks,26 VERIFIED tasks,D004-D008 and all
SevenRooms classifications/U-001/U-002/U-003 are preserved. No parity claim.
Only five authorized documentation files change; local child commit only, no push.
