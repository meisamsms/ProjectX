-- DOMAIN-003: additive internal check-in and seating lifecycle; narrow transition authority.
INSERT INTO permissions(id,scope,risk,description) VALUES
 ('reservation.checkin','VENUE','SENSITIVE','Check in authorized venue reservation'),
 ('reservation.seat','VENUE','SENSITIVE','Seat checked-in authorized venue reservation')
ON CONFLICT (id) DO UPDATE SET scope=EXCLUDED.scope,risk=EXCLUDED.risk,description=EXCLUDED.description;

ALTER TABLE reservations DROP CONSTRAINT reservations_status_check,
 ADD CONSTRAINT reservations_status_check CHECK (status IN ('BOOKED','CHECKED_IN','SEATED','CANCELLED'));
ALTER TABLE reservations DROP CONSTRAINT reservation_no_overlap,
 ADD CONSTRAINT reservation_no_overlap EXCLUDE USING gist
  (table_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (status IN ('BOOKED','CHECKED_IN','SEATED'));

CREATE OR REPLACE FUNCTION reservation_validate() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=projectx_test,pg_catalog,pg_temp AS $$
DECLARE slot record; capability text;
BEGIN
 IF TG_OP='UPDATE' AND NOT (
   (OLD.status='BOOKED' AND NEW.status IN ('BOOKED','CHECKED_IN','CANCELLED'))
   OR (OLD.status='CHECKED_IN' AND NEW.status='SEATED')
 ) THEN
   RAISE EXCEPTION 'Invalid reservation transition' USING ERRCODE='23514';
 END IF;
 capability:=CASE WHEN TG_OP='INSERT' THEN 'reservation.create'
   WHEN NEW.status='CANCELLED' THEN 'reservation.cancel'
   WHEN NEW.status='CHECKED_IN' THEN 'reservation.checkin'
   WHEN NEW.status='SEATED' THEN 'reservation.seat'
   ELSE 'reservation.update' END;
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
 ELSIF NEW.status IN ('CHECKED_IN','SEATED') THEN
   IF NEW.revision<>OLD.revision+1
      OR (to_jsonb(NEW)-ARRAY['status','revision','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','updated_at'])
      OR NOT EXISTS(SELECT 1 FROM reservation_modifications m WHERE m.reservation_id=OLD.id
        AND m.organization_id=OLD.organization_id AND m.venue_id=OLD.venue_id
        AND m.actor_user_id=people_context_uuid('app.user_id') AND m.expected_revision=OLD.revision
        AND m.before_allocation=reservation_allocation(OLD) AND m.after_allocation=reservation_allocation(NEW)) THEN
     RAISE EXCEPTION 'Invalid reservation transition' USING ERRCODE='23514';
   END IF;
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

CREATE FUNCTION reservation_transition(target uuid, expected integer, command_key uuid, next_status text)
RETURNS reservations LANGUAGE plpgsql SECURITY DEFINER
SET search_path=projectx_test,pg_catalog,pg_temp AS $$
DECLARE
 original reservations; updated reservations; previous reservation_modifications; payload jsonb;
 capability text; required_status text;
 org uuid:=people_context_uuid('app.organization_id'); venue uuid:=people_context_uuid('app.venue_id');
 actor uuid:=people_context_uuid('app.user_id');
BEGIN
 IF next_status='CHECKED_IN' THEN
   capability:='reservation.checkin'; required_status:='BOOKED';
 ELSIF next_status='SEATED' THEN
   capability:='reservation.seat'; required_status:='CHECKED_IN';
 ELSE
   RAISE EXCEPTION 'Invalid lifecycle status' USING ERRCODE='23514';
 END IF;
 IF NOT COALESCE(reservation_allowed(capability),false) THEN
   RAISE EXCEPTION 'Reservation access denied' USING ERRCODE='42501';
 END IF;
 IF target IS NULL OR expected IS NULL OR expected<1 OR expected>=2147483647 OR command_key IS NULL THEN
   RAISE EXCEPTION 'Invalid transition input' USING ERRCODE='23514';
 END IF;
 payload:=jsonb_build_object('operation',next_status,'reservation_id',target,'expected_revision',expected);
 PERFORM pg_advisory_xact_lock(hashtextextended('reservation.modify/'||org||'/'||venue||'/'||actor||'/'||command_key,0));
 SELECT * INTO original FROM reservations WHERE id=target AND organization_id=org AND venue_id=venue FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found' USING ERRCODE='P1001'; END IF;
 IF NOT COALESCE(reservation_allowed(capability),false) THEN
   RAISE EXCEPTION 'Reservation access denied' USING ERRCODE='42501';
 END IF;
 SELECT * INTO previous FROM reservation_modifications WHERE organization_id=org AND venue_id=venue
   AND actor_user_id=actor AND idempotency_key=command_key;
 IF FOUND THEN
   IF previous.request IS DISTINCT FROM payload THEN
     RAISE EXCEPTION 'Transition key conflict' USING ERRCODE='P1002';
   END IF;
   RETURN jsonb_populate_record(original,previous.after_allocation);
 END IF;
 IF original.status<>required_status THEN RAISE EXCEPTION 'Invalid reservation state' USING ERRCODE='P1003'; END IF;
 IF original.revision<>expected THEN RAISE EXCEPTION 'Reservation revision conflict' USING ERRCODE='P1004'; END IF;
 updated:=original;
 updated.status:=next_status;
 updated.revision:=original.revision+1;
 updated.updated_at:=clock_timestamp();
 INSERT INTO reservation_modifications(organization_id,venue_id,actor_user_id,idempotency_key,reservation_id,
   expected_revision,request,before_allocation,after_allocation)
 VALUES(org,venue,actor,command_key,target,expected,payload,reservation_allocation(original),reservation_allocation(updated));
 UPDATE reservations SET status=updated.status,revision=updated.revision,updated_at=updated.updated_at
 WHERE id=target AND organization_id=org AND venue_id=venue RETURNING * INTO updated;
 RETURN updated;
END $$;
REVOKE ALL ON FUNCTION reservation_transition(uuid,integer,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reservation_transition(uuid,integer,uuid,text) TO projectx_people_runtime;
