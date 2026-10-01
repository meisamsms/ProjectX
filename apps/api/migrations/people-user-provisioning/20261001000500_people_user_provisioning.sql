-- ProjectX PEOPLE-04 decision: an organization-scoped pending provisioning
-- record owns an unverified Add User email. AuthenticatedIdentity remains only
-- the verified OIDC issuer/subject binding. This migration sends no email and
-- performs no provider provisioning.
CREATE TABLE user_provisioning_invites (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
 normalized_email text NOT NULL CHECK (
   normalized_email = lower(btrim(email)) AND
   normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 ),
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONSUMED','CANCELLED','EXPIRED')),
 requested_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 requested_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz,
 consumed_at timestamptz,
 idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
 request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 membership_id uuid NOT NULL,
 CONSTRAINT provisioning_membership_owner FOREIGN KEY (organization_id,membership_id)
   REFERENCES organization_memberships(organization_id,id) ON DELETE RESTRICT,
 CONSTRAINT provisioning_consumed_state CHECK ((status='CONSUMED') = (consumed_at IS NOT NULL)),
 CONSTRAINT provisioning_expiry_order CHECK (expires_at IS NULL OR expires_at > requested_at),
 UNIQUE (organization_id,idempotency_key)
);
CREATE UNIQUE INDEX user_provisioning_pending_email
 ON user_provisioning_invites(organization_id,normalized_email)
 WHERE status='PENDING';
CREATE INDEX user_provisioning_user_idx ON user_provisioning_invites(organization_id,user_id);

ALTER TABLE user_provisioning_invites ENABLE ROW LEVEL SECURITY;
-- No direct runtime table privilege is granted. The narrow command below is
-- the only runtime write surface and rechecks current authority.

CREATE FUNCTION create_pending_user_account(
 actor_id uuid,
 tenant_id uuid,
 new_provisioning_id uuid,
 new_user_id uuid,
 new_membership_id uuid,
 email_value text,
 normalized_email_value text,
 first_name_value text,
 last_name_value text,
 job_title_value text,
 notifications_value boolean,
 suspended_value boolean,
 idempotency_value text,
 fingerprint_value text,
 organization_grants jsonb,
 venue_grants jsonb
) RETURNS TABLE(provisioning_id uuid,user_id uuid,membership_id uuid,status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = projectx_test, pg_catalog AS $$
DECLARE
 existing user_provisioning_invites%ROWTYPE;
 organization_grant record;
 venue_request jsonb;
 venue_grant record;
 requested_venue_id uuid;
 requested_access_id uuid;
 total_count integer;
 distinct_count integer;
BEGIN
 IF people_context_uuid('app.user_id') IS DISTINCT FROM actor_id OR
    people_context_uuid('app.organization_id') IS DISTINCT FROM tenant_id OR
    current_setting('app.access_mode',true) IS DISTINCT FROM 'organization' OR
    NOT people_has_capability(actor_id,tenant_id,NULL,'user.manage') THEN
   RAISE EXCEPTION 'people_create_forbidden' USING ERRCODE='42501';
 END IF;
 IF normalized_email_value IS DISTINCT FROM lower(btrim(email_value)) OR
    normalized_email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR
    length(idempotency_value) NOT BETWEEN 8 AND 128 OR
    fingerprint_value !~ '^[0-9a-f]{64}$' OR
    jsonb_typeof(organization_grants) <> 'array' OR
    jsonb_typeof(venue_grants) <> 'array' THEN
   RAISE EXCEPTION 'people_create_invalid' USING ERRCODE='22023';
 END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(tenant_id::text || ':' || idempotency_value,0));
 SELECT p.* INTO existing FROM user_provisioning_invites p
  WHERE p.organization_id=tenant_id AND p.idempotency_key=idempotency_value;
 IF FOUND THEN
   IF existing.request_fingerprint IS DISTINCT FROM fingerprint_value THEN
     RAISE EXCEPTION 'people_create_idempotency_conflict' USING ERRCODE='23505';
   END IF;
   RETURN QUERY SELECT existing.id,existing.user_id,existing.membership_id,existing.status;
   RETURN;
 END IF;
 IF EXISTS (SELECT 1 FROM user_provisioning_invites p
   WHERE p.organization_id=tenant_id AND p.normalized_email=normalized_email_value AND p.status='PENDING') THEN
   RAISE EXCEPTION 'people_create_duplicate_email' USING ERRCODE='23505';
 END IF;

 SELECT count(*),count(DISTINCT x.role_id) INTO total_count,distinct_count
 FROM jsonb_to_recordset(organization_grants) AS x(grant_id uuid,role_id uuid);
 IF total_count < 1 OR total_count <> distinct_count OR EXISTS (
   SELECT 1 FROM jsonb_to_recordset(organization_grants) AS x(grant_id uuid,role_id uuid)
   LEFT JOIN roles r ON r.id=x.role_id AND r.organization_id=tenant_id AND r.scope='ORGANIZATION'
   WHERE r.id IS NULL
 ) OR EXISTS (
   SELECT 1 FROM jsonb_to_recordset(organization_grants) AS x(grant_id uuid,role_id uuid)
   JOIN role_permissions rp ON rp.organization_id=tenant_id AND rp.role_id=x.role_id
   WHERE NOT people_has_capability(actor_id,tenant_id,NULL,rp.permission_id)
 ) THEN
   RAISE EXCEPTION 'people_create_forbidden' USING ERRCODE='42501';
 END IF;

 FOR venue_request IN SELECT value FROM jsonb_array_elements(venue_grants)
 LOOP
   requested_venue_id := (venue_request->>'venue_id')::uuid;
   requested_access_id := (venue_request->>'access_id')::uuid;
   IF jsonb_typeof(venue_request->'grants') <> 'array' OR
      NOT EXISTS (SELECT 1 FROM venues v WHERE v.id=requested_venue_id AND v.organization_id=tenant_id) OR
      NOT people_has_capability(actor_id,tenant_id,requested_venue_id,'venue.manage') THEN
     RAISE EXCEPTION 'people_create_forbidden' USING ERRCODE='42501';
   END IF;
   SELECT count(*),count(DISTINCT x.role_id) INTO total_count,distinct_count
   FROM jsonb_to_recordset(venue_request->'grants') AS x(grant_id uuid,role_id uuid);
   IF total_count < 1 OR total_count <> distinct_count OR EXISTS (
     SELECT 1 FROM jsonb_to_recordset(venue_request->'grants') AS x(grant_id uuid,role_id uuid)
     LEFT JOIN roles r ON r.id=x.role_id AND r.organization_id=tenant_id AND r.scope='VENUE'
     WHERE r.id IS NULL
   ) OR EXISTS (
     SELECT 1 FROM jsonb_to_recordset(venue_request->'grants') AS x(grant_id uuid,role_id uuid)
     JOIN role_permissions rp ON rp.organization_id=tenant_id AND rp.role_id=x.role_id
     WHERE NOT people_has_capability(actor_id,tenant_id,requested_venue_id,rp.permission_id)
   ) THEN
     RAISE EXCEPTION 'people_create_forbidden' USING ERRCODE='42501';
   END IF;
 END LOOP;
 SELECT count(*),count(DISTINCT (value->>'venue_id')) INTO total_count,distinct_count
 FROM jsonb_array_elements(venue_grants);
 IF total_count <> distinct_count THEN
   RAISE EXCEPTION 'people_create_invalid' USING ERRCODE='22023';
 END IF;

 INSERT INTO users(id,disabled_at,first_name,last_name)
 VALUES(new_user_id,CASE WHEN suspended_value THEN now() ELSE NULL END,first_name_value,last_name_value);
 INSERT INTO organization_memberships(id,user_id,organization_id,job_title,email_notifications_enabled)
 VALUES(new_membership_id,new_user_id,tenant_id,job_title_value,notifications_value);
 FOR organization_grant IN
   SELECT * FROM jsonb_to_recordset(organization_grants) AS x(grant_id uuid,role_id uuid)
 LOOP
   INSERT INTO organization_role_grants(id,organization_id,membership_id,role_id)
   VALUES(organization_grant.grant_id,tenant_id,new_membership_id,organization_grant.role_id);
 END LOOP;
 FOR venue_request IN SELECT value FROM jsonb_array_elements(venue_grants)
 LOOP
   requested_venue_id := (venue_request->>'venue_id')::uuid;
   requested_access_id := (venue_request->>'access_id')::uuid;
   INSERT INTO venue_access(id,organization_id,membership_id,venue_id)
   VALUES(requested_access_id,tenant_id,new_membership_id,requested_venue_id);
   FOR venue_grant IN
     SELECT * FROM jsonb_to_recordset(venue_request->'grants') AS x(grant_id uuid,role_id uuid)
   LOOP
     INSERT INTO venue_role_grants(id,organization_id,venue_id,venue_access_id,role_id)
     VALUES(venue_grant.grant_id,tenant_id,requested_venue_id,requested_access_id,venue_grant.role_id);
   END LOOP;
 END LOOP;
 INSERT INTO user_provisioning_invites(
   id,organization_id,email,normalized_email,status,requested_by_user_id,
   idempotency_key,request_fingerprint,user_id,membership_id
 ) VALUES(
   new_provisioning_id,tenant_id,email_value,normalized_email_value,'PENDING',actor_id,
   idempotency_value,fingerprint_value,new_user_id,new_membership_id
 );
 RETURN QUERY SELECT new_provisioning_id,new_user_id,new_membership_id,'PENDING'::text;
END $$;
REVOKE ALL ON FUNCTION create_pending_user_account(
 uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,boolean,text,text,jsonb,jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_pending_user_account(
 uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,boolean,text,text,jsonb,jsonb
) TO projectx_people_runtime;
