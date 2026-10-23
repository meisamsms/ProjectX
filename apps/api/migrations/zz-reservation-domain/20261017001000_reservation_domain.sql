-- RESERVATION-DOMAIN-001: internal domain only; no public or staff HTTP wiring.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

CREATE TABLE reservation_venue_settings (
 organization_id uuid NOT NULL, venue_id uuid NOT NULL, timezone text NOT NULL,
 PRIMARY KEY (organization_id,venue_id),
 FOREIGN KEY (organization_id,venue_id) REFERENCES venues(organization_id,id) ON DELETE RESTRICT
);
CREATE FUNCTION reservation_zone_validate() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone)
    OR (NEW.timezone <> 'UTC' AND position('/' IN NEW.timezone)=0) THEN
   RAISE EXCEPTION 'Invalid venue timezone' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION reservation_zone_validate() FROM PUBLIC;
CREATE TRIGGER reservation_zone_validate BEFORE INSERT OR UPDATE ON reservation_venue_settings
 FOR EACH ROW EXECUTE FUNCTION reservation_zone_validate();

CREATE TABLE reservation_tables (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, venue_id uuid NOT NULL,
 label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
 capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 50), active boolean NOT NULL DEFAULT true,
 UNIQUE (organization_id,venue_id,id),
 FOREIGN KEY (organization_id,venue_id) REFERENCES reservation_venue_settings(organization_id,venue_id) ON DELETE RESTRICT
);
CREATE TABLE reservation_shifts (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, venue_id uuid NOT NULL,
 local_date date NOT NULL CHECK (isfinite(local_date)),
 open_minute integer NOT NULL CHECK (open_minute BETWEEN 0 AND 1439),
 close_minute integer NOT NULL CHECK (close_minute BETWEEN 1 AND 1440 AND close_minute>open_minute),
 duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
 step_minutes integer NOT NULL CHECK (step_minutes BETWEEN 5 AND 120),
 min_party integer NOT NULL CHECK (min_party BETWEEN 1 AND 50),
 max_party integer NOT NULL CHECK (max_party BETWEEN min_party AND 50),
 UNIQUE (organization_id,venue_id,id),
 FOREIGN KEY (organization_id,venue_id) REFERENCES reservation_venue_settings(organization_id,venue_id) ON DELETE RESTRICT
);
CREATE INDEX reservation_shifts_day ON reservation_shifts(organization_id,venue_id,local_date);
-- Organization-owned identity shell. PII is a reservation-owned Venue snapshot;
-- no speculative deduplication, directory, login or cross-Venue client access.
CREATE TABLE reservation_clients (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(organization_id,id)
);
CREATE TABLE reservations (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, venue_id uuid NOT NULL,
 client_id uuid NOT NULL, table_id uuid NOT NULL, shift_id uuid NOT NULL,
 guest_name text NOT NULL CHECK (char_length(btrim(guest_name)) BETWEEN 1 AND 120 AND guest_name !~ '[[:cntrl:]]'),
 guest_email text NOT NULL CHECK (char_length(guest_email) BETWEEN 3 AND 254 AND guest_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' AND guest_email !~ '[[:cntrl:]]'),
 party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 50),
 starts_at timestamptz NOT NULL CHECK (isfinite(starts_at)),
 ends_at timestamptz NOT NULL CHECK (isfinite(ends_at) AND ends_at>starts_at),
 local_date date NOT NULL, timezone text NOT NULL,
 status text NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED','CANCELLED')),
 created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 idempotency_key uuid NOT NULL,
 request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(organization_id,venue_id,id),
 UNIQUE(organization_id,venue_id,created_by_user_id,idempotency_key),
 FOREIGN KEY (organization_id,client_id) REFERENCES reservation_clients(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,venue_id,table_id) REFERENCES reservation_tables(organization_id,venue_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,venue_id,shift_id) REFERENCES reservation_shifts(organization_id,venue_id,id) ON DELETE RESTRICT,
 CONSTRAINT reservation_no_overlap EXCLUDE USING gist
   (table_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (status='BOOKED')
);
CREATE INDEX reservations_day ON reservations(organization_id,venue_id,local_date,starts_at,id);
CREATE TABLE reservation_changes (
 reservation_id uuid NOT NULL, organization_id uuid NOT NULL, venue_id uuid NOT NULL,
 action text NOT NULL CHECK (action IN ('CREATED','CANCELLED')),
 actor_user_id uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(reservation_id,action),
 FOREIGN KEY (organization_id,venue_id,reservation_id) REFERENCES reservations(organization_id,venue_id,id) ON DELETE RESTRICT
);

CREATE FUNCTION reservation_allowed(capability text) RETURNS boolean LANGUAGE sql STABLE
SET search_path=projectx_test,pg_catalog AS $$
 SELECT current_setting('app.access_mode',true)='venue'
 AND people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),people_context_uuid('app.venue_id'),'reservation.read')
 AND people_has_capability(people_context_uuid('app.user_id'),people_context_uuid('app.organization_id'),people_context_uuid('app.venue_id'),capability)
$$;
REVOKE ALL ON FUNCTION reservation_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reservation_allowed(text) TO projectx_people_runtime;

-- One shared slot definition for search and write validation. Invoker RLS applies.
CREATE FUNCTION reservation_slots(day date, party integer)
RETURNS TABLE(table_id uuid,shift_id uuid,starts_at timestamptz,ends_at timestamptz,timezone text)
LANGUAGE sql STABLE SET search_path=projectx_test,pg_catalog AS $$
 SELECT t.id,s.id,g.start_at,g.start_at+make_interval(mins=>s.duration_minutes),v.timezone
 FROM reservation_shifts s
 JOIN reservation_venue_settings v USING(organization_id,venue_id)
 JOIN reservation_tables t USING(organization_id,venue_id)
 CROSS JOIN LATERAL (SELECT
   (s.local_date+make_interval(mins=>s.open_minute)) AT TIME ZONE v.timezone AS opens,
   (s.local_date+make_interval(mins=>s.close_minute)) AT TIME ZONE v.timezone AS closes) b
 CROSS JOIN LATERAL generate_series(b.opens,b.closes-make_interval(mins=>s.duration_minutes),make_interval(mins=>s.step_minutes)) g(start_at)
 WHERE s.local_date=day AND party BETWEEN s.min_party AND s.max_party
 AND t.active AND t.capacity>=party AND g.start_at>statement_timestamp()
 AND b.opens AT TIME ZONE v.timezone=s.local_date+make_interval(mins=>s.open_minute)
 AND b.closes AT TIME ZONE v.timezone=s.local_date+make_interval(mins=>s.close_minute)
$$;
REVOKE ALL ON FUNCTION reservation_slots(date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reservation_slots(date,integer) TO projectx_people_runtime;

CREATE FUNCTION reservation_validate() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=projectx_test,pg_catalog,pg_temp AS $$
DECLARE slot record;
BEGIN
 IF NEW.organization_id IS DISTINCT FROM people_context_uuid('app.organization_id')
 OR NEW.venue_id IS DISTINCT FROM people_context_uuid('app.venue_id')
 OR NOT COALESCE(reservation_allowed(CASE WHEN TG_OP='INSERT' THEN 'reservation.create' ELSE 'reservation.cancel' END),false) THEN
   RAISE EXCEPTION 'Reservation access denied' USING ERRCODE='42501';
 END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'BOOKED' OR NEW.created_by_user_id IS DISTINCT FROM people_context_uuid('app.user_id') THEN
     RAISE EXCEPTION 'Invalid reservation' USING ERRCODE='23514';
   END IF;
   -- Shared locks prevent concurrent configuration edits; exclusion serializes allocations.
   PERFORM t.id FROM reservation_tables t JOIN reservation_shifts s USING(organization_id,venue_id)
     JOIN reservation_venue_settings v USING(organization_id,venue_id)
     WHERE t.id=NEW.table_id AND s.id=NEW.shift_id AND t.organization_id=NEW.organization_id AND t.venue_id=NEW.venue_id
     FOR SHARE OF t,s,v;
   SELECT x.* INTO slot FROM reservation_slots(NEW.local_date,NEW.party_size) x
     JOIN reservation_tables t ON t.id=x.table_id
     WHERE t.organization_id=NEW.organization_id AND t.venue_id=NEW.venue_id
       AND x.table_id=NEW.table_id AND x.shift_id=NEW.shift_id AND x.starts_at=NEW.starts_at;
   IF NOT FOUND OR NEW.ends_at<>slot.ends_at OR NEW.timezone<>slot.timezone THEN
     RAISE EXCEPTION 'Slot not bookable' USING ERRCODE='23514';
   END IF;
   NEW.created_at:=clock_timestamp();
 ELSE
   IF OLD.status<>'BOOKED' OR NEW.status<>'CANCELLED'
      OR (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'updated_at') THEN
     RAISE EXCEPTION 'Invalid reservation transition' USING ERRCODE='23514';
   END IF;
 END IF;
 NEW.updated_at:=clock_timestamp();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION reservation_validate() FROM PUBLIC;
CREATE TRIGGER reservation_validate BEFORE INSERT OR UPDATE ON reservations
 FOR EACH ROW EXECUTE FUNCTION reservation_validate();

CREATE FUNCTION reservation_record_change() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=projectx_test,pg_catalog,pg_temp AS $$
BEGIN
 INSERT INTO reservation_changes(reservation_id,organization_id,venue_id,action,actor_user_id)
 VALUES(NEW.id,NEW.organization_id,NEW.venue_id,CASE WHEN TG_OP='INSERT' THEN 'CREATED' ELSE 'CANCELLED' END,people_context_uuid('app.user_id'));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION reservation_record_change() FROM PUBLIC;
CREATE TRIGGER reservation_record_change AFTER INSERT OR UPDATE ON reservations
 FOR EACH ROW EXECUTE FUNCTION reservation_record_change();
CREATE FUNCTION reservation_change_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
BEGIN
 RAISE EXCEPTION 'Reservation history is immutable' USING ERRCODE='23514';
END $$;
REVOKE ALL ON FUNCTION reservation_change_immutable() FROM PUBLIC;
CREATE TRIGGER reservation_change_immutable BEFORE UPDATE OR DELETE ON reservation_changes
 FOR EACH ROW EXECUTE FUNCTION reservation_change_immutable();

DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['reservation_venue_settings','reservation_tables','reservation_shifts','reservations','reservation_changes'] LOOP
   EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
   EXECUTE format('CREATE POLICY scoped_read ON %I FOR SELECT TO projectx_people_runtime USING (organization_id=people_context_uuid(''app.organization_id'') AND venue_id=people_context_uuid(''app.venue_id'') AND reservation_allowed(''reservation.read''))',tbl);
   EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,projectx_people_runtime',tbl);
 END LOOP;
END $$;
GRANT SELECT ON reservation_venue_settings,reservation_tables,reservation_shifts,reservations TO projectx_people_runtime;
ALTER TABLE reservation_clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reservation_clients FROM PUBLIC,projectx_people_runtime;
CREATE POLICY client_insert ON reservation_clients FOR INSERT TO projectx_people_runtime
 WITH CHECK (organization_id=people_context_uuid('app.organization_id') AND reservation_allowed('reservation.create'));
CREATE POLICY reservation_insert ON reservations FOR INSERT TO projectx_people_runtime
 WITH CHECK (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND reservation_allowed('reservation.create'));
CREATE POLICY reservation_cancel ON reservations FOR UPDATE TO projectx_people_runtime
 USING (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND reservation_allowed('reservation.cancel'))
 WITH CHECK (organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND reservation_allowed('reservation.cancel'));
GRANT INSERT ON reservation_clients,reservations TO projectx_people_runtime;
GRANT UPDATE(status) ON reservations TO projectx_people_runtime;
