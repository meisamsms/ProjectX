-- PROJECTX IMPLEMENTATION DECISION: additive membership/access-owned permissions.
-- Sorts after the verified provisioning migration; no prior checksum changes.
CREATE TABLE organization_permission_grants (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL,
 membership_id uuid NOT NULL,
 permission_id text NOT NULL,
 permission_scope text NOT NULL CHECK (permission_scope IN ('SELF','ORGANIZATION')),
 granted_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 FOREIGN KEY (organization_id,membership_id) REFERENCES organization_memberships(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (permission_id,permission_scope) REFERENCES permissions(id,scope) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX organization_permission_grants_active ON organization_permission_grants(membership_id,permission_id) WHERE revoked_at IS NULL;
CREATE TABLE venue_permission_grants (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL,
 venue_id uuid NOT NULL,
 venue_access_id uuid NOT NULL,
 permission_id text NOT NULL,
 permission_scope text NOT NULL DEFAULT 'VENUE' CHECK (permission_scope='VENUE'),
 granted_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 FOREIGN KEY (organization_id,venue_access_id,venue_id) REFERENCES venue_access(organization_id,id,venue_id) ON DELETE RESTRICT,
 FOREIGN KEY (permission_id,permission_scope) REFERENCES permissions(id,scope) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX venue_permission_grants_active ON venue_permission_grants(venue_access_id,permission_id) WHERE revoked_at IS NULL;
CREATE TRIGGER org_permission_active_parent BEFORE INSERT OR UPDATE OF membership_id,organization_id,revoked_at
 ON organization_permission_grants FOR EACH ROW WHEN (NEW.revoked_at IS NULL) EXECUTE FUNCTION require_active_membership_for_grant();
CREATE TRIGGER venue_permission_active_parent BEFORE INSERT OR UPDATE OF venue_access_id,organization_id,venue_id,revoked_at
 ON venue_permission_grants FOR EACH ROW WHEN (NEW.revoked_at IS NULL) EXECUTE FUNCTION require_active_venue_access_for_grant();

-- Ownership and attribution are immutable; revocation/reactivation is versioned.
CREATE FUNCTION people_direct_grant_lifecycle() RETURNS trigger LANGUAGE plpgsql
 SET search_path = projectx_test, pg_catalog AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['revoked_at','updated_at','version']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['revoked_at','updated_at','version']) THEN
   RAISE EXCEPTION 'immutable direct grant' USING ERRCODE='23514';
 END IF;
 IF NEW.version <> OLD.version + 1 THEN
   RAISE EXCEPTION 'direct grant version required' USING ERRCODE='23514';
 END IF;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION people_direct_grant_lifecycle() FROM PUBLIC;
CREATE TRIGGER org_permission_lifecycle BEFORE UPDATE ON organization_permission_grants
 FOR EACH ROW EXECUTE FUNCTION people_direct_grant_lifecycle();
CREATE TRIGGER venue_permission_lifecycle BEFORE UPDATE ON venue_permission_grants
 FOR EACH ROW EXECUTE FUNCTION people_direct_grant_lifecycle();

CREATE OR REPLACE FUNCTION people_has_capability(actor uuid,tenant uuid,location uuid,capability text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = projectx_test, pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM users u
  JOIN organization_memberships m ON m.user_id=u.id AND m.organization_id=tenant AND m.revoked_at IS NULL
  JOIN permissions p ON p.id=capability
  WHERE u.id=actor AND u.disabled_at IS NULL AND (
   (location IS NULL AND p.scope IN ('SELF','ORGANIZATION') AND (
    EXISTS (SELECT 1 FROM organization_role_grants g
     JOIN roles r ON r.id=g.role_id AND r.organization_id=tenant AND r.scope='ORGANIZATION'
     JOIN role_permissions rp ON rp.role_id=r.id AND rp.permission_id=p.id
     WHERE g.organization_id=tenant AND g.membership_id=m.id AND g.revoked_at IS NULL) OR
    EXISTS (SELECT 1 FROM organization_permission_grants g WHERE g.organization_id=tenant
     AND g.membership_id=m.id AND g.permission_id=p.id AND g.permission_scope=p.scope AND g.revoked_at IS NULL)
   )) OR
   (location IS NOT NULL AND p.scope='VENUE' AND EXISTS (
    SELECT 1 FROM venue_access va WHERE va.organization_id=tenant AND va.venue_id=location
     AND va.membership_id=m.id AND va.revoked_at IS NULL AND (
      EXISTS (SELECT 1 FROM venue_role_grants g
       JOIN roles r ON r.id=g.role_id AND r.organization_id=tenant AND r.scope='VENUE'
       JOIN role_permissions rp ON rp.role_id=r.id AND rp.permission_id=p.id
       WHERE g.venue_access_id=va.id AND g.organization_id=tenant AND g.venue_id=location AND g.revoked_at IS NULL) OR
      EXISTS (SELECT 1 FROM venue_permission_grants g WHERE g.venue_access_id=va.id
       AND g.organization_id=tenant AND g.venue_id=location AND g.permission_id=p.id
       AND g.permission_scope=p.scope AND g.revoked_at IS NULL)
     )
   ))
  )
 )
$$;

ALTER TABLE organization_permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_permission_grants ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON organization_permission_grants,venue_permission_grants TO projectx_people_runtime;
CREATE POLICY org_permission_read ON organization_permission_grants FOR SELECT TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND people_org_read());
CREATE POLICY org_permission_insert ON organization_permission_grants FOR INSERT TO projectx_people_runtime WITH CHECK
 (organization_id=people_context_uuid('app.organization_id') AND people_org_manage() AND
 granted_by_user_id=people_context_uuid('app.user_id') AND
 people_has_capability(people_context_uuid('app.user_id'),organization_id,NULL,permission_id));
CREATE POLICY org_permission_update ON organization_permission_grants FOR UPDATE TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND people_org_manage()) WITH CHECK
 (organization_id=people_context_uuid('app.organization_id') AND people_org_manage() AND
 (revoked_at IS NOT NULL OR people_has_capability(people_context_uuid('app.user_id'),organization_id,NULL,permission_id)));
CREATE POLICY venue_permission_read ON venue_permission_grants FOR SELECT TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND people_venue_read());
CREATE POLICY venue_permission_insert ON venue_permission_grants FOR INSERT TO projectx_people_runtime WITH CHECK
 (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND
 people_venue_manage() AND people_has_capability(people_context_uuid('app.user_id'),organization_id,NULL,'user.manage') AND
 granted_by_user_id=people_context_uuid('app.user_id') AND
 people_has_capability(people_context_uuid('app.user_id'),organization_id,venue_id,permission_id));
CREATE POLICY venue_permission_update ON venue_permission_grants FOR UPDATE TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND
 people_venue_manage() AND people_has_capability(people_context_uuid('app.user_id'),organization_id,NULL,'user.manage')) WITH CHECK
 (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND
 people_venue_manage() AND people_has_capability(people_context_uuid('app.user_id'),organization_id,NULL,'user.manage') AND
 (revoked_at IS NOT NULL OR people_has_capability(people_context_uuid('app.user_id'),organization_id,venue_id,permission_id)));
-- No DELETE, core table writes, broad venue reads or additional runtime privileges.

CREATE FUNCTION create_pending_user_account_with_permissions(
 actor_id uuid,tenant_id uuid,new_provisioning_id uuid,new_user_id uuid,new_membership_id uuid,
 email_value text,normalized_email_value text,first_name_value text,last_name_value text,job_title_value text,
 notifications_value boolean,suspended_value boolean,idempotency_value text,fingerprint_value text,
 organization_grants jsonb,venue_grants jsonb,organization_permissions jsonb
) RETURNS TABLE(provisioning_id uuid,user_id uuid,membership_id uuid,status text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = projectx_test, pg_catalog AS $$
DECLARE
 result record;
 item record;
 venue_request jsonb;
 location uuid;
BEGIN
 IF people_context_uuid('app.user_id') IS DISTINCT FROM actor_id OR
    people_context_uuid('app.organization_id') IS DISTINCT FROM tenant_id OR
    current_setting('app.access_mode',true) IS DISTINCT FROM 'organization' OR
    NOT people_has_capability(actor_id,tenant_id,NULL,'user.manage') THEN
  RAISE EXCEPTION 'people_create_forbidden' USING ERRCODE='42501';
 END IF;
 IF organization_permissions IS NULL OR jsonb_typeof(organization_permissions) <> 'array' OR
    venue_grants IS NULL OR jsonb_typeof(venue_grants) <> 'array' THEN
  RAISE EXCEPTION 'people_create_invalid' USING ERRCODE='22023';
 END IF;
 IF EXISTS (SELECT 1 FROM jsonb_to_recordset(organization_permissions) AS x(grant_id uuid,permission_id text)
   LEFT JOIN permissions p ON p.id=x.permission_id AND p.scope IN ('SELF','ORGANIZATION')
   WHERE p.id IS NULL OR NOT people_has_capability(actor_id,tenant_id,NULL,p.id)) THEN
  RAISE EXCEPTION 'people_create_forbidden' USING ERRCODE='42501';
 END IF;
 IF (SELECT count(*) <> count(DISTINCT x.permission_id) FROM jsonb_to_recordset(organization_permissions) AS x(permission_id text)) THEN
  RAISE EXCEPTION 'people_create_invalid' USING ERRCODE='22023';
 END IF;
 FOR venue_request IN SELECT value FROM jsonb_array_elements(venue_grants) LOOP
  location := (venue_request->>'venue_id')::uuid;
  IF jsonb_typeof(venue_request->'permissions') IS DISTINCT FROM 'array' OR
     NOT people_has_capability(actor_id,tenant_id,location,'venue.manage') OR
     EXISTS (SELECT 1 FROM jsonb_to_recordset(venue_request->'permissions') AS x(grant_id uuid,permission_id text)
      LEFT JOIN permissions p ON p.id=x.permission_id AND p.scope='VENUE'
      WHERE p.id IS NULL OR NOT people_has_capability(actor_id,tenant_id,location,p.id)) THEN
   RAISE EXCEPTION 'people_create_forbidden' USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) <> count(DISTINCT x.permission_id) FROM jsonb_to_recordset(venue_request->'permissions') AS x(permission_id text)) THEN
   RAISE EXCEPTION 'people_create_invalid' USING ERRCODE='22023';
  END IF;
 END LOOP;
 -- Reuse the verified atomic command and its advisory lock/ledger. All direct
 -- writes share its enclosing transaction. A retry must not reinsert grants.
 SELECT * INTO result FROM create_pending_user_account(actor_id,tenant_id,new_provisioning_id,new_user_id,new_membership_id,
  email_value,normalized_email_value,first_name_value,last_name_value,job_title_value,notifications_value,
  suspended_value,idempotency_value,fingerprint_value,organization_grants,venue_grants);
 IF result.provisioning_id=new_provisioning_id THEN
  FOR item IN SELECT x.grant_id,p.id,p.scope FROM jsonb_to_recordset(organization_permissions) AS x(grant_id uuid,permission_id text)
   JOIN permissions p ON p.id=x.permission_id LOOP
   INSERT INTO organization_permission_grants(id,organization_id,membership_id,permission_id,permission_scope,granted_by_user_id)
    VALUES(item.grant_id,tenant_id,new_membership_id,item.id,item.scope,actor_id);
  END LOOP;
  FOR venue_request IN SELECT value FROM jsonb_array_elements(venue_grants) LOOP
   FOR item IN SELECT * FROM jsonb_to_recordset(venue_request->'permissions') AS x(grant_id uuid,permission_id text) LOOP
    INSERT INTO venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id)
     VALUES(item.grant_id,tenant_id,(venue_request->>'venue_id')::uuid,(venue_request->>'access_id')::uuid,item.permission_id,actor_id);
   END LOOP;
  END LOOP;
 END IF;
 RETURN QUERY SELECT result.provisioning_id,result.user_id,result.membership_id,result.status;
END $$;
REVOKE ALL ON FUNCTION create_pending_user_account_with_permissions(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,boolean,text,text,jsonb,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_pending_user_account_with_permissions(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,boolean,text,text,jsonb,jsonb,jsonb) TO projectx_people_runtime;

-- Narrow options projection: definer execution is necessary because normal
-- venue RLS deliberately exposes only one selected venue, never the entire org.
CREATE FUNCTION people_add_user_options() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path = projectx_test, pg_catalog AS $$
DECLARE
 actor uuid := people_context_uuid('app.user_id');
 tenant uuid := people_context_uuid('app.organization_id');
 result jsonb;
BEGIN
 IF people_org_manage() IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'people_options_forbidden' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object(
  'organizationRoles',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) ORDER BY r.id)
   FROM roles r WHERE r.organization_id=tenant AND r.scope='ORGANIZATION' AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id=r.id AND
     NOT people_has_capability(actor,tenant,NULL,rp.permission_id))), '[]'::jsonb),
  'organizationPermissions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'description',p.description,'scope',p.scope) ORDER BY p.id)
   FROM permissions p WHERE p.scope IN ('SELF','ORGANIZATION') AND people_has_capability(actor,tenant,NULL,p.id)), '[]'::jsonb),
  'venues',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',v.id,'name',v.name,
   'roles',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) ORDER BY r.id)
    FROM roles r WHERE r.organization_id=tenant AND r.scope='VENUE' AND NOT EXISTS (
     SELECT 1 FROM role_permissions rp WHERE rp.role_id=r.id AND
      NOT people_has_capability(actor,tenant,v.id,rp.permission_id))), '[]'::jsonb),
   'permissions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'description',p.description,'scope',p.scope) ORDER BY p.id)
    FROM permissions p WHERE p.scope='VENUE' AND people_has_capability(actor,tenant,v.id,p.id)), '[]'::jsonb)
  ) ORDER BY v.id) FROM venues v WHERE v.organization_id=tenant AND people_has_capability(actor,tenant,v.id,'venue.manage')), '[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION people_add_user_options() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION people_add_user_options() TO projectx_people_runtime;
