-- DOMAIN-007 (ADR-0023): public guest booking boundary. Additive; staff grants/RLS unchanged.
-- Public authority enters only through two narrow SECURITY DEFINER functions; no synthetic staff users.
ALTER TABLE reservation_venue_settings
 ADD COLUMN public_slug text UNIQUE CHECK (public_slug IS NULL OR (char_length(public_slug) BETWEEN 3 AND 64 AND public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')),
 ADD COLUMN public_booking_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE reservations
 ALTER COLUMN created_by_user_id DROP NOT NULL,
 ADD COLUMN booking_source text NOT NULL DEFAULT 'STAFF' CHECK (booking_source IN ('STAFF','PUBLIC_WIDGET')),
 ADD COLUMN public_confirmation jsonb,
 ADD CONSTRAINT reservations_booking_actor CHECK (
   (booking_source='STAFF' AND created_by_user_id IS NOT NULL AND public_confirmation IS NULL)
   OR (booking_source='PUBLIC_WIDGET' AND created_by_user_id IS NULL AND public_confirmation IS NOT NULL
       AND jsonb_typeof(public_confirmation)='object'));
CREATE UNIQUE INDEX reservations_public_idempotency_idx ON reservations(organization_id,venue_id,idempotency_key)
 WHERE booking_source='PUBLIC_WIDGET';
-- Custom GUCs and call-stack text are not standalone authority. Direct runtime
-- inserts must remain STAFF even if a caller constructs a matching guard.
CREATE POLICY reservations_staff_insert_source ON reservations AS RESTRICTIVE
 FOR INSERT TO projectx_people_runtime
 WITH CHECK (booking_source='STAFF' AND created_by_user_id IS NOT NULL AND public_confirmation IS NULL);

ALTER TABLE reservation_changes
 ALTER COLUMN actor_user_id DROP NOT NULL,
 ADD COLUMN actor_kind text NOT NULL DEFAULT 'STAFF' CHECK (actor_kind IN ('STAFF','GUEST')),
 ADD CONSTRAINT reservation_changes_actor CHECK (
   (actor_kind='STAFF' AND actor_user_id IS NOT NULL)
   OR (actor_kind='GUEST' AND actor_user_id IS NULL AND action='CREATED'));

-- Preserve DOMAIN-003 staff transitions; the PUBLIC_WIDGET insert branch
-- requires active call-stack and transaction guard from reservation_public_create so runtime/staff cannot forge guest rows.
CREATE OR REPLACE FUNCTION reservation_validate() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=projectx_test,pg_catalog,pg_temp AS $$
DECLARE slot record; capability text; ctx text;
BEGIN
 IF TG_OP='INSERT' AND NEW.booking_source='PUBLIC_WIDGET' THEN
  GET DIAGNOSTICS ctx = PG_CONTEXT;
  IF NEW.status<>'BOOKED' OR NEW.revision<>1 OR NEW.created_by_user_id IS NOT NULL
     OR position('reservation_public_create(' IN ctx)=0
     OR current_setting('projectx.public_booking_guard',true) IS DISTINCT FROM (NEW.id::text||':'||NEW.request_fingerprint)
     OR NOT EXISTS(SELECT 1 FROM reservation_venue_settings v WHERE v.organization_id=NEW.organization_id
       AND v.venue_id=NEW.venue_id AND v.public_booking_enabled AND v.public_slug IS NOT NULL) THEN
    RAISE EXCEPTION 'Reservation access denied' USING ERRCODE='42501';
  END IF;
  NEW.created_at:=clock_timestamp();
  NEW.updated_at:=clock_timestamp();
 ELSE
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
    IF NEW.status<>'BOOKED' OR NEW.revision<>1 OR NEW.booking_source<>'STAFF' OR NEW.public_confirmation IS NOT NULL OR NEW.created_by_user_id IS DISTINCT FROM people_context_uuid('app.user_id') THEN
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
 END IF;
 -- Same shared configuration locks and slot validation as DOMAIN-001 for every allocation write.
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
 IF TG_OP='INSERT' OR NEW.status='CANCELLED' THEN
   INSERT INTO reservation_changes(reservation_id,organization_id,venue_id,action,actor_user_id,actor_kind)
   VALUES(NEW.id,NEW.organization_id,NEW.venue_id,CASE WHEN TG_OP='INSERT' THEN 'CREATED' ELSE 'CANCELLED' END,
     CASE WHEN TG_OP='INSERT' AND NEW.booking_source='PUBLIC_WIDGET' THEN NULL ELSE people_context_uuid('app.user_id') END,
     CASE WHEN TG_OP='INSERT' AND NEW.booking_source='PUBLIC_WIDGET' THEN 'GUEST' ELSE 'STAFF' END);
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION reservation_public_iso(value timestamptz) RETURNS text LANGUAGE sql IMMUTABLE
SET search_path=pg_catalog AS $$ SELECT to_char(value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
REVOKE ALL ON FUNCTION reservation_public_iso(timestamptz) FROM PUBLIC;

-- Purpose-limited projection: Venue display data and distinct bookable times only.
CREATE FUNCTION reservation_public_availability(requested_slug text, requested_day date, requested_party integer,
 from_minute integer, to_minute integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=projectx_test,pg_catalog,pg_temp AS $$
DECLARE v record; items jsonb;
BEGIN
 IF requested_slug IS NULL OR requested_day IS NULL OR requested_day<'2000-01-01'::date OR requested_day>'2099-12-31'::date
  OR requested_party IS NULL OR requested_party NOT BETWEEN 1 AND 50
  OR from_minute IS NULL OR to_minute IS NULL OR from_minute<0 OR to_minute>1440 OR from_minute>=to_minute THEN
   RAISE EXCEPTION 'Invalid availability input' USING ERRCODE='23514';
 END IF;
 SELECT s.organization_id,s.venue_id,s.timezone,s.public_slug,n.name INTO v
  FROM reservation_venue_settings s JOIN venues n ON n.organization_id=s.organization_id AND n.id=s.venue_id
  WHERE s.public_slug=requested_slug AND s.public_booking_enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'Venue not found' USING ERRCODE='P1001'; END IF;
 -- Owner context bypasses RLS, so every slot is explicitly constrained to the resolved Venue.
 SELECT COALESCE(jsonb_agg(jsonb_build_object('startsAt',reservation_public_iso(d.starts_at),
   'endsAt',reservation_public_iso(d.ends_at),'timezone',d.timezone) ORDER BY d.starts_at,d.ends_at),'[]'::jsonb)
 INTO items FROM (
  SELECT DISTINCT x.starts_at,x.ends_at,x.timezone FROM reservation_slots(requested_day,requested_party) x
  JOIN reservation_tables t ON t.id=x.table_id AND t.organization_id=v.organization_id AND t.venue_id=v.venue_id
  WHERE extract(hour FROM x.starts_at AT TIME ZONE x.timezone)*60+extract(minute FROM x.starts_at AT TIME ZONE x.timezone)>=from_minute
  AND extract(hour FROM x.starts_at AT TIME ZONE x.timezone)*60+extract(minute FROM x.starts_at AT TIME ZONE x.timezone)<to_minute
  AND NOT EXISTS(SELECT 1 FROM reservations r WHERE r.table_id=x.table_id AND r.status IN ('BOOKED','CHECKED_IN','SEATED')
    AND tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(x.starts_at,x.ends_at,'[)'))) d;
 RETURN jsonb_build_object('venue',jsonb_build_object('slug',v.public_slug,'name',v.name,'timezone',v.timezone),'items',items);
END $$;
REVOKE ALL ON FUNCTION reservation_public_availability(text,date,integer,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reservation_public_availability(text,date,integer,integer,integer) TO projectx_people_runtime;

-- Guest create: server-side best-fit allocation; caller never supplies table/shift/tenant IDs.
CREATE FUNCTION reservation_public_create(requested_slug text, requested_day date, requested_party integer,
 requested_start timestamptz, requested_name text, requested_email text, command_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=projectx_test,pg_catalog,pg_temp AS $$
DECLARE
 v record; candidate record; existing reservations; confirmation jsonb; fingerprint text;
 guest_name text:=btrim(requested_name); guest_email text:=btrim(requested_email); new_id uuid; new_client uuid;
BEGIN
 IF requested_slug IS NULL OR command_key IS NULL OR requested_day IS NULL
  OR requested_day<'2000-01-01'::date OR requested_day>'2099-12-31'::date
  OR requested_party IS NULL OR requested_party NOT BETWEEN 1 AND 50
  OR requested_start IS NULL OR NOT isfinite(requested_start) OR date_trunc('second',requested_start)<>requested_start
  OR guest_name IS NULL OR char_length(guest_name) NOT BETWEEN 1 AND 120 OR guest_name ~ '[[:cntrl:]]'
  OR guest_email IS NULL OR char_length(guest_email) NOT BETWEEN 3 AND 254 OR guest_email ~ '[[:cntrl:]]'
  OR guest_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
   RAISE EXCEPTION 'Invalid booking input' USING ERRCODE='23514';
 END IF;
 SELECT s.organization_id,s.venue_id,s.public_slug,n.name INTO v
  FROM reservation_venue_settings s JOIN venues n ON n.organization_id=s.organization_id AND n.id=s.venue_id
  WHERE s.public_slug=requested_slug AND s.public_booking_enabled FOR SHARE OF s;
 IF NOT FOUND THEN RAISE EXCEPTION 'Venue not found' USING ERRCODE='P1001'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('day',to_char(requested_day,'YYYY-MM-DD'),
   'party',requested_party,'start_epoch',extract(epoch FROM requested_start),'name',guest_name,
   'email',lower(guest_email))::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('reservation.public.create/'||v.organization_id||'/'||v.venue_id||'/'||command_key,0));
 SELECT * INTO existing FROM reservations
  WHERE organization_id=v.organization_id AND venue_id=v.venue_id AND booking_source='PUBLIC_WIDGET' AND idempotency_key=command_key;
 IF FOUND THEN
   IF existing.request_fingerprint<>fingerprint THEN
     RAISE EXCEPTION 'Booking key conflict' USING ERRCODE='P1002';
   END IF;
   RETURN existing.public_confirmation;
 END IF;
 PERFORM 1 FROM reservation_tables t WHERE t.organization_id=v.organization_id AND t.venue_id=v.venue_id FOR SHARE;
 PERFORM 1 FROM reservation_shifts s WHERE s.organization_id=v.organization_id AND s.venue_id=v.venue_id
  AND s.local_date=requested_day FOR SHARE;
 FOR candidate IN
  SELECT x.table_id,x.shift_id,x.ends_at,x.timezone FROM reservation_slots(requested_day,requested_party) x
  JOIN reservation_tables t ON t.id=x.table_id AND t.organization_id=v.organization_id AND t.venue_id=v.venue_id
  WHERE x.starts_at=requested_start
  AND NOT EXISTS(SELECT 1 FROM reservations r WHERE r.table_id=x.table_id AND r.status IN ('BOOKED','CHECKED_IN','SEATED')
    AND tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(x.starts_at,x.ends_at,'[)'))
  ORDER BY t.capacity,t.id,x.shift_id
 LOOP
  BEGIN
   new_id:=gen_random_uuid(); new_client:=gen_random_uuid();
   confirmation:=jsonb_build_object('reservationId',new_id,'venueSlug',v.public_slug,'venueName',v.name,
     'date',to_char(requested_day,'YYYY-MM-DD'),'startsAt',reservation_public_iso(requested_start),
     'endsAt',reservation_public_iso(candidate.ends_at),'timezone',candidate.timezone,'partySize',requested_party,
     'guestName',guest_name,'status','BOOKED','confirmationDelivery','NONE');
   PERFORM set_config('projectx.public_booking_guard',new_id::text||':'||fingerprint,true);
   INSERT INTO reservation_clients(id,organization_id) VALUES(new_client,v.organization_id);
   INSERT INTO reservations(id,organization_id,venue_id,client_id,table_id,shift_id,guest_name,guest_email,party_size,
     starts_at,ends_at,local_date,timezone,status,created_by_user_id,idempotency_key,request_fingerprint,booking_source,public_confirmation)
   VALUES(new_id,v.organization_id,v.venue_id,new_client,candidate.table_id,candidate.shift_id,guest_name,guest_email,
     requested_party,requested_start,candidate.ends_at,requested_day,candidate.timezone,'BOOKED',NULL,command_key,
     fingerprint,'PUBLIC_WIDGET',confirmation);
   PERFORM set_config('projectx.public_booking_guard','',true);
   RETURN confirmation;
  EXCEPTION WHEN exclusion_violation THEN
   PERFORM set_config('projectx.public_booking_guard','',true);
   NULL; -- A concurrent booking won this table; try the next deterministic candidate.
  END;
 END LOOP;
 RAISE EXCEPTION 'Slot not bookable' USING ERRCODE='P1005';
END $$;
REVOKE ALL ON FUNCTION reservation_public_create(text,date,integer,timestamptz,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reservation_public_create(text,date,integer,timestamptz,text,text,uuid) TO projectx_people_runtime;
