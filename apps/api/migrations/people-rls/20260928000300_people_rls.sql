-- The migration principal owns schema and tables; the NOLOGIN runtime role owns none.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='projectx_people_runtime') THEN
   CREATE ROLE projectx_people_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA projectx_test TO projectx_people_runtime;
GRANT SELECT ON organizations, venues, users, authenticated_identities,
 organization_memberships, venue_access, roles, role_permissions,
 organization_role_grants, venue_role_grants, permissions TO projectx_people_runtime;
GRANT INSERT, UPDATE ON roles, role_permissions, organization_role_grants,
 venue_role_grants TO projectx_people_runtime;

-- PEOPLE-01B grant triggers lock their active parent rows FOR UPDATE. Run the
-- two narrowly checked trigger bodies as the migration owner so a restricted
-- grant writer does not need UPDATE rights on Membership or VenueAccess.
ALTER FUNCTION require_active_membership_for_grant() SECURITY DEFINER;
ALTER FUNCTION require_active_membership_for_grant() SET search_path = projectx_test, pg_catalog;
ALTER FUNCTION require_active_venue_access_for_grant() SECURITY DEFINER;
ALTER FUNCTION require_active_venue_access_for_grant() SET search_path = projectx_test, pg_catalog;
REVOKE ALL ON FUNCTION require_active_membership_for_grant(), require_active_venue_access_for_grant() FROM PUBLIC;

-- A malformed/missing setting is NULL, never a wildcard or an exception oracle.
CREATE FUNCTION people_context_uuid(setting_name text) RETURNS uuid
LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
 SELECT CASE WHEN current_setting(setting_name,true) ~*
 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN current_setting(setting_name,true)::uuid ELSE NULL END
$$;
REVOKE ALL ON FUNCTION people_context_uuid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION people_context_uuid(text) TO projectx_people_runtime;

-- Narrow boolean-only lookup. The migration owner, never the request runtime,
-- owns this SECURITY DEFINER. Its fixed search path prevents object shadowing.
CREATE FUNCTION people_has_capability(actor uuid, tenant uuid, location uuid, capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = projectx_test, pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM users u
  JOIN organization_memberships m ON m.user_id=u.id AND m.organization_id=tenant AND m.revoked_at IS NULL
  JOIN permissions p ON p.id=capability
  WHERE u.id=actor AND u.disabled_at IS NULL
   AND (
    (location IS NULL AND p.scope IN ('SELF','ORGANIZATION') AND EXISTS (
      SELECT 1 FROM organization_role_grants g
      JOIN roles r ON r.id=g.role_id AND r.organization_id=tenant AND r.scope='ORGANIZATION'
      JOIN role_permissions rp ON rp.role_id=r.id AND rp.permission_id=p.id
      WHERE g.organization_id=tenant AND g.membership_id=m.id AND g.revoked_at IS NULL
    )) OR
    (location IS NOT NULL AND p.scope='VENUE' AND EXISTS (
      SELECT 1 FROM venue_access va
      JOIN venue_role_grants g ON g.venue_access_id=va.id AND g.organization_id=tenant AND g.venue_id=location AND g.revoked_at IS NULL
      JOIN roles r ON r.id=g.role_id AND r.organization_id=tenant AND r.scope='VENUE'
      JOIN role_permissions rp ON rp.role_id=r.id AND rp.permission_id=p.id
      WHERE va.organization_id=tenant AND va.venue_id=location AND va.membership_id=m.id AND va.revoked_at IS NULL
    ))
   )
 )
$$;
REVOKE ALL ON FUNCTION people_has_capability(uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION people_has_capability(uuid,uuid,uuid,text) TO projectx_people_runtime;

-- The setting is only a secondary guard. A compromised SQL execution path can
-- change custom GUCs; server authorization, parameterization and narrow grants
-- remain necessary. Missing or forged context cannot pass without a current grant.
CREATE FUNCTION people_org_read() RETURNS boolean LANGUAGE sql STABLE
SET search_path = projectx_test, pg_catalog AS $$
 SELECT current_setting('app.access_mode',true)='organization' AND
  (people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),NULL,'user.read') OR
   people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),NULL,'user.manage'))
$$;
CREATE FUNCTION people_org_manage() RETURNS boolean LANGUAGE sql STABLE
SET search_path = projectx_test, pg_catalog AS $$
 SELECT current_setting('app.access_mode',true)='organization' AND
 people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),NULL,'user.manage')
$$;
CREATE FUNCTION people_venue_read() RETURNS boolean LANGUAGE sql STABLE
SET search_path = projectx_test, pg_catalog AS $$
 SELECT current_setting('app.access_mode',true)='venue' AND
 (people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),people_context_uuid('app.venue_id'),'venue.read') OR
  people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),people_context_uuid('app.venue_id'),'venue.manage'))
$$;
CREATE FUNCTION people_venue_manage() RETURNS boolean LANGUAGE sql STABLE
SET search_path = projectx_test, pg_catalog AS $$
 SELECT current_setting('app.access_mode',true)='venue' AND
 people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),people_context_uuid('app.venue_id'),'venue.manage')
$$;
CREATE FUNCTION people_self_read() RETURNS boolean LANGUAGE sql STABLE
SET search_path = projectx_test, pg_catalog AS $$
 SELECT current_setting('app.access_mode',true)='self' AND
 people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),NULL,'user.read.self')
$$;
REVOKE ALL ON FUNCTION people_org_read(), people_org_manage(), people_venue_read(), people_venue_manage(), people_self_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION people_org_read(), people_org_manage(), people_venue_read(), people_venue_manage(), people_self_read() TO projectx_people_runtime;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE authenticated_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_role_grants ENABLE ROW LEVEL SECURITY;
-- permissions: immutable global capability metadata, SELECT only to runtime.

CREATE POLICY organizations_read ON organizations FOR SELECT TO projectx_people_runtime USING
 (id=people_context_uuid('app.organization_id') AND people_org_read());
CREATE POLICY venues_read ON venues FOR SELECT TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND id=people_context_uuid('app.venue_id') AND people_venue_read());
CREATE POLICY users_read ON users FOR SELECT TO projectx_people_runtime USING
 ((id=people_context_uuid('app.user_id') AND people_self_read()) OR
  (people_org_read() AND EXISTS (SELECT 1 FROM organization_memberships m
    WHERE m.user_id=users.id AND m.organization_id=people_context_uuid('app.organization_id'))));
CREATE POLICY identities_read ON authenticated_identities FOR SELECT TO projectx_people_runtime USING
 (user_id=people_context_uuid('app.user_id') AND people_self_read());
CREATE POLICY memberships_read ON organization_memberships FOR SELECT TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND
 ((user_id=people_context_uuid('app.user_id') AND people_self_read()) OR people_org_read()));
CREATE POLICY access_read ON venue_access FOR SELECT TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND people_venue_read());
CREATE POLICY roles_read ON roles FOR SELECT TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND
 ((scope='ORGANIZATION' AND people_org_read()) OR (scope='VENUE' AND people_venue_read())));
CREATE POLICY role_permissions_read ON role_permissions FOR SELECT TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND
 ((role_scope='ORGANIZATION' AND people_org_read()) OR (role_scope='VENUE' AND people_venue_read())));
CREATE POLICY org_grants_read ON organization_role_grants FOR SELECT TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND people_org_read());
CREATE POLICY venue_grants_read ON venue_role_grants FOR SELECT TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND people_venue_read());

CREATE POLICY roles_insert ON roles FOR INSERT TO projectx_people_runtime WITH CHECK
 (organization_id=people_context_uuid('app.organization_id') AND
 ((scope='ORGANIZATION' AND people_org_manage()) OR (scope='VENUE' AND people_venue_manage())));
CREATE POLICY roles_update ON roles FOR UPDATE TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND
 ((scope='ORGANIZATION' AND people_org_manage()) OR (scope='VENUE' AND people_venue_manage())))
 WITH CHECK (organization_id=people_context_uuid('app.organization_id') AND
 ((scope='ORGANIZATION' AND people_org_manage()) OR (scope='VENUE' AND people_venue_manage())));
CREATE POLICY rp_insert ON role_permissions FOR INSERT TO projectx_people_runtime WITH CHECK
 (organization_id=people_context_uuid('app.organization_id') AND
 ((role_scope='ORGANIZATION' AND people_org_manage()) OR (role_scope='VENUE' AND people_venue_manage())));
CREATE POLICY rp_update ON role_permissions FOR UPDATE TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND
 ((role_scope='ORGANIZATION' AND people_org_manage()) OR (role_scope='VENUE' AND people_venue_manage())))
 WITH CHECK (organization_id=people_context_uuid('app.organization_id') AND
 ((role_scope='ORGANIZATION' AND people_org_manage()) OR (role_scope='VENUE' AND people_venue_manage())));
CREATE POLICY org_grants_insert ON organization_role_grants FOR INSERT TO projectx_people_runtime WITH CHECK
 (organization_id=people_context_uuid('app.organization_id') AND people_org_manage());
CREATE POLICY org_grants_update ON organization_role_grants FOR UPDATE TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND people_org_manage())
 WITH CHECK (organization_id=people_context_uuid('app.organization_id') AND people_org_manage());
CREATE POLICY venue_grants_insert ON venue_role_grants FOR INSERT TO projectx_people_runtime WITH CHECK
 (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND
 people_venue_manage() AND people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),NULL,'user.manage'));
CREATE POLICY venue_grants_update ON venue_role_grants FOR UPDATE TO projectx_people_runtime USING
 (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND people_venue_manage() AND people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),NULL,'user.manage'))
 WITH CHECK (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND people_venue_manage() AND people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),NULL,'user.manage'));
-- Physical DELETE remains denied by absence of policy and SQL privilege.
