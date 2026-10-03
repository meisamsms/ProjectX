-- PROJECTX IMPLEMENTATION DECISION: independent venue display data, not identity.
CREATE TABLE booked_by_names (
  id uuid PRIMARY KEY CHECK (substring(id::text,15,1)='7'),
  organization_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  display_name text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id,venue_id,id),
  FOREIGN KEY (organization_id,venue_id) REFERENCES venues(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX booked_by_names_venue_id_idx ON booked_by_names(organization_id,venue_id,id);

-- Successful-operation metadata only; no name payload or identity ownership FK.
CREATE TABLE booked_by_name_changes (
  organization_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  booked_by_name_id uuid NOT NULL,
  version integer NOT NULL,
  action text NOT NULL CHECK (action IN ('CREATED','UPDATED')),
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (booked_by_name_id,version),
  FOREIGN KEY (organization_id,venue_id,booked_by_name_id)
    REFERENCES booked_by_names(organization_id,venue_id,id) ON DELETE RESTRICT
);

CREATE FUNCTION people_booked_by_validate() RETURNS trigger LANGUAGE plpgsql
SET search_path = projectx_test, pg_catalog, pg_temp AS $$
BEGIN
  IF NEW.display_name ~ U&'[\0001-\001F\007F-\009F]' THEN
    RAISE EXCEPTION 'Invalid display name' USING ERRCODE='23514';
  END IF;
  -- ECMAScript trim whitespace, after rejecting controls (including tabs/newlines).
  NEW.display_name := btrim(NEW.display_name,U&'\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  IF char_length(NEW.display_name) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Invalid display name' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.version <> 1 THEN
      RAISE EXCEPTION 'Invalid initial version' USING ERRCODE='23514';
    END IF;
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
  ELSE
    IF (NEW.id,NEW.organization_id,NEW.venue_id,NEW.created_at) IS DISTINCT FROM
       (OLD.id,OLD.organization_id,OLD.venue_id,OLD.created_at) OR NEW.version <> OLD.version+1 THEN
      RAISE EXCEPTION 'Invalid update' USING ERRCODE='23514';
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION people_booked_by_record_change() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = projectx_test, pg_catalog, pg_temp AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM projectx_test.people_context_uuid('app.organization_id')
     OR NEW.venue_id IS DISTINCT FROM projectx_test.people_context_uuid('app.venue_id')
     OR NOT COALESCE(projectx_test.people_venue_manage(),false) THEN
    RAISE EXCEPTION 'People access denied' USING ERRCODE='42501';
  END IF;
  INSERT INTO projectx_test.booked_by_name_changes(organization_id,venue_id,booked_by_name_id,version,action,actor_user_id,request_id)
  VALUES(NEW.organization_id,NEW.venue_id,NEW.id,NEW.version,
    CASE WHEN TG_OP='INSERT' THEN 'CREATED' ELSE 'UPDATED' END,projectx_test.people_context_uuid('app.user_id'),projectx_test.people_context_uuid('app.request_id'));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION people_booked_by_validate() FROM PUBLIC;
REVOKE ALL ON FUNCTION people_booked_by_record_change() FROM PUBLIC;
CREATE TRIGGER booked_by_validate BEFORE INSERT OR UPDATE ON booked_by_names
  FOR EACH ROW EXECUTE FUNCTION people_booked_by_validate();
CREATE TRIGGER booked_by_record_change AFTER INSERT OR UPDATE ON booked_by_names
  FOR EACH ROW EXECUTE FUNCTION people_booked_by_record_change();

CREATE FUNCTION people_booked_by_change_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Immutable change metadata' USING ERRCODE='23514';
END $$;
REVOKE ALL ON FUNCTION people_booked_by_change_immutable() FROM PUBLIC;
CREATE TRIGGER booked_by_change_immutable BEFORE UPDATE OR DELETE ON booked_by_name_changes
  FOR EACH ROW EXECUTE FUNCTION people_booked_by_change_immutable();

ALTER TABLE booked_by_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE booked_by_name_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY booked_by_select ON booked_by_names FOR SELECT TO projectx_people_runtime
  USING (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND people_venue_manage());
CREATE POLICY booked_by_insert ON booked_by_names FOR INSERT TO projectx_people_runtime
  WITH CHECK (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND people_venue_manage());
CREATE POLICY booked_by_update ON booked_by_names FOR UPDATE TO projectx_people_runtime
  USING (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND people_venue_manage())
  WITH CHECK (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND people_venue_manage());
REVOKE ALL ON booked_by_names,booked_by_name_changes FROM PUBLIC,projectx_people_runtime;
GRANT SELECT,INSERT ON booked_by_names TO projectx_people_runtime;
GRANT UPDATE (display_name,version) ON booked_by_names TO projectx_people_runtime;
