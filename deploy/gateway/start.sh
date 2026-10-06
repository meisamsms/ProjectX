#!/bin/sh
# Non-secret deployment inputs only. Never eval or expand the full environment.
set -eu
umask 077
fail() { printf '%s\n' 'Gateway configuration rejected' >&2; exit 1; }
valid_host() {
  [ "${#1}" -le 253 ] && printf '%s\n' "$1" | awk '
    /^[a-z0-9][a-z0-9.-]*$/ {
      n=split($0,a,".");
      for(i=1;i<=n;i++) if(length(a[i])>63 || a[i]!~/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/) exit 1;
      exit 0;
    }
    {exit 1}'
}
valid_port() {
  case "$1" in ''|*[!0-9]*|0*) return 1;; esac
  [ "${#1}" -le 5 ] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}
canonical=${GATEWAY_CANONICAL_HOST-}
upstream=${GATEWAY_API_HOSTPORT-}
port=${PORT-10000}
bind=${GATEWAY_LISTEN_ADDRESS-0.0.0.0}
dns_port=${GATEWAY_DNS_PORT-53}
valid_host "$canonical" || fail
case "$canonical" in *.*) ;; *) fail;; esac
case "$upstream" in *:*) ;; *) fail;; esac
api_host=${upstream%:*}
api_port=${upstream##*:}
valid_host "$api_host" && valid_port "$api_port" || fail
valid_port "$port" && [ "$port" -ge 1024 ] || fail
valid_port "$dns_port" || fail
case "$bind" in 0.0.0.0|127.0.0.1) ;; *) fail;; esac
# Gateway must never receive server-side credentials, even empty ones.
forbidden=${AUTH0_CLIENT_SECRET+x}${STAFF_RUNTIME_DATABASE_URL+x}${DATABASE_URL+x}
[ -z "$forbidden" ] || fail
# Use actual container resolver configuration, never an invented platform IP.
# IPv4-only controlled milestone; IPv6-only resolver requires bounded review.
resolvers=$(awk '
  $1=="nameserver" && $2~/^[0-9.]+$/ {
    n=split($2,a,"."); ok=(n==4);
    for(i=1;i<=n;i++) if(a[i]!~/^[0-9]+$/ || a[i]>255 || length(a[i])>3) ok=0;
    if(ok) printf "%s ",$2;
  }' /etc/resolv.conf) || fail
[ -n "$resolvers" ] || fail
resolvers=$(printf '%s\n' "$resolvers" | awk -v p="$dns_port" '{for(i=1;i<=NF;i++) printf "%s:%s ",$i,p}')
canonical_regex=$(printf '%s' "$canonical" | sed 's/[.]/[.]/g')
runtime=/tmp/projectx-gateway
mkdir -p "$runtime/client" "$runtime/proxy" || fail
sed -e "s|@@CANONICAL_HOST@@|$canonical|g" \
    -e "s|@@CANONICAL_REGEX@@|$canonical_regex|g" \
    -e "s|@@API_HOSTPORT@@|$upstream|g" \
    -e "s|@@PORT@@|$port|g" \
    -e "s|@@LISTEN_ADDRESS@@|$bind|g" \
    -e "s|@@DNS_RESOLVERS@@|$resolvers|g" \
    /opt/projectx/nginx.conf.template > "$runtime/nginx.conf" || fail
if ! nginx -t -c "$runtime/nginx.conf" >/dev/null 2>&1; then fail; fi
# exec preserves SIGTERM/SIGQUIT; no shell wrapper remains around nginx.
exec nginx -c "$runtime/nginx.conf" -g 'daemon off;'
