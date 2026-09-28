CREATE TABLE permissions (
 id text PRIMARY KEY CHECK (length(trim(id)) > 0),
 scope text NOT NULL CHECK (scope IN ('SELF','ORGANIZATION','VENUE')),
 risk text NOT NULL CHECK (risk IN ('NORMAL','SENSITIVE','HIGH_RISK')),
 description text NOT NULL,
 UNIQUE (id, scope)
);
CREATE TABLE roles (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 scope text NOT NULL CHECK (scope IN ('ORGANIZATION','VENUE')),
 name text NOT NULL CHECK (length(trim(name)) > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 UNIQUE (organization_id,id,scope)
);
CREATE TABLE role_permissions (
 organization_id uuid NOT NULL,
 role_id uuid NOT NULL,
 role_scope text NOT NULL,
 permission_id text NOT NULL,
 permission_scope text NOT NULL,
 PRIMARY KEY (role_id, permission_id),
 CONSTRAINT role_permissions_role FOREIGN KEY (organization_id,role_id,role_scope)
   REFERENCES roles(organization_id,id,scope) ON DELETE RESTRICT,
 CONSTRAINT role_permissions_permission FOREIGN KEY (permission_id,permission_scope)
   REFERENCES permissions(id,scope) ON DELETE RESTRICT,
 CONSTRAINT role_permissions_compatible CHECK (
   (role_scope = 'ORGANIZATION' AND permission_scope IN ('ORGANIZATION','SELF')) OR
   (role_scope = 'VENUE' AND permission_scope = 'VENUE')
 )
);
-- The new composite key preserves the Venue's parent Organization in venue grants.
ALTER TABLE venue_access ADD CONSTRAINT venue_access_organization_id_id_venue_id_key UNIQUE (organization_id,id,venue_id);
CREATE TABLE organization_role_grants (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL,
 membership_id uuid NOT NULL,
 role_id uuid NOT NULL,
 role_scope text NOT NULL DEFAULT 'ORGANIZATION' CHECK (role_scope = 'ORGANIZATION'),
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 CONSTRAINT org_grant_membership FOREIGN KEY (organization_id,membership_id)
   REFERENCES organization_memberships(organization_id,id) ON DELETE RESTRICT,
 CONSTRAINT org_grant_role FOREIGN KEY (organization_id,role_id,role_scope)
   REFERENCES roles(organization_id,id,scope) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX organization_role_grants_active ON organization_role_grants (membership_id,role_id) WHERE revoked_at IS NULL;
CREATE TABLE venue_role_grants (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL,
 venue_id uuid NOT NULL,
 venue_access_id uuid NOT NULL,
 role_id uuid NOT NULL,
 role_scope text NOT NULL DEFAULT 'VENUE' CHECK (role_scope = 'VENUE'),
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 CONSTRAINT venue_grant_access FOREIGN KEY (organization_id,venue_access_id,venue_id)
   REFERENCES venue_access(organization_id,id,venue_id) ON DELETE RESTRICT,
 CONSTRAINT venue_grant_role FOREIGN KEY (organization_id,role_id,role_scope)
   REFERENCES roles(organization_id,id,scope) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX venue_role_grants_active ON venue_role_grants (venue_access_id,role_id) WHERE revoked_at IS NULL;
-- FK alone cannot express parent lifecycle. Lock the parent so insertion and
-- concurrent revocation serialize; previously created grants stay historical.
CREATE FUNCTION require_active_membership_for_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM organization_memberships
   WHERE id = NEW.membership_id AND organization_id = NEW.organization_id
   AND revoked_at IS NULL FOR UPDATE) THEN
   RAISE EXCEPTION 'active membership required' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER organization_grant_active_parent BEFORE INSERT OR UPDATE OF membership_id,organization_id,revoked_at
ON organization_role_grants FOR EACH ROW
WHEN (NEW.revoked_at IS NULL) EXECUTE FUNCTION require_active_membership_for_grant();
CREATE FUNCTION require_active_venue_access_for_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM venue_access
   WHERE id = NEW.venue_access_id AND organization_id = NEW.organization_id
   AND venue_id = NEW.venue_id AND revoked_at IS NULL FOR UPDATE) THEN
   RAISE EXCEPTION 'active venue access required' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER venue_grant_active_parent BEFORE INSERT OR UPDATE OF venue_access_id,organization_id,venue_id,revoked_at
ON venue_role_grants FOR EACH ROW
WHEN (NEW.revoked_at IS NULL) EXECUTE FUNCTION require_active_venue_access_for_grant();
INSERT INTO permissions(id,scope,risk,description) VALUES
 ('session.read.self','SELF','NORMAL','Read own session and selected context'),
 ('user.read.self','SELF','NORMAL','Read own account summary'),
 ('user.read','ORGANIZATION','SENSITIVE','Read authorized user roster'),
 ('user.manage','ORGANIZATION','HIGH_RISK','Manage membership, venue access and user status within granted scope'),
 ('organization.manage','ORGANIZATION','HIGH_RISK','Manage organization security and organization settings'),
 ('venue.read','VENUE','NORMAL','Read authorized venue context'),
 ('venue.manage','VENUE','HIGH_RISK','Manage explicitly authorized venue settings'),
 ('reservation.read','VENUE','SENSITIVE','Read reservations for granted venue'),
 ('reservation.create','VENUE','SENSITIVE','Create reservation for granted venue'),
 ('reservation.update','VENUE','SENSITIVE','Update authorized venue reservation'),
 ('reservation.cancel','VENUE','HIGH_RISK','Cancel authorized venue reservation'),
 ('client.read','VENUE','SENSITIVE','Read minimum client identity and own-venue service details'),
 ('client.create','VENUE','SENSITIVE','Create organization-scoped client within authorized venue workflow'),
 ('client.update','VENUE','SENSITIVE','Change authorized venue client details subject to field policy'),
 ('client.history.read.organization','ORGANIZATION','HIGH_RISK','Read authorized cross-venue client history'),
 ('floorplan.read','VENUE','NORMAL','Read venue rooms and layouts'),
 ('floorplan.manage','VENUE','SENSITIVE','Manage venue layout and table configuration'),
 ('availability.read','VENUE','NORMAL','Read shifts and availability for venue'),
 ('availability.manage','VENUE','SENSITIVE','Manage venue shifts and access rules'),
 ('import.manage','VENUE','HIGH_RISK','Stage and commit scoped imports'),
 ('client.export','ORGANIZATION','HIGH_RISK','Export permitted client fields from authorized scope'),
 ('audit.read','ORGANIZATION','HIGH_RISK','Read privileged organization audit trail');
