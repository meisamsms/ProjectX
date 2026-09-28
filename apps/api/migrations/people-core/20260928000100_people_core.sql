CREATE TABLE organizations (
 id uuid PRIMARY KEY, name text NOT NULL CHECK (length(trim(name)) > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE TABLE venues (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK (length(trim(name)) > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 UNIQUE (organization_id, id)
);
CREATE TABLE users (
 id uuid PRIMARY KEY, disabled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE TABLE authenticated_identities (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 issuer text NOT NULL CHECK (length(trim(issuer)) > 0),
 subject text NOT NULL CHECK (length(trim(subject)) > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (issuer, subject)
);
CREATE TABLE organization_memberships (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 UNIQUE (organization_id, id)
);
CREATE UNIQUE INDEX organization_memberships_active_user_org ON organization_memberships (user_id, organization_id) WHERE revoked_at IS NULL;
CREATE TABLE venue_access (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL,
 membership_id uuid NOT NULL,
 venue_id uuid NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 CONSTRAINT venue_access_membership_owner FOREIGN KEY (organization_id, membership_id)
   REFERENCES organization_memberships (organization_id, id) ON DELETE RESTRICT,
 CONSTRAINT venue_access_venue_owner FOREIGN KEY (organization_id, venue_id)
   REFERENCES venues (organization_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX venue_access_active_membership_venue ON venue_access (membership_id, venue_id) WHERE revoked_at IS NULL;
CREATE INDEX venues_organization_idx ON venues (organization_id);
CREATE INDEX organization_memberships_organization_idx ON organization_memberships (organization_id);
CREATE INDEX venue_access_venue_idx ON venue_access (organization_id, venue_id);
