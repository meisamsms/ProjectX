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
