-- ============================================================
--  ASPIRE EVENTS — Complete Database Setup
--  Run this entire file in the Supabase SQL Editor (one shot)
-- ============================================================
--  This creates all tables, indexes, RLS policies, and RPC
--  functions needed for the app to run.
-- ============================================================


-- ████████████████████████████████████████████████████████████
-- PART 1: EXTENSIONS & HELPERS
-- ████████████████████████████████████████████████████████████

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.is_not_banned()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT NOT banned FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ████████████████████████████████████████████████████████████
-- PART 2: TABLES
-- ████████████████████████████████████████████████████████████

-- ── 1. PROFILES ──
CREATE TABLE public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text        NOT NULL,
  role       text        NOT NULL DEFAULT 'client'
               CHECK (role IN ('owner', 'event_manager', 'client')),
  banned     boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_role ON public.profiles(role);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'client')
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. EVENTS ──
CREATE TABLE public.events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             text        NOT NULL,
  description       text,
  rules             text,
  start_datetime    timestamptz NOT NULL,
  end_datetime      timestamptz NOT NULL,
  location_name     text,
  location_address  text,
  location_link     text,
  latitude          double precision,
  longitude         double precision,
  logo_url          text,
  promoter_name     text,
  promoter_logo_url text,
  promoter_instagram text,
  lineup            jsonb       DEFAULT '[]'::jsonb,
  chat_enabled      boolean     NOT NULL DEFAULT true,
  chat_description  text,
  status            text        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_events_dates CHECK (end_datetime > start_datetime)
);
CREATE INDEX idx_events_status     ON public.events(status);
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_events_start      ON public.events(start_datetime);
CREATE INDEX idx_events_geo        ON public.events(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ── 3. TICKET WAVES ──
CREATE TABLE public.ticket_waves (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  wave_number int           NOT NULL,
  label       text          NOT NULL,
  price       numeric(10,2) NOT NULL CHECK (price >= 0),
  capacity    int           NOT NULL CHECK (capacity > 0),
  remaining   int           NOT NULL CHECK (remaining >= 0),
  is_active   boolean       NOT NULL DEFAULT false,
  created_at  timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT uq_wave_per_event    UNIQUE (event_id, wave_number),
  CONSTRAINT chk_wave_remaining   CHECK (remaining <= capacity)
);
CREATE INDEX idx_ticket_waves_event  ON public.ticket_waves(event_id);
CREATE INDEX idx_ticket_waves_active ON public.ticket_waves(event_id, is_active) WHERE is_active = true;

-- ── 4. TICKET ORDERS ──
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1000;

CREATE TABLE public.ticket_orders (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id         uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wave_id         uuid          REFERENCES public.ticket_waves(id),
  quantity        int           NOT NULL CHECK (quantity > 0),
  total_price     numeric(10,2) NOT NULL CHECK (total_price >= 0),
  service_fee     numeric(10,2) NOT NULL DEFAULT 3.00,
  order_number    text,
  ticket_number   text,
  is_gift         boolean       DEFAULT false,
  recipient_name  text,
  recipient_email text,
  gifted_by       uuid          REFERENCES auth.users(id),
  holder_names    jsonb,
  created_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_orders_event ON public.ticket_orders(event_id);
CREATE INDEX idx_ticket_orders_user  ON public.ticket_orders(user_id);

-- ── 5. EVENT ATTENDEES ──
CREATE TABLE public.event_attendees (
  event_id   uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX idx_event_attendees_user ON public.event_attendees(user_id);

-- ── 6. EVENT MESSAGES ──
CREATE TABLE public.event_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message      text        NOT NULL,
  message_type text        NOT NULL DEFAULT 'text'
                 CHECK (message_type IN ('text', 'image', 'video', 'voice', 'system')),
  media_url    text,
  is_pinned    boolean     NOT NULL DEFAULT false,
  pinned_by    uuid        REFERENCES public.profiles(id),
  reply_to     uuid        REFERENCES public.event_messages(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_msgs_event ON public.event_messages(event_id, created_at);

-- ── 7. EVENT MEDIA ──
CREATE TABLE public.event_media (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  media_type   text        NOT NULL CHECK (media_type IN ('image', 'video', 'logo')),
  storage_path text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_media_event ON public.event_media(event_id);

-- ── 8. CHAT POLLS ──
CREATE TABLE public.chat_polls (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_by uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question   text        NOT NULL,
  options    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_polls_event ON public.chat_polls(event_id);

-- ── 9. CHAT POLL VOTES ──
CREATE TABLE public.chat_poll_votes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    uuid        NOT NULL REFERENCES public.chat_polls(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_id  text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_poll_vote UNIQUE (poll_id, user_id)
);
CREATE INDEX idx_poll_votes_poll ON public.chat_poll_votes(poll_id);

-- ── 10. CHAT LEFT USERS (soft leave / kick) ──
CREATE TABLE public.chat_left_users (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

-- ── 11. EVENT RSVPS ──
CREATE TABLE public.event_rsvps (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status     text NOT NULL CHECK (status IN ('attending', 'maybe', 'not_going')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── 12. AI EVENT REPORTS ──
CREATE TABLE public.ai_event_reports (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  expectations_summary  text,
  feedback_summary      text,
  sentiment_score       integer     CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
  positives             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  negatives             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  suggestions           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  top_topics            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  message_count         integer     NOT NULL DEFAULT 0,
  expectations_data     jsonb,
  feedback_data         jsonb,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_report_event UNIQUE (event_id)
);
CREATE INDEX idx_ai_reports_event ON public.ai_event_reports(event_id);

-- ── 13. REVIEWS ──
CREATE TABLE public.reviews (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating     int         NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reviews_user_event UNIQUE (event_id, user_id)
);
CREATE INDEX idx_reviews_event ON public.reviews(event_id);

-- ── 14. COMMUNITIES ──
CREATE TABLE public.communities (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 15. COMMUNITY MESSAGES ──
CREATE TABLE public.community_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid        NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_msgs_room ON public.community_messages(community_id, created_at);

-- ── 16. NOTIFICATIONS ──
CREATE TABLE public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type       text NOT NULL DEFAULT 'info' CHECK (type IN ('event', 'ticket', 'reminder', 'info')),
  title      text NOT NULL,
  message    text NOT NULL,
  read       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);


-- ████████████████████████████████████████████████████████████
-- PART 3: ROW LEVEL SECURITY
-- ████████████████████████████████████████████████████████████

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_waves       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_polls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_poll_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_left_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_event_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ──
CREATE POLICY "profiles_select_basic" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_owner" ON public.profiles FOR UPDATE USING (public.get_my_role() = 'owner');

-- ── EVENTS ──
CREATE POLICY "events_select_approved"    ON public.events FOR SELECT USING (status = 'approved' AND public.is_not_banned());
CREATE POLICY "events_select_own_manager" ON public.events FOR SELECT USING (created_by = auth.uid() AND public.get_my_role() = 'event_manager' AND public.is_not_banned());
CREATE POLICY "events_select_owner"       ON public.events FOR SELECT USING (public.get_my_role() = 'owner');
CREATE POLICY "events_insert_manager"     ON public.events FOR INSERT WITH CHECK (created_by = auth.uid() AND public.get_my_role() = 'event_manager' AND public.is_not_banned() AND status = 'pending');
CREATE POLICY "events_update_own_manager" ON public.events FOR UPDATE USING (created_by = auth.uid() AND public.get_my_role() = 'event_manager' AND public.is_not_banned()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "events_update_owner"       ON public.events FOR UPDATE USING (public.get_my_role() = 'owner');
CREATE POLICY "events_delete_own_manager" ON public.events FOR DELETE USING (created_by = auth.uid() AND public.get_my_role() = 'event_manager' AND public.is_not_banned() AND status = 'pending');

-- ── EVENT MEDIA ──
CREATE POLICY "event_media_select_approved" ON public.event_media FOR SELECT USING (public.is_not_banned() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'approved'));
CREATE POLICY "event_media_select_creator"  ON public.event_media FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));
CREATE POLICY "event_media_insert"          ON public.event_media FOR INSERT WITH CHECK (public.is_not_banned() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));
CREATE POLICY "event_media_delete"          ON public.event_media FOR DELETE USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));

-- ── TICKET WAVES ──
CREATE POLICY "ticket_waves_select_approved" ON public.ticket_waves FOR SELECT USING (public.is_not_banned() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'approved'));
CREATE POLICY "ticket_waves_select_creator"  ON public.ticket_waves FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));
CREATE POLICY "ticket_waves_select_owner"    ON public.ticket_waves FOR SELECT USING (public.get_my_role() = 'owner');
CREATE POLICY "ticket_waves_insert"          ON public.ticket_waves FOR INSERT WITH CHECK (public.is_not_banned() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));
CREATE POLICY "ticket_waves_update_creator"  ON public.ticket_waves FOR UPDATE USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));
CREATE POLICY "ticket_waves_delete_creator"  ON public.ticket_waves FOR DELETE USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));

-- ── TICKET ORDERS ──
CREATE POLICY "ticket_orders_select_own"           ON public.ticket_orders FOR SELECT USING (user_id = auth.uid() AND public.is_not_banned());
CREATE POLICY "ticket_orders_select_owner"         ON public.ticket_orders FOR SELECT USING (public.get_my_role() = 'owner');
CREATE POLICY "ticket_orders_select_event_creator" ON public.ticket_orders FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));
CREATE POLICY "ticket_orders_insert"               ON public.ticket_orders FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_not_banned() AND public.get_my_role() = 'client');
CREATE POLICY "ticket_orders_update_own"           ON public.ticket_orders FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── EVENT ATTENDEES ──
CREATE POLICY "event_attendees_select_own"     ON public.event_attendees FOR SELECT USING (user_id = auth.uid() AND public.is_not_banned());
CREATE POLICY "event_attendees_select_owner"   ON public.event_attendees FOR SELECT USING (public.get_my_role() = 'owner');
CREATE POLICY "event_attendees_select_creator" ON public.event_attendees FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid()));
CREATE POLICY "event_attendees_insert"         ON public.event_attendees FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_not_banned());

-- ── EVENT MESSAGES ──
CREATE POLICY "event_messages_select"         ON public.event_messages FOR SELECT USING (public.is_not_banned() AND EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = event_messages.event_id AND ea.user_id = auth.uid()));
CREATE POLICY "event_messages_select_creator" ON public.event_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_messages.event_id AND e.created_by = auth.uid()));
CREATE POLICY "event_messages_insert"         ON public.event_messages FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_not_banned() AND EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = event_messages.event_id AND ea.user_id = auth.uid()));
CREATE POLICY "event_messages_insert_creator" ON public.event_messages FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_messages.event_id AND e.created_by = auth.uid()));
CREATE POLICY "event_messages_delete_own"     ON public.event_messages FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "event_messages_delete_creator" ON public.event_messages FOR DELETE USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_messages.event_id AND e.created_by = auth.uid()));
CREATE POLICY "event_messages_update_pin"     ON public.event_messages FOR UPDATE USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_messages.event_id AND e.created_by = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_messages.event_id AND e.created_by = auth.uid()));

-- ── CHAT POLLS ──
CREATE POLICY "polls_select"         ON public.chat_polls FOR SELECT USING (EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = chat_polls.event_id AND ea.user_id = auth.uid()));
CREATE POLICY "polls_select_creator" ON public.chat_polls FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = chat_polls.event_id AND e.created_by = auth.uid()));
CREATE POLICY "polls_insert"         ON public.chat_polls FOR INSERT WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = chat_polls.event_id AND e.created_by = auth.uid()));

-- ── CHAT POLL VOTES ──
CREATE POLICY "poll_votes_select"         ON public.chat_poll_votes FOR SELECT USING (EXISTS (SELECT 1 FROM public.chat_polls cp JOIN public.event_attendees ea ON ea.event_id = cp.event_id WHERE cp.id = chat_poll_votes.poll_id AND ea.user_id = auth.uid()));
CREATE POLICY "poll_votes_select_creator" ON public.chat_poll_votes FOR SELECT USING (EXISTS (SELECT 1 FROM public.chat_polls cp JOIN public.events e ON e.id = cp.event_id WHERE cp.id = chat_poll_votes.poll_id AND e.created_by = auth.uid()));
CREATE POLICY "poll_votes_insert"         ON public.chat_poll_votes FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_polls cp JOIN public.event_attendees ea ON ea.event_id = cp.event_id WHERE cp.id = chat_poll_votes.poll_id AND ea.user_id = auth.uid()));

-- ── CHAT LEFT USERS ──
CREATE POLICY "left_select"         ON public.chat_left_users FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "left_select_creator" ON public.chat_left_users FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = chat_left_users.event_id AND e.created_by = auth.uid()));
CREATE POLICY "left_insert"         ON public.chat_left_users FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "left_insert_creator" ON public.chat_left_users FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.events e JOIN public.event_attendees ea ON ea.event_id = e.id WHERE ea.user_id = chat_left_users.user_id AND ea.event_id = chat_left_users.event_id AND e.created_by = auth.uid()));
CREATE POLICY "left_delete"         ON public.chat_left_users FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "left_delete_creator" ON public.chat_left_users FOR DELETE USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = chat_left_users.event_id AND e.created_by = auth.uid()));

-- ── EVENT RSVPS ──
CREATE POLICY "rsvp_select_all"  ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "rsvp_insert_own"  ON public.event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rsvp_update_own"  ON public.event_rsvps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "rsvp_delete_own"  ON public.event_rsvps FOR DELETE USING (auth.uid() = user_id);

-- ── AI EVENT REPORTS ──
CREATE POLICY "ai_reports_select_manager" ON public.ai_event_reports FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ai_event_reports.event_id AND e.created_by = auth.uid()));
CREATE POLICY "ai_reports_select_owner"   ON public.ai_event_reports FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'owner'));

-- ── REVIEWS ──
CREATE POLICY "reviews_select"     ON public.reviews FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'approved'));
CREATE POLICY "reviews_insert"     ON public.reviews FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_not_banned() AND EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = reviews.event_id AND ea.user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = reviews.event_id AND e.end_datetime < now()));
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE USING (user_id = auth.uid() AND public.is_not_banned()) WITH CHECK (user_id = auth.uid());

-- ── COMMUNITIES ──
CREATE POLICY "communities_select"       ON public.communities FOR SELECT USING (public.is_not_banned());
CREATE POLICY "communities_insert_owner" ON public.communities FOR INSERT WITH CHECK (public.get_my_role() = 'owner');
CREATE POLICY "communities_update_owner" ON public.communities FOR UPDATE USING (public.get_my_role() = 'owner');
CREATE POLICY "communities_delete_owner" ON public.communities FOR DELETE USING (public.get_my_role() = 'owner');

-- ── COMMUNITY MESSAGES ──
CREATE POLICY "community_messages_select"     ON public.community_messages FOR SELECT USING (public.is_not_banned());
CREATE POLICY "community_messages_insert"     ON public.community_messages FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_not_banned());
CREATE POLICY "community_messages_delete_own" ON public.community_messages FOR DELETE USING (user_id = auth.uid());

-- ── NOTIFICATIONS ──
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (true);


-- ████████████████████████████████████████████████████████████
-- PART 4: RPC FUNCTIONS
-- ████████████████████████████████████████████████████████████

-- ── Purchase tickets (wave-aware, with service fee + order/ticket numbers) ──
CREATE OR REPLACE FUNCTION public.purchase_tickets(
  p_event_id uuid,
  p_quantity int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event   public.events%rowtype;
  v_profile public.profiles%rowtype;
  v_wave    public.ticket_waves%rowtype;
  v_next    public.ticket_waves%rowtype;
  v_new_remaining int;
  v_total_price   numeric(10,2);
  v_service_fee   numeric(10,2) := 3.00;
  v_order_num     text;
  v_ticket_num    text;
  v_order_id      uuid;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Profile not found'); END IF;
  IF v_profile.banned THEN RETURN jsonb_build_object('success', false, 'error', 'Account is banned'); END IF;
  IF v_profile.role <> 'client' THEN RETURN jsonb_build_object('success', false, 'error', 'Only clients can purchase tickets'); END IF;
  IF p_quantity < 1 THEN RETURN jsonb_build_object('success', false, 'error', 'Quantity must be at least 1'); END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Event not found'); END IF;
  IF v_event.status <> 'approved' THEN RETURN jsonb_build_object('success', false, 'error', 'Event is not available for purchase'); END IF;

  SELECT * INTO v_wave FROM public.ticket_waves WHERE event_id = p_event_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'No active ticket wave — sold out'); END IF;
  IF v_wave.remaining < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough tickets in current wave', 'remaining', v_wave.remaining, 'wave_label', v_wave.label);
  END IF;

  v_new_remaining := v_wave.remaining - p_quantity;
  v_total_price   := v_wave.price * p_quantity;
  UPDATE public.ticket_waves SET remaining = v_new_remaining WHERE id = v_wave.id;

  IF v_new_remaining = 0 THEN
    UPDATE public.ticket_waves SET is_active = false WHERE id = v_wave.id;
    SELECT * INTO v_next FROM public.ticket_waves WHERE event_id = p_event_id AND wave_number > v_wave.wave_number AND remaining > 0 ORDER BY wave_number LIMIT 1;
    IF FOUND THEN UPDATE public.ticket_waves SET is_active = true WHERE id = v_next.id; END IF;
  END IF;

  v_order_num  := 'ORD-' || LPAD(nextval('public.order_number_seq')::text, 6, '0');
  v_ticket_num := 'TKT-' || LPAD(floor(random() * 900000 + 100000)::text, 6, '0') || '-' || LPAD(p_quantity::text, 2, '0');

  INSERT INTO public.ticket_orders (event_id, user_id, quantity, total_price, wave_id, service_fee, order_number, ticket_number)
  VALUES (p_event_id, auth.uid(), p_quantity, v_total_price, v_wave.id, v_service_fee, v_order_num, v_ticket_num)
  RETURNING id INTO v_order_id;

  INSERT INTO public.event_attendees (event_id, user_id) VALUES (p_event_id, auth.uid()) ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true, 'remaining', v_new_remaining, 'total_price', v_total_price,
    'service_fee', v_service_fee, 'grand_total', v_total_price + v_service_fee,
    'quantity', p_quantity, 'wave_label', v_wave.label, 'wave_price', v_wave.price,
    'order_number', v_order_num, 'ticket_number', v_ticket_num, 'order_id', v_order_id
  );
END;
$$;

-- ── Purchase gift tickets ──
CREATE OR REPLACE FUNCTION public.purchase_gift_tickets(
  p_event_id uuid,
  p_quantity int,
  p_recipient_name text,
  p_recipient_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event   public.events%rowtype;
  v_profile public.profiles%rowtype;
  v_wave    public.ticket_waves%rowtype;
  v_next    public.ticket_waves%rowtype;
  v_new_remaining int;
  v_total_price   numeric(10,2);
  v_service_fee   numeric(10,2) := 3.00;
  v_order_num     text;
  v_ticket_num    text;
  v_order_id      uuid;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Profile not found'); END IF;
  IF v_profile.banned THEN RETURN jsonb_build_object('success', false, 'error', 'Account is banned'); END IF;
  IF v_profile.role <> 'client' THEN RETURN jsonb_build_object('success', false, 'error', 'Only clients can purchase tickets'); END IF;
  IF p_quantity < 1 THEN RETURN jsonb_build_object('success', false, 'error', 'Quantity must be at least 1'); END IF;
  IF p_recipient_name IS NULL OR trim(p_recipient_name) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Recipient name is required'); END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Event not found'); END IF;
  IF v_event.status <> 'approved' THEN RETURN jsonb_build_object('success', false, 'error', 'Event is not available for purchase'); END IF;

  SELECT * INTO v_wave FROM public.ticket_waves WHERE event_id = p_event_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'No active ticket wave — sold out'); END IF;
  IF v_wave.remaining < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough tickets in current wave', 'remaining', v_wave.remaining);
  END IF;

  v_new_remaining := v_wave.remaining - p_quantity;
  v_total_price   := v_wave.price * p_quantity;
  UPDATE public.ticket_waves SET remaining = v_new_remaining WHERE id = v_wave.id;

  IF v_new_remaining = 0 THEN
    UPDATE public.ticket_waves SET is_active = false WHERE id = v_wave.id;
    SELECT * INTO v_next FROM public.ticket_waves WHERE event_id = p_event_id AND wave_number > v_wave.wave_number AND remaining > 0 ORDER BY wave_number LIMIT 1;
    IF FOUND THEN UPDATE public.ticket_waves SET is_active = true WHERE id = v_next.id; END IF;
  END IF;

  v_order_num  := 'ORD-' || LPAD(nextval('public.order_number_seq')::text, 6, '0');
  v_ticket_num := 'TKT-' || LPAD(floor(random() * 900000 + 100000)::text, 6, '0') || '-' || LPAD(p_quantity::text, 2, '0');

  INSERT INTO public.ticket_orders (event_id, user_id, quantity, total_price, wave_id, service_fee, order_number, ticket_number, is_gift, recipient_name, recipient_email, gifted_by)
  VALUES (p_event_id, auth.uid(), p_quantity, v_total_price, v_wave.id, v_service_fee, v_order_num, v_ticket_num, true, trim(p_recipient_name), p_recipient_email, auth.uid())
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true, 'remaining', v_new_remaining, 'total_price', v_total_price,
    'service_fee', v_service_fee, 'grand_total', v_total_price + v_service_fee,
    'quantity', p_quantity, 'wave_label', v_wave.label, 'wave_price', v_wave.price,
    'order_number', v_order_num, 'ticket_number', v_ticket_num, 'order_id', v_order_id,
    'recipient_name', trim(p_recipient_name), 'is_gift', true
  );
END;
$$;


-- ████████████████████████████████████████████████████████████
-- PART 5: REALTIME
-- ████████████████████████████████████████████████████████████

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_poll_votes;


-- ████████████████████████████████████████████████████████████
-- PART 6: STORAGE
-- ████████████████████████████████████████████████████████████
-- In Supabase Dashboard > Storage:
--   1. Create a bucket called "event-media"
--   2. Set it to PUBLIC
--   3. Add a policy allowing authenticated users to upload


-- ████████████████████████████████████████████████████████████
-- PART 7: INITIAL SETUP
-- ████████████████████████████████████████████████████████████
-- After signing up your first user (the owner), run:
--
--   UPDATE public.profiles
--   SET role = 'owner'
--   WHERE id = '<YOUR_USER_UUID>';
--
-- ============================================================
-- DONE! Your database is ready.
-- ============================================================
