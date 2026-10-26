-- DOMAIN-002: additive internal modification; cancellation grants stay narrow.
ALTER TABLE reservations ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);

CREATE TABLE reservation_modifications (
 organization_id uuid NOT NULL, venue_id uuid NOT NULL, actor_user_id uuid NOT NULL REFERENCES users(id),
 idempotency_key uuid NOT NULL, reservation_id uuid NOT NULL, expected_revision integer NOT NULL CHECK(expected_revision > 0),
 request jsonb NOT NULL, before_allocation jsonb NOT NULL, after_allocation jsonb NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,venue_id,actor_user_id,idempotency_key),
 UNIQUE(reservation_id,expected_revision),
 FOREIGN KEY(organization_id,venue_id,reservation_id) REFERENCES reservations(organization_id,venue_id,id) ON DELETE RESTRICT
);
ALTER TABLE reservation_modifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reservation_modifications FROM PUBLIC,projectx_people_runtime;
CREATE POLICY scoped_read ON reservation_modifications FOR SELECT TO projectx_people_runtime
 USING(organization_id=people_context_uuid('app.organization_id') AND venue_id=people_context_uuid('app.venue_id') AND reservation_allowed('reservation.update'));
CREATE TRIGGER reservation_modification_immutable BEFORE UPDATE OR DELETE ON reservation_modifications
 FOR EACH ROW EXECUTE FUNCTION reservation_change_immutable();

-- Only allocation/result metadata, no guest or contact data.
CREATE FUNCTION reservation_allocation(r reservations) RETURNS jsonb LANGUAGE sql STABLE
SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('table_id',r.table_id,'shift_id',r.shift_id,'starts_at',r.starts_at,
   'ends_at',r.ends_at,'local_date',r.local_date,'timezone',r.timezone,'party_size',r.party_size,
   'status',r.status,'revision',r.revision,'updated_at',r.updated_at)
$$;
REVOKE ALL ON FUNCTION reservation_allocation(reservations) FROM PUBLIC;

CREATE OR REPLACE FUNCTION reservation_validate() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=projectx_test,pg_catalog,pg_temp AS $$
DECLARE slot record; capability text;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status<>'BOOKED' THEN
   RAISE EXCEPTION 'Invalid reservation transition' USING ERRCODE='23514';
 END IF;
 capability:=CASE WHEN TG_OP='INSERT' THEN 'reservation.create'
   WHEN NEW.status='CANCELLED' THEN 'reservation.cancel' ELSE 'reservation.update' END;
 IF NEW.organization_id IS DISTINCT FROM people_context_uuid('app.organization_id')
 OR NEW.venue_id IS DISTINCT FROM people_context_uuid('app.venue_id')
 OR NOT COALESCE(reservation_allowed(capability),false) THEN
   RAISE EXCEPTION 'Reservation access denied' USING ERRCODE='42501';
 END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'BOOKED' OR NEW.revision<>1 OR NEW.created_by_user_id IS DISTINCT FROM people_context_uuid('app.user_id') THEN
     RAISE EXCEPTION 'Invalid reservation' USING ERRCODE='23514';
   END IF;
   NEW.created_at:=clock_timestamp();
   NEW.updated_at:=clock_timestamp();
 ELSIF NEW.status='CANCELLED' THEN
   IF OLD.status<>'BOOKED'
      OR (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'updated_at') THEN
     RAISE EXCEPTION 'Invalid reservation transition' USING ERRCODE='23514';
   END IF;
   NEW.revision:=OLD.revision+1;
   NEW.updated_at:=clock_timestamp();
   RETURN NEW;
 ELSE
   IF OLD.status<>'BOOKED' OR NEW.status<>'BOOKED' OR NEW.revision<>OLD.revision+1
      OR (to_jsonb(NEW)-ARRAY['table_id','shift_id','starts_at','ends_at','local_date','timezone','party_size','revision','updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['table_id','shift_id','starts_at','ends_at','local_date','timezone','party_size','revision','updated_at'])
      OR NOT EXISTS(SELECT 1 FROM reservation_modifications m WHERE m.reservation_id=OLD.id
        AND m.organization_id=OLD.organization_id AND m.venue_id=OLD.venue_id
        AND m.actor_user_id=people_context_uuid('app.user_id') AND m.expected_revision=OLD.revision
        AND m.before_allocation=reservation_allocation(OLD) AND m.after_allocation=reservation_allocation(NEW)) THEN
     RAISE EXCEPTION 'Invalid reservation modification' USING ERRCODE='23514';
   END IF;
 END IF;
 -- Same shared configuration locks and slot validation as DOMAIN-001.
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
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION reservation_record_change() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=projectx_test,pg_catalog,pg_temp AS $$
BEGIN
 -- BOOKED modifications already have protected immutable command/audit evidence.
 IF TG_OP='INSERT' OR NEW.status='CANCELLED' THEN
   INSERT INTO reservation_changes(reservation_id,organization_id,venue_id,action,actor_user_id)
   VALUES(NEW.id,NEW.organization_id,NEW.venue_id,CASE WHEN TG_OP='INSERT' THEN 'CREATED' ELSE 'CANCELLED' END,people_context_uuid('app.user_id'));
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION reservation_modify(target uuid, expected integer, command_key uuid,
 requested_day date, requested_start timestamptz, requested_table uuid, requested_shift uuid, requested_party integer)
RETURNS reservations LANGUAGE plpgsql SECURITY DEFINER
SET search_path=projectx_test,pg_catalog,pg_temp AS $$
DECLARE
 original reservations; updated reservations; previous reservation_modifications; slot record; payload jsonb;
 org uuid:=people_context_uuid('app.organization_id'); venue uuid:=people_context_uuid('app.venue_id');
 actor uuid:=people_context_uuid('app.user_id');
BEGIN
 IF NOT COALESCE(reservation_allowed('reservation.update'),false) THEN
   RAISE EXCEPTION 'Reservation access denied' USING ERRCODE='42501';
 END IF;
 IF target IS NULL OR expected IS NULL OR expected<1 OR expected>=2147483647 OR command_key IS NULL
 OR requested_day IS NULL OR requested_day<'2000-01-01'::date OR requested_day>'2099-12-31'::date
 OR requested_start IS NULL OR NOT isfinite(requested_start) OR date_trunc('second',requested_start)<>requested_start
 OR requested_table IS NULL OR requested_shift IS NULL OR requested_party IS NULL OR requested_party NOT BETWEEN 1 AND 50 THEN
   RAISE EXCEPTION 'Invalid modification input' USING ERRCODE='23514';
 END IF;
 -- Typed JSON equality avoids trusting caller fingerprints; epoch is timezone-independent.
 payload:=jsonb_build_object('reservation_id',target,'expected_revision',expected,
   'day',to_char(requested_day,'YYYY-MM-DD'),'start_epoch',extract(epoch FROM requested_start),
   'table_id',requested_table,'shift_id',requested_shift,'party_size',requested_party);
 PERFORM pg_advisory_xact_lock(hashtextextended('reservation.modify/'||org||'/'||venue||'/'||actor||'/'||command_key,0));
 SELECT * INTO original FROM reservations WHERE id=target AND organization_id=org AND venue_id=venue FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found' USING ERRCODE='P1001'; END IF;
 -- A row/key wait must not turn revoked access into a successful replay.
 IF NOT COALESCE(reservation_allowed('reservation.update'),false) THEN
   RAISE EXCEPTION 'Reservation access denied' USING ERRCODE='42501';
 END IF;
 SELECT * INTO previous FROM reservation_modifications WHERE organization_id=org AND venue_id=venue
   AND actor_user_id=actor AND idempotency_key=command_key;
 IF FOUND THEN
   IF previous.request IS DISTINCT FROM payload THEN
     RAISE EXCEPTION 'Modification key conflict' USING ERRCODE='P1002';
   END IF;
   RETURN jsonb_populate_record(original,previous.after_allocation);
 END IF;
 IF original.status<>'BOOKED' THEN RAISE EXCEPTION 'Reservation not booked' USING ERRCODE='P1003'; END IF;
 IF original.revision<>expected THEN RAISE EXCEPTION 'Reservation revision conflict' USING ERRCODE='P1004'; END IF;
 PERFORM t.id FROM reservation_tables t JOIN reservation_shifts s USING(organization_id,venue_id)
   JOIN reservation_venue_settings v USING(organization_id,venue_id)
   WHERE t.id=requested_table AND s.id=requested_shift AND t.organization_id=org AND t.venue_id=venue
   FOR SHARE OF t,s,v;
 SELECT x.* INTO slot FROM reservation_slots(requested_day,requested_party) x
   JOIN reservation_tables t ON t.id=x.table_id
   WHERE t.organization_id=org AND t.venue_id=venue AND x.table_id=requested_table
     AND x.shift_id=requested_shift AND x.starts_at=requested_start;
 IF NOT FOUND THEN RAISE EXCEPTION 'Slot not bookable' USING ERRCODE='P1005'; END IF;
 updated:=original;
 updated.table_id:=requested_table; updated.shift_id:=requested_shift; updated.party_size:=requested_party;
 updated.local_date:=requested_day; updated.starts_at:=requested_start; updated.ends_at:=slot.ends_at; updated.timezone:=slot.timezone;
 updated.revision:=original.revision+1; updated.updated_at:=clock_timestamp();
 INSERT INTO reservation_modifications(organization_id,venue_id,actor_user_id,idempotency_key,reservation_id,
   expected_revision,request,before_allocation,after_allocation)
 VALUES(org,venue,actor,command_key,target,expected,payload,reservation_allocation(original),reservation_allocation(updated));
 UPDATE reservations SET table_id=updated.table_id,shift_id=updated.shift_id,party_size=updated.party_size,
   local_date=updated.local_date,starts_at=updated.starts_at,ends_at=updated.ends_at,timezone=updated.timezone,
   revision=updated.revision,updated_at=updated.updated_at
 WHERE id=target AND organization_id=org AND venue_id=venue RETURNING * INTO updated;
 RETURN updated;
END $$;
REVOKE ALL ON FUNCTION reservation_modify(uuid,integer,uuid,date,timestamptz,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reservation_modify(uuid,integer,uuid,date,timestamptz,uuid,uuid,integer) TO projectx_people_runtime;
-- No new UPDATE grants or permissive UPDATE policy. Cancellation still needs cancel rights;
-- modification enters only through the fully scoped function above.
