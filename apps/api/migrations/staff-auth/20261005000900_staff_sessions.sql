-- CORE-AUTH-02 only. No changes to historical People tables/policies/migrations.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='projectx_staff_auth_runtime') THEN
  CREATE ROLE projectx_staff_auth_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA projectx_test TO projectx_staff_auth_runtime;

CREATE TABLE projectx_test.staff_login_transactions (
 browser_hash text PRIMARY KEY CHECK (browser_hash ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK (state ~ '^[A-Za-z0-9_-]{43}$'),
 nonce text NOT NULL CHECK (nonce ~ '^[A-Za-z0-9_-]{43}$'),
 verifier text NOT NULL CHECK (verifier ~ '^[A-Za-z0-9_-]{43}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '5 minutes'
);
CREATE TABLE projectx_test.staff_sessions (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 user_id uuid NOT NULL REFERENCES projectx_test.users(id) ON DELETE RESTRICT,
 identity_id uuid NOT NULL,
 issuer text NOT NULL,
 subject text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_activity_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 absolute_expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '12 hours',
 revoked_at timestamptz,
 authenticated_at timestamptz,
 organization_id uuid,
 venue_id uuid,
 context_version integer NOT NULL DEFAULT 1 CHECK (context_version > 0),
 CHECK (venue_id IS NULL OR organization_id IS NOT NULL)
);
CREATE INDEX staff_sessions_user_idx ON projectx_test.staff_sessions(user_id);
ALTER TABLE projectx_test.staff_login_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projectx_test.staff_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON projectx_test.staff_login_transactions, projectx_test.staff_sessions FROM PUBLIC, projectx_people_runtime, projectx_staff_auth_runtime;

CREATE FUNCTION projectx_test.staff_login_start(h text, st text, nn text, pk text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, projectx_test, pg_temp AS $$
BEGIN
 IF h IS NULL OR h !~ '^[0-9a-f]{64}$' OR st IS NULL OR st !~ '^[A-Za-z0-9_-]{43}$'
 OR nn IS NULL OR nn !~ '^[A-Za-z0-9_-]{43}$' OR pk IS NULL OR pk !~ '^[A-Za-z0-9_-]{43}$'
 THEN RAISE EXCEPTION 'Invalid login transaction' USING ERRCODE='22023'; END IF;
 DELETE FROM projectx_test.staff_login_transactions WHERE expires_at <= clock_timestamp();
 INSERT INTO projectx_test.staff_login_transactions(browser_hash,state,nonce,verifier) VALUES(h,st,nn,pk);
END $$;
CREATE FUNCTION projectx_test.staff_login_consume(h text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, projectx_test, pg_temp AS $$
DECLARE t projectx_test.staff_login_transactions%ROWTYPE;
BEGIN
 DELETE FROM projectx_test.staff_login_transactions WHERE browser_hash=h RETURNING * INTO t;
 IF NOT FOUND OR t.expires_at <= clock_timestamp() THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('state',t.state,'nonce',t.nonce,'verifier',t.verifier);
END $$;

-- Internal actor-scoped enumeration; NOT executable by runtime/PUBLIC.
CREATE FUNCTION projectx_test.staff_own_contexts(actor uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, projectx_test, pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('organizationId',m.organization_id,'venueId',va.venue_id)
 ORDER BY m.organization_id,va.venue_id),'[]'::jsonb)
 FROM projectx_test.organization_memberships m
 LEFT JOIN projectx_test.venue_access va ON va.membership_id=m.id AND va.organization_id=m.organization_id AND va.revoked_at IS NULL
 LEFT JOIN projectx_test.venues v ON v.id=va.venue_id AND v.organization_id=m.organization_id
 WHERE m.user_id=actor AND m.revoked_at IS NULL AND (va.id IS NULL OR v.id IS NOT NULL)
$$;

CREATE FUNCTION projectx_test.staff_session_read(h text, interactive boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, projectx_test, pg_temp AS $$
DECLARE s projectx_test.staff_sessions%ROWTYPE; current_time_at timestamptz := clock_timestamp();
BEGIN
 SELECT * INTO s FROM projectx_test.staff_sessions WHERE token_hash=h FOR UPDATE;
 IF NOT FOUND OR s.revoked_at IS NOT NULL THEN RETURN NULL; END IF;
 IF s.absolute_expires_at <= current_time_at OR s.last_activity_at + interval '30 minutes' <= current_time_at THEN
  UPDATE projectx_test.staff_sessions SET revoked_at=current_time_at WHERE token_hash=h;
  RETURN NULL;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM projectx_test.authenticated_identities ai WHERE ai.id=s.identity_id
 AND ai.user_id=s.user_id AND ai.issuer=s.issuer AND ai.subject=s.subject) THEN
  UPDATE projectx_test.staff_sessions SET revoked_at=current_time_at WHERE token_hash=h;
  RETURN NULL;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM projectx_test.users u WHERE u.id=s.user_id AND u.disabled_at IS NULL) THEN
  UPDATE projectx_test.staff_sessions SET revoked_at=current_time_at WHERE token_hash=h;
  RETURN jsonb_build_object('denial','DISABLED');
 END IF;
 IF s.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projectx_test.organization_memberships m
 WHERE m.user_id=s.user_id AND m.organization_id=s.organization_id AND m.revoked_at IS NULL) THEN
  s.organization_id := NULL; s.venue_id := NULL; s.context_version := s.context_version+1;
 ELSIF s.venue_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projectx_test.organization_memberships m
 JOIN projectx_test.venue_access va ON va.membership_id=m.id AND va.organization_id=m.organization_id AND va.revoked_at IS NULL
 JOIN projectx_test.venues v ON v.id=va.venue_id AND v.organization_id=m.organization_id
 WHERE m.user_id=s.user_id AND m.organization_id=s.organization_id AND m.revoked_at IS NULL AND va.venue_id=s.venue_id) THEN
  s.venue_id := NULL; s.context_version := s.context_version+1;
 END IF;
 UPDATE projectx_test.staff_sessions SET organization_id=s.organization_id,venue_id=s.venue_id,context_version=s.context_version,
 last_activity_at=CASE WHEN interactive THEN current_time_at ELSE last_activity_at END WHERE token_hash=h;
 RETURN jsonb_build_object('userId',s.user_id,'organizationId',s.organization_id,'venueId',s.venue_id,
 'contextVersion',s.context_version,'expiresAt',s.absolute_expires_at,'assurance','UNVERIFIED',
 'contexts',projectx_test.staff_own_contexts(s.user_id));
END $$;

CREATE FUNCTION projectx_test.staff_session_issue(iss text, sub text, h text, predecessor text, authenticated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, projectx_test, pg_temp AS $$
DECLARE binding projectx_test.authenticated_identities%ROWTYPE; choices jsonb; selected_org uuid; selected_venue uuid;
BEGIN
 IF iss IS NULL OR sub IS NULL OR length(iss)>2048 OR length(sub)>1024 OR h IS NULL OR h !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'Invalid session issuance' USING ERRCODE='22023'; END IF;
 SELECT ai.* INTO binding FROM projectx_test.authenticated_identities ai
 JOIN projectx_test.users u ON u.id=ai.user_id AND u.disabled_at IS NULL
 WHERE ai.issuer=iss AND ai.subject=sub FOR SHARE OF ai,u;
 IF NOT FOUND THEN RETURN NULL; END IF;
 choices := projectx_test.staff_own_contexts(binding.user_id);
 IF jsonb_array_length(choices)=1 THEN
  selected_org := (choices->0->>'organizationId')::uuid;
  selected_venue := (choices->0->>'venueId')::uuid;
 END IF;
 INSERT INTO projectx_test.staff_sessions(token_hash,user_id,identity_id,issuer,subject,authenticated_at,organization_id,venue_id)
 VALUES(h,binding.user_id,binding.id,iss,sub,authenticated_at,selected_org,selected_venue);
 -- Rotation invalidates only the browser-held predecessor, never all device sessions.
 UPDATE projectx_test.staff_sessions SET revoked_at=clock_timestamp() WHERE token_hash=predecessor AND token_hash<>h;
 RETURN projectx_test.staff_session_read(h,false);
END $$;

CREATE FUNCTION projectx_test.staff_session_switch(h text, candidate_org uuid, candidate_venue uuid, expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, projectx_test, pg_temp AS $$
DECLARE session_data jsonb;
BEGIN
 session_data := projectx_test.staff_session_read(h,false);
 IF session_data IS NULL OR session_data ? 'denial' THEN RETURN session_data; END IF;
 IF expected_version IS NULL OR expected_version <> (session_data->>'contextVersion')::integer THEN
  RETURN jsonb_build_object('denial','STALE');
 END IF;
 IF candidate_org IS NULL OR NOT EXISTS (SELECT 1 FROM projectx_test.organization_memberships m
 WHERE m.user_id=(session_data->>'userId')::uuid AND m.organization_id=candidate_org AND m.revoked_at IS NULL) THEN
  RETURN jsonb_build_object('denial','CONTEXT');
 END IF;
 IF candidate_venue IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projectx_test.organization_memberships m
 JOIN projectx_test.venue_access va ON va.membership_id=m.id AND va.organization_id=m.organization_id AND va.revoked_at IS NULL
 JOIN projectx_test.venues v ON v.id=va.venue_id AND v.organization_id=candidate_org
 WHERE m.user_id=(session_data->>'userId')::uuid AND m.organization_id=candidate_org AND m.revoked_at IS NULL AND va.venue_id=candidate_venue) THEN
  RETURN jsonb_build_object('denial','CONTEXT');
 END IF;
 UPDATE projectx_test.staff_sessions SET organization_id=candidate_org,venue_id=candidate_venue,
 context_version=context_version+1,last_activity_at=clock_timestamp() WHERE token_hash=h;
 RETURN projectx_test.staff_session_read(h,false);
END $$;
CREATE FUNCTION projectx_test.staff_session_revoke(h text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, projectx_test, pg_temp AS $$
 UPDATE projectx_test.staff_sessions SET revoked_at=clock_timestamp() WHERE token_hash=h AND revoked_at IS NULL
$$;

REVOKE ALL ON FUNCTION projectx_test.staff_own_contexts(uuid), projectx_test.staff_login_start(text,text,text,text),
 projectx_test.staff_login_consume(text), projectx_test.staff_session_read(text,boolean),
 projectx_test.staff_session_issue(text,text,text,text,timestamptz), projectx_test.staff_session_switch(text,uuid,uuid,integer),
 projectx_test.staff_session_revoke(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION projectx_test.staff_login_start(text,text,text,text), projectx_test.staff_login_consume(text),
 projectx_test.staff_session_read(text,boolean), projectx_test.staff_session_issue(text,text,text,text,timestamptz),
 projectx_test.staff_session_switch(text,uuid,uuid,integer), projectx_test.staff_session_revoke(text) TO projectx_staff_auth_runtime;
