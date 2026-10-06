# CORE-AUTH-02 — deterministic verification and deployment boundary

2026-10-05. PROJECTX IMPLEMENTATION EVIDENCE under ADR-0003/0004 and approved
CORE-AUTH-D004. Base 84ed2938d7d1fa6155e744a50ef3d6aebe6f978c.
Parent task IMPLEMENTED; controlled Auth0/production assurance remains NEEDS TESTING.
No SevenRooms evidence or parity claims.

## Shared-loopback reachability diagnosis — CHK-068 / DEPLOY-002-VERIFY-002

2026-10-06. Diagnostic-only task; clean starting
`6029f6512ad89722c05f0fc7a9f101d903f1f827`, exact ancestry and fetched remote
`75da5c2adb9a99049945d2df2401537d9e92e675` confirmed. Docker29.8.2 local
desktop-linux/npipe, Linux/WSL2 unchanged. No rebuild, full GW harness rerun,
functional file change, system setting change, provider resource or purchase.

Harness inspection: random UUID container names; `--network host`, no published
port; read-only root, `/tmp:rw,noexec,nosuid,size=32m`, ALL capabilities dropped,
no-new-privileges. Windows Node mock binds `127.0.0.1:${apiPort}` before container
start. nginx receives `PORT=${gatewayPort}`, `GATEWAY_LISTEN_ADDRESS=127.0.0.1`,
canonical `gateway.test.invalid`, upstream `127.0.0.1:${apiPort}`. Windows readiness
requests `http://127.0.0.1:${gatewayPort}/health` with the canonical Host,100 attempts
and100ms retry delay. Request socket deadline75s; this is not a strict10s overall
timeout. Any HTTP response counts as readiness, including502. Cleanup closes
owned apps/processes/mock/sockets and removes exact owned containers.

One disposable container used those same parameters, actual existing pinned image,
synthetic Windows mock port62215 and gateway port62216. Selected inspect showed
RUNNING before/after proof, exit field0 while running, OOMKilled=false, restart0,
empty state error; root read-only and tmpfs preserved. Actual generated config and
netstat showed `listen 127.0.0.1:62216 default_server`, canonical server_name;
no IPv6 listener at this gateway port. `docker port` empty; PortBindings and
NetworkSettings.Ports both empty. Nothing was published to an explicit Windows
host address/port.

**CONFIRMED LOCAL DIAGNOSTIC EVIDENCE — PRIMARY REACH-02, not GW PASS:**
built-in wget inside container: canonical root200, default/foreign Host403.
Windows curl with all three Host variants: HTTP000/connect timeout (~1s).
Exact Windows Node readiness: ECONNREFUSED. Windows mock control:200; gateway
inside `/health`:502. Thus the assumed shared Windows/Linux loopback does not
provide the required host-to-gateway or gateway-to-Windows-mock path here.
The Host header and numeric target port match; no Host/port-number mismatch.
Numeric upstream does not need hostname DNS;502 alone cannot explain readiness
connection failure because readiness accepts any HTTP response.

Start request22:14:56.781Z; Docker StartedAt22:15:03.827682747Z; first inside HTTP200
8.631s after request (~1.585s after container start). Windows never reached gateway
in this proof. Final probe12.375s after request (~5.3s after Docker start), not a
full10s post-start waiting proof. No nginx startup race demonstrated; no timeout
increase justified. Initial logs empty; final metadata-only statuses200/403/403/502.
No observed startup rejection/host-not-found message, but error logging is disabled,
so absent logs alone do not establish upstream success. Container/mock cleaned;
final Docker container listing empty.

**UNKNOWN / NEEDS TESTING:** underlying Docker Desktop host-network setting state
or contributing platform mechanics. No claim that Docker cannot support host
networking. REACH-09 prerequisites (0.0.0.0 listener and correct published port)
are not met. No Docker Desktop/firewall/WSL/security setting inspected or changed.
The confirmed correction scope is the harness network contract, not app/nginx
semantics; no functional fix authorized here.

Next exact task: **CORE-AUTH-02-DEPLOY-002-FIX-003 — Correct the confirmed
gateway/harness reachability defect**, separately authorized and limited to
`deploy/gateway/gateway.test.mjs`. Verify both directions using the actual image
without replacing nginx or weakening guards. Any need for another causal file
or system setting requires a separate stop/approval, not inferred permission.
GW-01–12 remain NOT EXECUTED; DB remains deferred/UNDETERMINED, search_path
INFERRED; historical207PASS/3FAIL on PostgreSQL16.15 not waived. Full image secret
review/API/regressions still incomplete. Documentation map/whitespace/preservation
checks PASS only. All67 prior checks, VERIFIED tasks, D004/D005, reference
classifications and U-001/U-002/U-003 preserved. DEPLOY-002 IMPLEMENTED /
VERIFICATION INCOMPLETE; CORE-AUTH-02 IMPLEMENTED; ENV-001 BLOCKED; provider
NEEDS TESTING; readiness NO. No SevenRooms evidence/parity claim or push.

## Runtime-path correction and harness blocker — CHK-067 / DEPLOY-002-FIX-002

2026-10-06. Exact clean starting HEAD `e5d49f7fec5fadfb5296c961b7dda81dc83d2a22`
and fetched remote `75da5c2adb9a99049945d2df2401537d9e92e675` confirmed.
New local functional child `e0a8d63ead4ce3b6885b44435dba03d6693ea077`
changes only six runtime-path directives in `nginx.conf.template`; no security,
routing, logging, timeout, limits, application, test, migration or package edits.
The prior buffer relationship16k/8x16k/32k is unchanged.

Official deployment/runtime guidance: [nginx-unprivileged upstream README](https://github.com/nginx/docker-nginx-unprivileged)
relocates PID and temporary state into `/tmp` and requires explicit temp-path
directives when overriding the full configuration. This is not SevenRooms evidence.
Before: PID `/tmp/projectx-gateway/nginx.pid`, client `/tmp/projectx-gateway/client`,
proxy `/tmp/projectx-gateway/proxy`; fastcgi/uwsgi/scgi directives absent.
After: PID `/tmp/nginx.pid`; client `/tmp/client_temp`; proxy `/tmp/proxy_temp`;
fastcgi `/tmp/fastcgi_temp`; uwsgi `/tmp/uwsgi_temp`; scgi `/tmp/scgi_temp`.

**PROJECTX LOCAL HARDENING / VERIFICATION CONFIGURATION:** existing harness already
uses read-only root, `/tmp:rw,noexec,nosuid,size=32m`, dropped ALL capabilities and
no-new-privileges. Harness unchanged; no persistent/repository write mount or system
setting change. Config and runtime state are ephemeral; no real credentials supplied.

**CONFIRMED: actual pinned image build and nginx syntax/startup PASS.** Both existing
immutable base references resolved unchanged. Local image digest
`sha256:db224107d88e066d13b2377f0d35eabd0abbf742b8f332288009e32b59b8b1af`.
Disposable actual read-only image started through unchanged entrypoint;
`nginx -t -c /tmp/projectx-gateway/nginx.conf` reported syntax/test successful.
PID and all five temp directories exist under `/tmp`; container Running=true.
No observed required-state error under `/var/cache/nginx`, `/run` or `/var/run`.
This proves isolated nginx startup, not an end-to-end gateway contract.

Only after the hard gate passed, one unchanged actual-image harness run failed:
`Local gateway did not listen` at waitForPort line158/shared before hook line442.
14 setup failures,0 PASS; GW-01–GW-12 bodies **NOT EXECUTED**. **UNKNOWN / NEEDS
TESTING:** exact runtime/Windows-host Docker loopback reachability cause. Do not
reinterpret shared setup failures as independent Host/cookie/CSRF/log defects.
No harness rerun, second speculative correction or system/network change.
Disposable containers cleaned; final `docker ps -a` empty.

Stopped before full image secret/filesystem/layer/generated-config/log review,
API build/entrypoint runtime proof, current/base DB comparison and regression
suite. Historical CHK-064 PostgreSQL16.15 207/210 remains unwaived; search_path
**INFERRED** only, no A/B/C/D classification or flakiness claim. Documentation
map/whitespace/preservation checks PASS only. Both historical startup failures,
all66 prior CHK records, VERIFIED tasks, D004/D005 and reference classifications
remain unchanged.

DEPLOY-002 IMPLEMENTED / VERIFICATION INCOMPLETE; CORE-AUTH-02 IMPLEMENTED;
ENV-001 BLOCKED BY DEPLOYMENT TOPOLOGY; provider NEEDS TESTING; readiness NO.
Next exact prerequisite: **CORE-AUTH-02-DEPLOY-002-VERIFY-002 — Diagnose GW-01
harness reachability after nginx startup**, separately authorized bounded
diagnosis before any further functional correction. No provisioning, push,
Settings/reservation/Export implementation or SevenRooms parity claim.

## Buffer correction and new startup blocker — CHK-066 / DEPLOY-002-FIX-001

2026-10-06. Clean starting HEAD `c1b854ff47e31dbc310dc00e7cc3813300a47752`,
parent `7bf65b39ed51eb7d39053138b5b1a1328b0c3e21`, fetched remote/base
`75da5c2adb9a99049945d2df2401537d9e92e675`. Local functional child
`3f228a17af42269801b05966350d1809ba4381ae` changes only two buffer directives.
Before: `proxy_buffer_size 16k`; `proxy_buffers`, `proxy_busy_buffers_size`,
`proxy_max_temp_file_size` and `proxy_temp_file_write_size` absent (defaults
not silently inferred). After: header buffer16k, `proxy_buffers 8 16k`,
`proxy_busy_buffers_size 32k`; both temp-file sizing directives remain absent.
No routing, Host, cookie, cache, logging, application, test or migration edits.

**CONFIRMED: image rebuild PASS, actual nginx configuration check FAIL.** Both
unchanged pinned base references resolved; local image digest
`sha256:c5096edf599e84db5de65c1781b1e18212062a0754fa96eb21e060918201d971`.
Actual unchanged entrypoint with read-only root and writable `/tmp` tmpfs generated
the configuration; direct `nginx -t` reported:

```text
nginx: the configuration file /tmp/projectx-gateway/nginx.conf syntax is ok
mkdir() "/var/cache/nginx/fastcgi_temp" failed (30: Read-only file system)
nginx: configuration file /tmp/projectx-gateway/nginx.conf test failed
```

Parsing success is not an overall gate PASS. No second speculative configuration
change was made. The harness was mistakenly launched before the syntax gate
passed; this procedural deviation is recorded, not hidden. Its single run exited1:
14 shared-setup failures,0 PASS, `Local gateway did not listen`. GW-01–GW-12
test bodies **NOT EXECUTED**, not independently failed behavior assertions.
Disposable containers were cleaned; `docker ps -a` returned empty. No rerun.

Final image filesystem/layer secret review, API build/entrypoint runtime proof,
database current/base comparison and regression gates remain **NEEDS TESTING**,
not executed after the failed first gate. CHK-064 PostgreSQL16.15 207/210 failure
and **INFERRED** search_path hypothesis are unchanged; no A/B/C/D classification,
flakiness claim or verify:db waiver. Documentation map/whitespace/preservation
checks PASS only; they do not verify gateway or provider behavior.

DEPLOY-002 **IMPLEMENTED / VERIFICATION INCOMPLETE**; CORE-AUTH-02 IMPLEMENTED;
ENV-001 BLOCKED BY DEPLOYMENT TOPOLOGY; provider NEEDS TESTING; readiness NO.
Next exact prerequisite: **CORE-AUTH-02-DEPLOY-002-FIX-002 — Correct nginx
auxiliary temp paths for read-only runtime**, requiring separate bounded
authorization. Do not change Docker/runtime protections to bypass the failure.
No resources, system changes, credentials or push. D004/D005, all VERIFIED tasks,
reference classifications and U-001/U-002/U-003 unchanged. CHK-065 below remains
historical evidence, including its original buffer failure.

## Local gateway verification attempt — CHK-065 / DEPLOY-002-VERIFY-001

2026-10-06; exact clean local implementation
`7bf65b39ed51eb7d39053138b5b1a1328b0c3e21`, parent and fetched remote base
`75da5c2adb9a99049945d2df2401537d9e92e675`. Docker Desktop29.8.2 is usable
with local `desktop-linux`, Linux x86_64 and WSL2 kernel. No Docker/Windows
setting, application code, gateway source, test, migration or provider resource
was changed.

**IMAGE BUILD PASS; ACTUAL NGINX SYNTAX/STARTUP FAIL.** The exact Dockerfile
resolved both recorded immutable base digests and built
`projectx-dev-gateway:local` at local digest
`sha256:ef0c5c0c249540f62f8bfb5e1ee3c30617e0ce6d329aba277d7919df2a035754`.
The build warning identifies public boolean `VITE_STAFF_AUTH_ENABLED`, not a
credential. Source secret-pattern review remains PASS; final image secret/filesystem
proof is incomplete because gateway verification stopped.

One unchanged harness run failed in the shared startup hook: the gateway never
listened, so GW-01–GW-12 did not independently execute and none is PASS. One
bounded disposable actual-image trace confirmed input validation and template
generation succeed. Direct actual-image `nginx -t` then reported:
`proxy_busy_buffers_size must be less than the size of all proxy_buffers minus one
buffer`, at generated config line136. The template sets `proxy_buffer_size 16k`
without a compatible explicit proxy buffer/busy-buffer relationship; this is a
CONFIRMED gateway configuration/startup defect, not Docker tooling failure or a
provider result.

Required STOP preserved. No harness rerun, database current/parent comparison,
format/lint/typecheck/contracts/map/auth/verify/verify:db rerun, source correction,
Render/Auth0 provisioning or push. CHK-064's PostgreSQL16.15 207/210 result and
three Add User failures remain historical unresolved evidence; search_path remains
INFERRED, not confirmed or waived.

CORE-AUTH-02-DEPLOY-002 remains IMPLEMENTED / VERIFICATION INCOMPLETE.
CORE-AUTH-02 remains IMPLEMENTED; ENV-001 remains BLOCKED BY DEPLOYMENT TOPOLOGY;
provider verification NEEDS TESTING; environment ready NO. D004/D005, all prior
VERIFIED history and SevenRooms U-001/U-002/U-003/classifications remain unchanged.

NEXT EXACT TASK: **CORE-AUTH-02-DEPLOY-002-FIX-001 — Correct nginx proxy buffer
configuration and restore gateway startup.** Separate bounded corrective
authorization is required. After correction, rebuild and run unchanged GW-01–GW-12,
then complete DB current-vs-parent classification and regression gates. No
provisioning before those local gates pass.

## Gateway implementation checkpoint — CHK-064 / CORE-AUTH-02-DEPLOY-002

2026-10-05; clean base 75da5c2adb9a99049945d2df2401537d9e92e675,
people-03-accounts-read. Explicit owner prompt APPROVES Candidate A1 implementation
in six deployment files plus four evidence docs only. PROJECTX DEPLOYMENT
IMPLEMENTATION, not SevenRooms evidence or a new authentication architecture.
DEPLOY-001 / CHK-063 below is retained as historical review, not overwritten.

**DEPLOY-002 IMPLEMENTED; LOCAL NGINX VERIFICATION BLOCKED BY TOOLING.**
No actual pinned-image build/run/nginx syntax/GW runtime pass is claimed.
CORE-AUTH-02 IMPLEMENTED, not VERIFIED; ENV-001 BLOCKED BY DEPLOYMENT TOPOLOGY;
provider NEEDS TESTING; ENVIRONMENT READY FOR CONTROLLED VERIFICATION: NO.

### Scope and current files

Task-selection gate: Part 2 required foundation for SETTINGS-CORE-01 and later
reservation book/check-in/seating. CORE-AUTH-01 and PEOPLE-CORE-01 VERIFIED,
DEPLOY-001 DOCUMENTED, D004/D005 APPROVED. Separate web/API entrypoints need a
canonical transport boundary before real-provider verification. DECISION: PROCEED
bounded implementation; local proof/provisioning gate remains BLOCKED.

Created only render.yaml, .dockerignore and deploy/gateway/{Dockerfile,
nginx.conf.template,start.sh,gateway.test.mjs}. The four evidence docs are the only
other changes. No API/web/auth code, existing tests, migrations, contracts,
packages/lockfile, production/staging, Settings/reservations/Export, resource,
purchase, Blueprint sync or push. The API remains the existing private Node/Fastify
service; static gateway contains no business/auth/database logic.

Unapplied development Blueprint: exactly one public Docker gateway and one native
private API, manual autoDeployTrigger "off", one instance each, fixed existing
build/entrypoint and API-only sync:false secret input names. Ohio/starter are
conditional D005 baseline candidates, NOT actual selected/provisioned region/tier.
Review actual availability, quote and memory fit BEFORE any future sync. Omitted
DB declaration: PostgreSQL16/tier/storage/runtime role/TLS must not be invented.
No hooks create/migrate databases. Both services must later share workspace/region.
GW configuration/source presence does not authorize applying this Blueprint.

Images are version + immutable multi-architecture index digest pinned:

- Node: node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df.
- Runtime: nginxinc/nginx-unprivileged:1.30.5-alpine3.24@sha256:15c994d10d6d78658721c3bcafff14cb281fba2a4bdf9d5ba92c416a472516e3.
- Intended local tag projectx-dev-gateway:local, NOT built.

CONFIRMED public registry metadata for
[Node](https://hub.docker.com/v2/repositories/library/node/tags/24.19.0-bookworm-slim)
and [nginx](https://hub.docker.com/v2/repositories/nginxinc/nginx-unprivileged/tags/1.30.5-alpine3.24).
No image pull/runtime proof. Existing pinned pnpm11.25.0 only; no new repository
dependency. Web build fixed public VITE_STAFF_AUTH_ENABLED=1 and relative /api/v1/.
Allowlisted context/COPY inputs exclude API/runtime/credentials/tests; final image
receives only web dist and gateway config/start. No ARG or env-file/secret copy.
Container build normalizes gateway script/template CRLF for Windows Git checkouts.
Static input audit includes the contracts routes.json runtime import; test/spec
source is excluded. GW-12 adds actual Docker context filtering with disposable
synthetic included/secret fixtures, but that proof has NOT executed without Docker.
Existing API build emits apps/api/dist/main.js; future start uses that entrypoint,
not a nonexistent package start script. Native Linux/Render startup remains unproven.

### Implemented configuration contract — runtime NEEDS TESTING

- One lower-case validated canonical DNS hostname; exact incoming Host match before
  fixed upstream Host. Foreign/missing/ambiguous/absolute-form authority fails
  closed (duplicate Host also nginx-parser boundary NEEDS TESTING). Only exact
  GET/HEAD /health may use platform probe Host; never auth/SPA bypass.
- Reserve /api and /api/ ahead of static/SPA, including all five staff-auth paths.
  No URI suffix/rewrite on proxy_pass; original methods/body/query/duplicates
  preserved; no redirects/retries/error interception or API-to-index.html.
- Fail-closed raw-path policy rejects percent-encoded paths, backslashes, duplicate
  slashes, dot segments and API namespace case variants before normalized routing.
  This deliberately also rejects otherwise benign percent-encoded web paths in
  this development milestone; query encoding remains untouched. Not a reference
  application rule. Actual parser/normalization proof still requires nginx.
- Origin/Referer/CSRF/context/Cookie remain real browser values. No identity/scope/
  permission/CSRF synthesis or CORS workaround. Remove X-Forwarded-Host, Forwarded,
  client IP/original-host/port metadata; fixed HTTPS forwarding only under the
  eventual verified Render HTTPS ingress. No current Fastify guard change.
- Separate Set-Cookie/host-only Secure/HttpOnly/SameSite=Lax/Path=/, logout expiry,
  status/Location preserved; no cookie-domain/path/flag rewrite. proxy_redirect
  off; X-Accel-Redirect/Buffering ignored, no internal redirect by upstream.
- No proxy cache/store/retry; preserve application Cache-Control/Pragma. Missing
  upstream Cache-Control and generated errors use no-store; conflicting CDN header
  hidden and fixed CDN-Cache-Control:no-store. index revalidates, generated assets
  may be immutable; missing asset 404; SPA only web GET/HEAD. Render edge cache
  actual bypass and two-browser separation remain NEEDS TESTING.
- Allowlisted request-ID/status/bytes/duration log only; no URI/query/request/header/
  body/Referer/cookie/Authorization/Location. URI-bearing error log disabled to
  /dev/null, explicit diagnostics loss. Syntax-check diagnostics suppressed and
  fixed startup failure message only; no environment/config printing.
- Body 1MiB, body buffer1MiB; initial header1KiB, four large16KiB buffers; upstream
  header16KiB. Connect5s, send/read60s inactivity (not total deadlines), client
  header15s/body60s, keepalive15s; no response buffering or body temp spill intended.
  Temporary-file/memory/boundary behavior still requires actual-image tests.
- start.sh validates canonical/upstream labels/ports and binds only 0.0.0.0 (future
  deployment) or 127.0.0.1 (local harness). Missing/malformed inputs/known credential
  variables rejected; explicit bounded substitutions only, no eval/envsubst.
  nginx -t before foreground exec; nonroot UID101, PID/temp paths under /tmp.
- Private DNS resolver IPv4 addresses derive from actual /etc/resolv.conf; no
  invented Render hostname/resolver IP/public fallback. nginx shared upstream zone
  with resolve, valid10s/resolver timeout5s. GATEWAY_DNS_PORT defaults53; bounded
  optional port exists solely for disposable loopback synthetic DNS fixture, never
  configured in Blueprint. IPv6-only resolver is a fail-closed documented limitation.
  GATEWAY_LISTEN_ADDRESS likewise is only a bounded local-isolation override.

The DNS mechanisms follow the
[nginx upstream reference](https://nginx.org/en/docs/http/ngx_http_upstream_module.html);
available directives are not proof of this configuration. Actual Render DNS/Host/
HTTP2/TLS/edge-cache/platform log semantics remain ENV-001 gates. nginx cannot
redact Render's ingress logs; NO real callback until platform query safety proven.

### Executed local evidence and preserved failures

CONFIRMED: Docker/nginx/Caddy absent on PATH; conventional Docker Desktop CLI absent.
No system installation/download or substitute handwritten proxy. docker build
could not execute. Node harness explicitly returns nonzero when tooling unavailable:
two static/pre-nginx checks PASS, twelve actual-nginx GW groups SKIPPED. Its
test-file failure is the intentional tooling blocker, not an nginx assertion result.

GW-01 through GW-12 all NEEDS TESTING / BLOCKED BY TOOLING. Harness implements
static/API/health, seven methods and binary hashes/query, headers/Host raw spoofs,
multiple cookies/logout, status/cache, callback/log/artifact canaries, real60s
timeout/disconnect/no replay, raw API-like paths, sizes/temp files, compiled API
guards, invalid inputs and shutdown. GW-12 includes a disposable loopback-only
synthetic DNS A-record change (actual nginx must refresh without restart). This
is a DNS fixture, not a replacement proxy. Its context probe reuses the built image
without pulls/network and cleans only its disposable image/directory. Uses local Linux Docker host networking,
127.0.0.1 gateway and mock API, temporary read-only synthetic resolver file and
cleanup; no real provider/DB. Windows Docker Desktop host-network compatibility
also needs proof. Missing tool/tests are never converted to PASS.

- Node syntax and existing Git sh -n PASS; scoped Biome stdin audit PASS (root
  format/lint commands do not include deploy/). Static/input checks are not nginx.
- pnpm --filter @projectx/api build PASS; actual emitted apps/api/dist/main.js starts
  on a random loopback port, /health200 and unauthenticated People route401.
  Disposable process stopped; no DB/provider. This is Windows module closure only.
- Flagged existing web build PASS, apps/web/dist, no server credential input.
- pnpm format:check/lint/typecheck/contract:check/map:check PASS; test:auth56/56 PASS.
- One pnpm verify PASS: unit4/4, auth56/56, integration19/19, web178/178, browser
  E2E32/32, static gates and builds. Browser-server cleanup stalled after all32;
  exact task-owned Vite process confirmed by command line and terminated, then the
  same command completed exit0. No test rerun or existing test modification.
- One pnpm verify:db FAIL: PostgreSQL16.15,207PASS/3FAIL across21files. Existing
  apps/api/tests/people/add-user.test.ts failed "atomically creates User, membership,
  explicit grants, venue access and pending provisioning"; "preserves nullable
  names/job title and notification null/false/true"; "returns one logical effect
  for an identical idempotent retry". Raw admin SELECTs report relation
  user_provisioning_invites/users does not exist. Existing files unchanged.
  INFERRED bounded cause: unqualified assertions rely on search_path after
  transaction-local fixture setup; new admin pool defaults differ. Not proven
  application regression, not a harmless warning, not fixed or silently rerun.
  Separately review/authorize test-environment verification; no out-of-scope fix.
- Test DB used existing portable PostgreSQL16.15 binaries and new loopback-only
  disposable cluster/random port/test-only owner, suffix_test, NODE_ENV=test/
  TEST_DATABASE=1; no existing/external DB touched. Stopped and removed afterward.
- JSON/DAG/ID/history/scope/diff/secret checks PASS. All63 prior check objects,
 26 VERIFIED tasks,54 unrelated task objects, D004/D005/ADRs and SevenRooms
  classifications/U-001/U-002/U-003 unchanged. Synthetic canaries only.

Shell-spawn deprecation/color/React Router build directives are non-blocking
maintenance warnings, unlike the recorded DB failures. No historical result
rewritten, no gateway/provider/reference parity or complete core readiness claim.

NEXT EXACT TASK: CORE-AUTH-02-DEPLOY-002-VERIFY-001 — Provide approved local Docker
tooling and complete gateway/regression verification. Separate authorization:
provide existing approved local Linux Docker/host-network tooling or explicitly
authorize installation; build actual image and run GW harness; review the preserved
DB failure and authorize scoped environment/rerun steps. No silent test/code fix.

Do NOT proceed to ENV-001 provisioning before required actual-nginx and regression
proof unless separately re-authorized. After local proof, actual environment gates
still remain; only environment ready YES permits the existing provider matrix.
SETTINGS-CORE-01 PLANNED, PEOPLE-09 READY / PART3 DEFERRED, PEOPLE-09B/10 PLANNED /
DEFERRED, IMPL-MOD-14 IN_PROGRESS. Local commit permitted with accurate blocker
record; separate exact-SHA push approval required. No push in DEPLOY-002.

## Gateway engineering review — CHK-063 / CORE-AUTH-02-DEPLOY-001

2026-10-05; exact clean base
`dd30e475b60ee6154e778b51bc221b8f0328d6b3`, branch people-03-accounts-read.
**RECOMMEND A.** Review status DOCUMENTED; this is a recommendation/specification,
not an owner-approved architecture change, gateway implementation or live proof.
Historical CHK-059–062 / ENV-002 findings below remain unchanged. The existing
repository absence findings are reconfirmed, not reversed.

TASK ID: CORE-AUTH-02-DEPLOY-001. PRIORITY PART: 2 REQUIRED FOUNDATION.
CORE WORKFLOW ADVANCED: safe real-provider staff access before SETTINGS-CORE-01
and future RESERVATIONS-CORE-01 book/check-in/seating. Dependencies CORE-AUTH-01
and PEOPLE-CORE-01 VERIFIED; D004/D005 APPROVED. DECISION: PROCEED review only.
Owned scope: native-rewrite evidence, minimal gateway contract, future files,
transport tests and cost comparison. Excluded: implementation, provisioning,
purchases, application/auth/test/migration/contract/package changes, Settings,
reservation domain and Export. Acceptance: assess C before A, specify every
critical boundary and unknown, preserve history and pass documentation checks.
No new reference evidence or parity claim; U-001/U-002/U-003 unchanged.

### Repository and public evidence

CONFIRMED repository evidence: API app/main serve existing JSON API and health,
not web assets. Vite has no API proxy; staffEndpoint/staffFetch reject another
origin and fetch with same-origin credentials. No tracked gateway artifact.
The staff hook requires exact configured Host and rejects **any** X-Forwarded-Host.
All proposed handling below preserves those application checks.

CONFIRMED PUBLIC RENDER CAPABILITY: the
[rewrite reference](https://render.com/docs/redirects-rewrites) permits a full
public URL destination, retains the browser-visible URL and documents wildcard
routing. The official [Redwood guide](https://render.com/docs/deploy-redwood)
specifically instructs a static frontend rewrite to an API service URL. This
adds precise public evidence; it does not erase CHK-062's missing-repository-seam
finding or establish safe authenticated proxy semantics. No Redwood code/setup
command, reference demo, account or example resource was used.

The [hybrid guide](https://render.com/tutorials/web-service-vs-static-site/the-hybrid-pattern)
also describes separate public browser/API origins. It is one deployment pattern,
not proof that every Render static frontend must use cross-origin requests.

### Candidate C — native static-site rewrite, assessed first

Potential routing: canonical Static Site /api/v1/* rewrite to public API URL,
before /* -> /index.html. This cannot target a Private Service: static sites
are outside [Render private networking](https://render.com/docs/private-network).
The API would need a public service. Documentation of routing is not a guarantee
of the following transport/security details for this particular rewrite.

| Required behavior | Classification / finding for Candidate C |
|---|---|
| GET, POST, PUT, PATCH, DELETE, OPTIONS (HEAD also tested later) | UNKNOWN — rewrite content routing documented, no complete method/auth contract established |
| Request body forwarding | UNKNOWN |
| Complete query preservation, duplicates and encoding | UNKNOWN |
| Content-Type, X-ProjectX-CSRF, X-ProjectX-Context-Version | UNKNOWN |
| Request Cookie forwarding | UNKNOWN |
| Upstream Set-Cookie forwarding | UNKNOWN |
| Multiple distinct Set-Cookie fields | UNKNOWN |
| Redirect status and Location preservation | UNKNOWN — rewrite's own no-browser-redirect property is not upstream-redirect proof |
| API response status preservation | UNKNOWN |
| Cache-Control / Pragma / no-store | NEEDS TESTING — static CDN content behavior is not authenticated rewrite cache proof |
| Sensitive callback query handling | NEEDS TESTING — forwarding and log exclusion must both hold |
| Host seen by upstream | UNKNOWN — must match current fixed canonical Host guard |
| X-Forwarded-Host | UNKNOWN — any forwarded value would fail the current guard |
| X-Forwarded-Proto | UNKNOWN |
| Client-supplied forwarding-header stripping/overwrite | UNKNOWN |
| Request/response/header size constraints | UNKNOWN for rewrite transport |
| Timeout behavior | UNKNOWN for rewrite transport |
| Rewrite edge caching | UNKNOWN; static sites are CDN-backed, not proof of rewrite cache safety |
| No API/auth fallthrough to index.html | NEEDS TESTING — ordering/resource matching documented; failed upstream and existing-file cases unproven |
| Query/cookie/Authorization/CSRF logging | NEEDS TESTING — no static-site logs in Render dashboard is not proof of no platform capture or upstream logs |

Candidate C = **NOT YET PROVEN**. Not recommended without every critical boundary
being proven. Do not infer failure of every method, unsafe forwarding or Render
incompatibility from missing documentation. No real rewrite test was attempted.

### Candidate A1 — minimal explicit gateway recommendation

INFERRED specification, with implementation/deployment behavior NEEDS TESTING:

Browser HTTPS -> Render public nginx Gateway Web Service
-> web assets/SPA from its immutable web-build image;
reserved API requests -> existing Node/Fastify Private Service
-> separately provisioned restricted-runtime PostgreSQL 16 later under ENV-001.

One gateway plus one API service: no extra web service, SSR, Node business wrapper,
new application framework, generic auth middleware or public API URL in the browser.
The gateway contains no business logic and no Auth0/database credentials.

[Private Services](https://render.com/docs/private-services) have no public
onrender.com endpoint. The gateway, API and database must share one compatible
region/workspace; private networking is not a cross-region link or a per-service
authorization system. Other same-workspace services are inside this network trust
boundary; do not claim network isolation from them without separate controls.
Use documented Blueprint fromService hostport, not a guessed/internal hostname,
fixed IP or client-selected upstream. Private DNS changes across deploys require
bounded resolver/reload tests; never fall back to a public API if resolution fails.

A2 (public gateway + public API) is not selected: public obscurity/Host checking
alone is not a gateway-only access control. Blueprint public service IP allowlists
require Scale/Enterprise per [reference](https://render.com/docs/blueprint-spec),
not the minimum development tier. Do not buy premium networking to simulate A1.

### Normative gateway contract — future implementation, not installed config

All requirements in this section are INFERRED deployment requirements; executable
proof and actual Render behavior remain NEEDS TESTING.

1. **Canonical authority and TLS.** One exact configured Render development
   hostname, no wildcard/alternate authority, no request-derived upstream/origin.
   For application routes validate incoming Host/HTTP2 authority before setting
   upstream Host to the configured canonical hostname (no private port/host).
   Reject missing/foreign/duplicate/ambiguous Host and absolute-form spoofing,
   including foreign Host with a forged canonical forwarding header.
   Render terminates HTTPS; [TLS docs](https://render.com/docs/tls) document HTTP
   redirects to HTTPS. Verify this ingress behavior before real cookies/callbacks.
   Do not treat nginx's internal HTTP scheme as the public scheme or trust
   arbitrary client X-Forwarded-Proto. On this fixed, verified HTTPS ingress send
   X-Forwarded-Proto=https; remove X-Forwarded-Host and Forwarded completely, plus
   client X-Forwarded-For/X-Real-IP/forwarded port/original-host metadata.
   No IP-based authorization is introduced. Current Fastify trust/Host guard stays
   unchanged. Strip-and-ignore a spoofed forwarded host is safe only after the
   independently accepted Host; it can never establish authority.
   Exactly GET/HEAD /health may accept the platform's health-check Host, exposing
   only upstream /health; this exception must never apply to /api or SPA routing.
2. **API precedence.** Reserve exact /api and all /api/ paths ahead of file/SPA
   matching, including /api/v1 and /api/v1/*. No trailing-slash redirect or prefix
   removal. Unknown API path/version remains API 404, never index.html.
   Explicitly cover /api/v1/staff-auth/login, callback, session, logout and context.
   No error_page-to-SPA, proxy_intercept_errors, X-Accel-Redirect processing or
   extension-regex override may turn API/auth errors into web content.
   Reject ambiguous path encodings/normalization (dot segments, encoded separators,
   duplicate slashes, case variants) before they can escape the reserved namespace;
   apply this to the path only, not sensitive query encoding. Test raw requests.
3. **Transparent transport.** nginx proxy_pass to a fixed private upstream with
   no URI suffix/path rewrite; preserve original path and complete query (including
   duplicate keys/encoding for the API's own rejection), original methods/body,
   Content-Type, Cookie, Origin, Referer, X-ProjectX-CSRF and
   X-ProjectX-Context-Version. Do not override method/body, synthesize headers,
   enable permissive CORS, fake same-origin or drop valid CSRF/context values.
   Forward normal headers except explicitly unsafe/hop-by-hop forwarding values.
   Preserve upstream statuses (including 400/401/403/404/409/500), redirect Location,
   Referrer-Policy and other end-to-end response headers; proxy_redirect off.
   No automatic upstream retries, including GET login/callback: these consume
   one-use protocol state. proxy_next_upstream off; upstream failure is a safe
   non-cacheable 502/504, no replay, fake success or partial-readiness claim.
4. **Cookies.** Do not introduce Domain, change Path/flags/values, coalesce multiple
   Set-Cookie fields, hide them, or rewrite cookie domain/path. Preserve separate
   callback login-cookie removal + session-cookie creation and logout Max-Age=0.
   Existing __Host cookies remain Secure, HttpOnly, SameSite=Lax, host-only, Path=/.
   Nothing in the browser targets the private API origin.
5. **Cache isolation.** Disable nginx proxy caching and Render gateway edge caching
   for this controlled milestone; no accidental service-worker/auth caching.
   Preserve upstream Cache-Control/Pragma; gateway-generated API errors also use
   no-store. Ensure CDN-Cache-Control cannot override this with a cacheable policy:
   suppress any conflicting upstream CDN header and emit no-store for API routes,
   without weakening the application's no-store header. No stale/cache fallback,
   request collapsing for API responses or forced caching of Set-Cookie responses.
   Local hashed assets may use immutable caching; index.html revalidates.
   Unknown assets return 404, not index.html. SPA fallback only for web GET/HEAD,
   never mutations or API. [Render edge caching](https://render.com/docs/web-service-caching)
   documents Cache-Control overrides and CDN-Cache-Control precedence; actual
   disabled-cache/account setting and two-client authenticated isolation still
   require live verification.
6. **Logging and callback secrecy.** Disable default combined access logs; permitted
   gateway metadata is generated request ID, numeric status, bytes and duration,
   without request line/path/query, Referer, IP/User-Agent, headers/body, upstream
   body, or cookie/Location values. Disable URI-bearing runtime error/debug logs
   (including nginx error output to /dev/null for the controlled canary stage);
   losing verbose diagnostics is explicit, not a durable-audit solution.
   Startup only emits fixed non-secret validation errors; never dump env or request
   config. Preserve existing API request-URL logging suppression/redaction.
   Callback queries pass untouched but never enter these gateway logs.
   [Render logging](https://render.com/docs/logging) documents Pro+ public HTTP
   request logs with requested URLs, no private-network request logs, and no
   static-site dashboard logs. nginx cannot redact an upstream platform edge log.
   Actual workspace logging/stream/query retention and Auth0 logging safety remain
   NEEDS TESTING: before any real login, use synthetic canaries and verify approved
   platform log surfaces, or obtain a documented exclusion/redaction guarantee.
   If sensitive callback values are captured and cannot be excluded, STOP ENV-001;
   do not declare safety merely because logs are inaccessible or a Hobby view hides them.
7. **Bounds and failures.** Proposed development transport bounds: request body
   1 MiB (matches inspected Fastify default; no app override), four 16 KiB large
   request-header buffers, 16 KiB response-header buffer, 5s upstream connect and
   60s send/read inactivity timeouts; no claim these are end-to-end deadlines.
   Malformed/oversized input rejects safely without request logging; timeouts fail
   without retry. Disable response buffering/temp response persistence and avoid
   request-body disk spill for bounded auth/People traffic; verify memory impact.
   Specify proxy_http_version 1.1, proxy_request_buffering off,
   proxy_buffering off, client_max_body_size 1m and client_body_buffer_size 1m
   in the future configuration; verify chunked and ordinary bodies and that the
   chosen image does not persist canaries in temporary files. Do not enable
   X-Accel-Buffering overrides or internal X-Accel-Redirect processing.
   Response-size/outer Render limits remain UNKNOWN until measured/documented;
   do not invent an unlimited guarantee. Verify boundary values, two Set-Cookie
   fields, slow/disconnected upstream and current API DTO/body-limit behavior.
8. **Startup and health.** Non-root pinned nginx image; foreground exec with
   SIGTERM handling, writable temporary dirs only as needed. Validate canonical
   hostname, private hostport and numeric port against bounded syntax; substitute
   only those non-secret template names, never the entire environment or nginx
   runtime variables. Reject arbitrary upstream URLs/config injection. Use actual
   Render private DNS resolver/reload behavior; no invented resolver IP.
   /health passes through solely to the existing API /health, no SPA fallback.
   Health reachability does not verify auth, database grants, login or the core gate.

nginx primary references establish available mechanisms, not a configured result:
[proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
[core routing](https://nginx.org/en/docs/http/ngx_http_core_module.html),
[logging](https://nginx.org/en/docs/http/ngx_http_log_module.html).
Use explicit directives in the future file, not implicit defaults or blindly
copied proxy examples. In particular, default upstream Host is not our canonical
Host. This contract needs no auth-guard relaxation or migration/package change.

### Existing builds and smallest future artifact set

CONFIRMED commands derive from manifests/tsconfig, not nonexistent start scripts:

- Repo-root frozen workspace install: pnpm install --frozen-lockfile.
- Web build: pnpm --filter @projectx/web build; artifact apps/web/dist.
  Build flag VITE_STAFF_AUTH_ENABLED=1; API base absent/default /api/v1/ or exact
  relative /api/v1/. No auth/database secret in any VITE variable.
- API build: pnpm --filter @projectx/api build; tsconfig rootDir src / outDir dist
  implies apps/api/dist/main.js. From repo root use node apps/api/dist/main.js
  as the future Render start command, NOT pnpm start (no such package script).
  Existing .node-version=24 and packageManager pnpm@11.25.0 remain unchanged.
  Pin/verify those tools during build, install dev build dependencies before
  compilation, and retain API runtime modules/workspace links. API native runtime
  is the minimal proposed choice; Linux module closure/startup NEEDS TESTING.
  Configure HOST=0.0.0.0, explicit PORT (proposed 10000), development-only scope,
  STAFF_AUTH_ENABLED=1 and existing secure server inputs later under ENV-001.
  If a bootstrap script becomes necessary, record a bounded deployment dependency
  before adding one; do not silently add app scripts or use dev/tsx-watch in deployment.

Future files only — NONE created here:

| Future path | Responsibility |
|---|---|
| render.yaml | Two DEVELOPMENT service declarations: Docker public gateway + native Node private API; one region/workspace, fixed build/start/private hostport references and manual deploy. No DB creation/migration hooks or secret values; do not apply/sync in DEPLOY-002. |
| .dockerignore | Exclude Git, env/secret files, logs and local artifacts from build context. |
| deploy/gateway/Dockerfile | Pinned Node24/pnpm web-build stage, then pinned unprivileged nginx; explicit input copies and web dist only in final image; no API/auth credentials or app source/runtime in final image. |
| deploy/gateway/nginx.conf.template | Routing/Host/header/cookie/cache/log/transport contract above; no business logic. |
| deploy/gateway/start.sh | Validate/substitute only non-secret bounded values; nginx syntax check and foreground exec, no env/config echo. |
| deploy/gateway/gateway.test.mjs | Local disposable harness for the actual nginx image, fixed mock upstream and synthetic canaries; no app-test changes, real Auth0 or database. |

These six future files include one proof harness; no Compose, extra API Dockerfile,
SSR, new dependency/framework, migrations or generic infrastructure subsystem.
Blueprint deployment must remain manually gated; even an unapplied Blueprint is
not authorization to create resources. Secrets are deployment-native API-only,
never a build ARG, gateway environment, Blueprint literal or copied env file.
Private hostport/canonical hostname are non-secret inputs; region/cost/actual
hostnames remain unselected. ADR-0001 separate-web/modular-backend and ADR-0004
identity policy are preserved. Recommendation is not a silently accepted ADR.

### Price comparison — public evidence, not a purchase quote

CONFIRMED public baseline from [pricing](https://render.com/pricing) and
[compute plans](https://render.com/docs/compute-plans): 0.5c-512mb / legacy Starter
service compute USD 7/month; Postgres 0.1c-256mb compute USD 6/month.
Static frontend has no compute plan. Smallest paid candidates only, not selections.

| Candidate | INFERRED compute-only scenario / month |
|---|---|
| C: static site + paid public API + PostgreSQL | USD 0 + 7 + 6 = 13 |
| A1: paid public gateway + paid private API + PostgreSQL | USD 7 + 7 + 6 = 20 |
| Increment for explicit gateway | USD 7 |

**Actual current minimum WORKABLE recurring total: UNKNOWN.** Workspace plan,
storage/usage/egress/build overages, taxes and Auth0 charges are outside these
compute sums; current account quote, PostgreSQL16/tier/region availability,
memory/load/build fit and platform logging are not tested. Private API networking
does not itself require buying premium private-link/Scale isolation. Do not use
spin-down/free service tiers as stable-verification proof. Do not buy HA, replicas,
autoscaling, annual commitments or extra instances. D005 remains approved; seek
separate approval BEFORE any material increase, including this gateway increment
if material. A recommendation does not silently expand the owner's cost authority.

### Future verification / execution gate

No local proxy proof was executed: nginx/Caddy/Docker commands were absent on PATH.
No substitute handwritten proxy, downloads, installs or temporary artifacts used.
All following GW checks are NEEDS TESTING and require the **actual pinned nginx**
image/config, not a mocked replacement. Temporary processes/fixtures must bind
loopback and be cleaned up; canaries are synthetic, never real auth credentials.

| Future ID | Required local proof |
|---|---|
| GW-01 | Startup validation, nginx syntax, static index/deep links/assets, /health API upstream; missing assets 404, web mutations not SPA |
| GW-02 | GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS method + body hash + query encoding/duplicates preserved |
| GW-03 | Content-Type/CSRF/context/Cookie/Origin/Referer forwarded unchanged; no synthesized CORS/identity/CSRF |
| GW-04 | Canonical/foreign/missing/duplicate Host, HTTP2 authority where supported, absolute-form spoof and forwarded-header combinations; upstream sees fixed Host, no XFH, fixed HTTPS |
| GW-05 | Two distinct Set-Cookie headers/host-only flags, login removal+session creation, logout expiry; no Domain or coalescing |
| GW-06 | 204/302/400/401/403/404/409/500 and Location/no-store/Pragma preserved, unknown API never SPA, edge-cache fixture assertions |
| GW-07 | Callback query canaries preserved only to upstream; duplicates rejected by unchanged API, errors/logs/build artifacts contain no canaries |
| GW-08 | Upstream unavailable/slow/disconnected: safe no-store 502/504, no retries/replay/SPA success |
| GW-09 | API-like paths with extensions, encoded separators/dot/duplicate/case variants cannot escape API reservation |
| GW-10 | Body/header/response-header boundary sizes, no secret temp-file persistence; documented timeout semantics |
| GW-11 | Actual unchanged compiled API entrypoint/module closure with controlled dependencies; auth Host/origin/CSRF failures remain fail-closed |
| GW-12 | Image/build-context secret exclusion, safe stdout/stderr, template injection rejection, graceful shutdown, private DNS refresh; no live sync |

Future focused commands (files do not yet exist; NOT executed here):
node --test deploy/gateway/gateway.test.mjs;
docker build -f deploy/gateway/Dockerfile -t projectx-dev-gateway:local .;
nginx -t inside that image. Existing regression gates after separately approved
implementation: pnpm test:auth, pnpm verify, pnpm verify:db using only existing
disposable PostgreSQL16 test authority. Missing Docker/test DB/tooling is reported,
never silently replaced or treated as PASS. Full real-provider matrix is later.

NEXT EXACT TASK: **CORE-AUTH-02-DEPLOY-002 — Implement and locally verify the
approved development same-origin gateway**, PLANNED pending a separate explicit
implementation prompt approving this bounded scope/recommendation. No automatic
implementation or provisioning. After local proof, ENV-001 still requires actual
approved deployment/role/TLS/cache/log evidence; only when environment ready YES
resume the existing CORE-AUTH-02 provider matrix.

CORE-AUTH-02 IMPLEMENTED; ENV-001 BLOCKED BY DEPLOYMENT TOPOLOGY; provider NEEDS
TESTING; environment ready NO. SETTINGS-CORE-01 remains PLANNED pending VERIFIED
CORE-AUTH-02; reservation domain and deferred PEOPLE-09/09B/10 unstarted,
IMPL-MOD-14 IN_PROGRESS. D004/D005, accepted ADRs and prior VERIFIED/check/reference
history unchanged. No resources, purchases, gateway configs or new auth code here.

## Provisioning stopped at topology gate — CHK-062 / CORE-AUTH-02-ENV-002

2026-10-05; exact clean starting HEAD
`12eb57b2d4edbad0b7238e9df8107c686e27e4f5`, branch people-03-accounts-read.
**CORE-AUTH-02-ENV-001 = BLOCKED BY DEPLOYMENT TOPOLOGY.**
Classification: CONFIRMED missing repository deployment seam; solution/provider
integration NEEDS TESTING / NEEDS OWNER/ENGINEERING DECISION.

No Render/Auth0 account configuration, purchase, resource creation, DB connection,
migration, synthetic identity, secret injection, endpoint deployment or full
provider matrix was attempted. No browser account authentication was reached;
external pre-existing infrastructure remains UNKNOWN, not proven absent.
D004/D005 APPROVED and prior verification evidence remain unchanged.

### Concrete repository evidence

- `apps/api/src/app.ts` registers health/auth/People API routes and a JSON not-found
  handler, not static web assets or SPA routing. `main.ts` starts that one server.
- `apps/web/package.json` builds a separate Vite bundle; `vite.config.ts` configures
  loopback dev/preview servers with no API proxy. Exposing that server does not
  create the required web/API gateway.
- `apps/web/src/staff-auth/client.ts` rejects API URLs outside the browser's origin
  and uses same-origin credentials. Changing VITE_API_BASE_URL to a separate API
  hostname is not a solution; do not weaken this guard or substitute CORS.
- `apps/api/src/staff-auth/routes.ts` requires canonical Host and rejects
  X-Forwarded-Host. A gateway must preserve that boundary and sensitive-cookie,
  callback-query, body/method, no-store and logging behavior.
- Tracked deployment artifact inspection found no Render manifest, Dockerfile or
  reverse-proxy configuration implementing this boundary at this base.

### Current public Render documentation, not account/deployment proof

[Web services](https://render.com/docs/web-services) expose one public HTTP port
per service and provide managed HTTPS. The
[static frontend/API hybrid guide](https://render.com/tutorials/web-service-vs-static-site/the-hybrid-pattern)
describes browser-to-API requests over separate public origins; it does not supply
the approved same-origin gateway. The
[redirect/rewrite page](https://render.com/docs/redirects-rewrites) allows path/URL
destinations but does not establish this authenticated all-method proxy contract.
Do not infer safe header/cookie/cache/log handling from rewrite syntax, or claim
that Render universally cannot host a suitable gateway.

[Regions](https://render.com/docs/regions) currently list US Oregon/Ohio/Virginia.
Ohio remains the owner preference; no actual region selected or account availability
confirmed. [PostgreSQL creation](https://render.com/docs/postgresql-creating-connecting)
documents majors 13–18, including 16. No database version provisioned; actual
version/tier and restricted-role/migration/TLS verification remain NEEDS TESTING.
[Compute plans](https://render.com/docs/compute-plans) and
[pricing](https://render.com/pricing) were reviewed: the public database candidate
0.1c-256mb lists USD 6/month for compute only, not a selected tier or complete
environment quote. Service topology, workspace/storage/usage and account-specific
cost must be established before purchase; no invented total or approved cost
escalation. Managed [TLS](https://render.com/docs/tls) and
[environment/secret injection](https://render.com/docs/configure-environment-variables)
are documented capabilities, not configured endpoints or injected secrets here.

Named Process/User/Machine presence checks: all seven required Auth0/origin/runtime
inputs plus STAFF_AUTH_ENABLED and VITE_STAFF_AUTH_ENABLED ABSENT. Values never
printed. This local finding does not establish external account configuration.
MFA, multi-instance and deployed log-redaction capability NEEDS TESTING.

### Narrow corrective prerequisite, not another authentication implementation

Proposed task: **CORE-AUTH-02-DEPLOY-001 — Specify and verify the same-origin Render
gateway prerequisite**. Status BLOCKED pending a separate bounded corrective prompt.
Affected modules: CORE-AUTH-02 / ENV-001, SETTINGS-CORE-01, RESERVATIONS-CORE-01.
Dependencies: CORE-AUTH-01 and PEOPLE-CORE-01 VERIFIED; D004/D005 APPROVED.
Owned scope: minimal deployment gateway/build/start wiring and safe routing proof
under the existing separate-web/modular-backend architecture. Excluded: auth/session
redesign, cross-origin workaround, new framework, migrations, production/staging,
Settings, reservations and Export. Exact focused commands must be specified before
implementation; no nonexistent gateway test script claimed here.

QUESTION: Which bounded gateway approach may be reviewed and implemented separately?
WHY IT MATTERS: the approved canonical origin cannot be exposed safely using only
the current API/Vite entrypoints; routing must preserve auth and cost boundaries.

- OPTION A: review minimal reverse-proxy deployment configuration for the existing
  separately served web/API. Pros: preserves ADR-0001 and auth behavior.
  Cons: requires reviewed deployment artifacts, header/log tests and a cost check.
- OPTION B: add static/SPA serving to the API entrypoint in a separate corrective
  task. Pros: one HTTP listener. Cons: runtime application/deployment-contract
  change requires explicit approval and regression coverage; not authorized here.
- OPTION C: demonstrate a platform-native same-origin routing solution before
  buying resources. Pros: could avoid application changes. Cons: cookie/method/
  Host/cache/log behavior is unproven; generic rewrite syntax is insufficient.
- OPTION D: defer environment provisioning. Pros: no spending or unsafe exposure.
  Cons: blocks real-provider verification and dependent core delivery.

RECOMMENDED TECHNICAL DEFAULT: A, only after bounded engineering review confirms
compatibility and minimum-development cost. No option selected/implemented or new
architecture approved here. Any actual architecture change requires a separately
approved decision/ADR; preserve D004/D005 and fail-closed auth.

Acceptance for the predecessor: one HTTPS web + /api/v1 origin, SPA/API separation,
correct methods/body/query/redirect/cookie handling, canonical Host and rejection/
stripping of untrusted forwarded Host, auth no-store, secret-safe logs, web assets
without API secrets, startup/health and regression checks, and confirmed smallest
suitable cost before purchase. No extra instance solely for this precheck.

CORE-AUTH-02 remains IMPLEMENTED; provider NEEDS TESTING, liveAuth0Tested false.
ENV-001 remains BLOCKED, owner-selection portion RESOLVED, provisioning OUTSTANDING.
ENVIRONMENT READY FOR CONTROLLED VERIFICATION: NO.
SETTINGS-CORE-01 stays PLANNED pending VERIFIED CORE-AUTH-02; reservations and
Part-3 Export remain unstarted/deferred. After a separately authorized gateway
correction, resume ENV-001 provisioning; only after readiness resume the existing
real-provider matrix. Documentation-only checks do not verify that matrix.
No secrets, new SevenRooms evidence or parity claims; U-001/U-002/U-003 preserved.

## Owner-approved development target checkpoint — D005 / CHK-061

2026-10-05; documentation base `cf6d4354eec1408a4f004857cdb944978e948c83`.
OWNER APPROVED / PROJECTX DEPLOYMENT DECISION, not executed provisioning or
controlled-provider verification. See authoritative CORE-AUTH-D005 in decisions.json
and the development policy in staff-access-integration.md. CHK-059/060 and all
historical results below are preserved without rewriting their limitations.

Approved 1A–5A: Render DEVELOPMENT; nearest suitable supported US region to
Arkansas, preferring Ohio IF offered at provisioning time; Render-provided HTTPS
hostname initially, custom domain DEFERRED; smallest normal stable paid/development
service/database tier; dedicated ProjectX Auth0 DEVELOPMENT tenant/application.
Ohio and actual region/tier/pricing/PostgreSQL 16 availability remain NEEDS TESTING
in the actual provisioning interface. Material cost/architecture escalation requires
STOP and new owner approval; no production/staging approval or annual commitment.
D004 remains unchanged and authoritative for authentication/session/assurance.

CORE-AUTH-02-ENV-001 remains **BLOCKED**. Owner selection RESOLVED; outstanding:
actual Render resources and availability/cost checks, actual Auth0 development
registration, canonical same-origin HTTPS endpoint/cookie verification, PostgreSQL
target, distinct restricted runtime role, deployment-native secret injection,
synthetic identity binding and sanitized controlled logs/evidence. No resources,
credentials or identities created here, no secret values recorded, no live test.
CORE-AUTH-02 stays IMPLEMENTED; providerVerification NEEDS TESTING, liveAuth0Tested
false. All existing controlled gates and fail-closed assurance boundaries persist.

Next exact task: **CORE-AUTH-02-ENV-001 — Provision approved Render/Auth0 development
environment**. No application code, production resources, Settings, reservations
or Export. Once ENVIRONMENT READY FOR CONTROLLED VERIFICATION: YES is supported by
evidence, resume this existing real-provider matrix, not new authentication code.
SETTINGS-CORE-01 remains PLANNED, blocked pending VERIFIED CORE-AUTH-02.
Documentation commit requires separate exact-SHA publication approval; no push or
provisioning in this approval-recording task. No new SevenRooms evidence/parity claim.

## Deterministic evidence

Focused files:

- O: apps/api/tests/staff-auth/oidc.test.ts (signed RSA fixtures, maintained library,
  controlled JWKS/token transport; not live Auth0).
- H: apps/api/tests/staff-auth/http.test.ts (HTTP guards, cookies, one-use callback,
  secret canaries; injected store/provider).
- D: apps/api/tests/staff-auth/database.test.ts (real PostgreSQL 16.15, restricted
  login, clean/populated upgrade, actual cookie -> People/RLS HTTP path).
- T: apps/api/tests/staff-auth/transaction.test.ts (broken rollback destroys client).
- W: apps/web/tests/staff-auth.test.tsx (minimal continuity, per-tab guard, no replay).
- P: existing People authorization, RLS and direct-grant database regressions.

Each PASS below is deterministic local evidence, not production or provider proof.
The real Auth0 equivalents remain a separate controlled gate. N32 verifies denial
only; a privileged success path is deliberately not exposed.

| ID | Verified negative boundary | Evidence |
|---|---|---|
| AUTH-N01 | Missing session, no module SQL | H |
| AUTH-N02 | Forged credential/hash, no disclosure | H, D |
| AUTH-N03 | Absolute/idle expiry; no polling renewal | D |
| AUTH-N04 | Durable revoked session never resurrected | D |
| AUTH-N05 | Disabled User denied then session unusable | D |
| AUTH-N06 | Revoked membership clears affected scope/version | D |
| AUTH-N07 | Revoked VenueAccess clears selected Venue/version | D |
| AUTH-N08 | Current required capability missing | D, P |
| AUTH-N09 | User/organization/venue/permission headers cannot replace actor | H, D |
| AUTH-N10 | Foreign organization selection | H, D |
| AUTH-N11 | Forged/nonexistent venue selection | H, D |
| AUTH-N12 | Cross-organization venue rejected | D |
| AUTH-N13 | Inaccessible venue not persisted | D |
| AUTH-N14 | Grant revocation is current, not frozen | D, P |
| AUTH-N15 | Tenant/org-only context cleanup and broken rollback | D, T, P |
| AUTH-N16 | Invalid issuer and foreign callback; fixed provider endpoints | O |
| AUTH-N17 | Invalid audience / authorized party | O |
| AUTH-N18 | Expired / future-nbf token | O |
| AUTH-N19 | Invalid RSA signature / unsigned algorithm / unavailable JWKS | O |
| AUTH-N20 | Missing/mismatched state, one-use transaction and expiry | O, H, D |
| AUTH-N21 | Missing/mismatched nonce | O |
| AUTH-N22 | Replayed callback correlation; PKCE sent; invalid_grant denied | O, H, D |
| AUTH-N23 | Missing/wrong CSRF for POST/PUT/PATCH/DELETE | H, W |
| AUTH-N24 | Foreign/null Origin, Host/proxy spoof, Referer fallback | H |
| AUTH-N25 | Logout durable before cookie clear; no reuse | H, D, W |
| AUTH-N26 | Rotation revokes predecessor, concurrent device unaffected | H, D |
| AUTH-N27 | Exact binding, duplicate-pair constraint, no email enrollment | O, D |
| AUTH-N28 | Deleted/rebound identity denies rather than actor substitution | D |
| AUTH-N29 | Current role/direct grant/capability changes | D, P |
| AUTH-N30 | Store unavailable / owner pool / missing production config | O, H, D, W |
| AUTH-N31 | Stale tab/version rejects without wrong-venue replay | H, D, W |
| AUTH-N32 | UNVERIFIED assurance/browser MFA cannot enable Add User | H; controlled MFA success NEEDS TESTING |
| AUTH-N33 | No callback/cookie/verifier/provider/client-secret canaries in logs/output | O, H |
| AUTH-N34 | No direct auth tables / PUBLIC execute / arbitrary actor function / unsafe pool / temp shadow | D |

## Commands and results

Final local results (CHK-059): pnpm verify PASS (unit 4/4, auth 56/56,
integration 19/19, existing web 178/178, browser E2E/axe 32/32, builds PASS).
pnpm verify:db PASS: 210/210 across 21 files, including 27/27 auth database tests
and all 183 existing database/API-contract tests on PostgreSQL 16.15.
Formatting/lint/typecheck/contracts/map checks and frozen install PASS.
Required commands: pnpm format:check; pnpm lint; pnpm typecheck;
pnpm contract:check; pnpm map:check; pnpm test:auth; pnpm verify; pnpm verify:db;
git diff --check. The main gate now includes test:auth, and verify:db includes D
alongside all existing People database files (serial shared disposable schema).
Historical People migration SQL is unchanged; expected ledgers include the new
auth migration with exact checksum, and Server Names tampering is found by name.

The first full database run had 200 PASS / 9 FAIL, all new-ledger compatibility
assertions across five existing test files. No domain/RLS behavior failed.
Those exact ledger expectations were extended; historical checksum/data/RLS
assertions were retained. Initial format and one new tuple TypeScript check failed
and were corrected. The known PEOPLE-06 focus test was not modified.

The second full database run had 209 PASS / 1 FAIL: core-persistence counted a
previous upgrade test's leftover Organization because it lacked a test-schema
reset. Added only the guarded reset before its migrations/fixture suite; all exact
counts and business assertions remain unchanged. No production cleanup added.

Environment: Windows, Node 24.19.0, PostgreSQL 16.15 official portable binaries
in a new disposable cluster bound only to 127.0.0.1:55436, synthetic database ending
_test with TEST_DATABASE=1/NODE_ENV=test. No Windows service or existing database
changed. Test-only owner seeds migrations; actual runtime tests use a separate
non-owner login with random credential and no BYPASSRLS. Test credentials never
reach Git/logs. Existing local Chrome supplies Playwright browser execution;
CI installs its own Chromium. Browser/axe results do not prove WCAG conformance.
Node shell-spawn deprecation, color and React Router directive warnings are
non-blocking maintenance notes, not failed tests.

## Controlled verification precheck — CHK-060, 2026-10-05

Base/published implementation: `8469fd5e21df350e4e6f59c5183ae0c347dbf6f0`;
exact clean HEAD and branch `people-03-accounts-read` confirmed. Existing
[CI run 37378038188](https://github.com/meisamsms/ProjectX/actions/runs/37378038188),
attempt 1 / job 111992282747, SUCCESS: pnpm verify and pnpm verify:db PASS;
PostgreSQL 16.15; auth 56/56, auth DB 27/27, all DB 210/210 across 21 files.
This is CONFIRMED exact-SHA CI evidence, not controlled provider/deployment proof.
CHK-059 and earlier results remain historical and unchanged; no rerun requested.

**CONTROLLED AUTH0 VERIFICATION = BLOCKED BY ENVIRONMENT SETUP.**
Presence-only checks found all seven required inputs unavailable in Process,
User and Machine environments: AUTH0_ISSUER, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET,
AUTH0_CALLBACK_URI, AUTH0_POST_LOGOUT_URI, STAFF_APP_ORIGIN and
STAFF_RUNTIME_DATABASE_URL. STAFF_AUTH_ENABLED and VITE_STAFF_AUTH_ENABLED are
also absent. No root/API/web `.env` or `.env.local` file exists at the six checked
conventional paths. These are CONFIRMED local-session findings, not proof that no
external tenant/deployment exists. No approved HTTPS endpoint, registration
settings, mapped test issuer/subject/User or development runtime-role evidence
was supplied; their external availability is UNKNOWN.

Live verification stopped at the environment precheck. No tenant/client creation,
configuration change, login, provider discovery, callback, DB connection, test-data
mutation, outage/rotation injection or mock replacement was attempted. No secret
values were printed or committed. No implementation defect established by this
precheck; no code/test/migration/contract change authorized or needed here.

| Controlled gate | Classification / result |
|---|---|
| Auth0 registration: Code/PKCE S256, exact callback/logout/origin/issuer/client/RS256 | UNKNOWN; registration/configuration not accessible |
| HTTPS browser cookie attributes, JavaScript exclusion and HTTP non-use | NEEDS TESTING; no approved HTTPS endpoint |
| Real login/callback, issuer/audience/signature/expiry/state/nonce/PKCE | NEEDS TESTING; not executed |
| Exact issuer/subject mapping, unknown binding/disabled denial, no email linking | NEEDS TESTING with real provider/test identity |
| Membership/VenueAccess/User revocation and Venue/context/version boundaries | NEEDS TESTING with real session and controlled test data |
| Rotation, absolute/idle expiry, no GET renewal, durable logout/no reuse | NEEDS TESTING in controlled deployment; 12h/30m/multiple policy unchanged |
| Callback negative cases, JWKS, key rotation and provider outage | NEEDS TESTING; no safe configured environment to induce cases |
| Multi-instance session/revocation | NEEDS TESTING; no two approved instances available |
| CSRF and Origin/Host with authenticated browser | NEEDS TESTING; not executed |
| Auth0 MFA/auth_time/recent assurance and privileged success | NEEDS TESTING; high-risk writes remain fail-closed |
| Ordinary core operations without blanket repeated step-up | NEEDS TESTING with real provider/core consumer; no reservation implementation or exemption proof |
| Deployed migration/runtime role/RLS/grants/TLS/pool isolation | NEEDS TESTING; no approved deployment database configuration |
| Controlled application/gateway/provider secret-free logs | NEEDS TESTING; no controlled logs available; local presence checks expose no values |

CORE-AUTH-02 remains IMPLEMENTED; providerVerification.status NEEDS TESTING and
liveAuth0Tested false. Positive privileged assurance is not verified. The owner
prompt permits a fail-closed privileged-exposure alternative only with controlled
proof that required ordinary reservation-core operations remain usable; that proof
is absent here. No production Auth0 or integrated core readiness claim is made.

Required predecessor (CORE-AUTH-02-ENV-001): owner/admin securely provision the
approved development registration/configuration outside Git, canonical HTTPS
gateway/endpoint, pre-existing exact test identity binding and restricted runtime
database/role/TLS evidence, plus access to sanitized controlled logs. Do not paste
secrets into chat/docs or use migration-owner credentials for app requests. No new
product/architecture choice is required. Resume the controlled matrix only after
these inputs are available; do not start SETTINGS-CORE-01, reservations or Export.
This task records documentation locally only; separate exact-SHA approval is
required to publish it.

## Original implementation deployment/provider checklist — historical

The six items below are the original CHK-059 checklist. Publication item 6 is now
satisfied by the CI evidence above; provider/deployment items remain NEEDS TESTING.

1. Separate Auth0 confidential web-client registrations for dev/staging/production;
   exact HTTPS issuer, client ID/audience, callback/logout allowlists, RS256 and
   token-endpoint client_secret_post + Code/PKCE supported. Secrets injected outside
   Git; provision pre-existing exact issuer/subject binding without email linking.
2. Reviewed migration/provisioning procedure for existing projectx_test schema;
   scoped runtime role membership and no owner/assumable elevated/global roles;
   verified database TLS/credential handling, production storage/retention and
   deployment health. Test runner is not a production migration tool.
3. Canonical same-origin HTTPS gateway preserves configured Host, strips
   X-Forwarded-Host and exposes no permissive credentialed CORS; secure cookies work
   in a real browser; VITE_STAFF_AUTH_ENABLED=1. Verify access-log redaction at the
   gateway/provider too. Auth events never constitute durable domain audit.
4. Live Auth0 login/callback, bad/reused code/state/nonce/PKCE, issuer/audience/key
   rotation/outage and exact binding; cookie fixation/rotation, multi-instance
   consume/revoke, local logout, 12h/30m expiry and current access revocation.
   Local logout is not federated/global Auth0 logout.
5. Auth0 MFA/auth_time/reauth claim provenance and approximately-five-minute
   freshness. Privileged success remains denied until independently proven and
   separately scoped exposure is authorized; ordinary operations stay ungated
   by repeated MFA. Never interpret browser MFA flags as assurance.
6. Separate exact-SHA approval to push this local implementation, then final
   branch-head CI pnpm verify + verify:db on PostgreSQL 16. No push in this task.

No new owner product/architecture decision required. SETTINGS-CORE-01 still awaits
VERIFIED CORE-AUTH-02; no core readiness or Export scheduling advancement.
