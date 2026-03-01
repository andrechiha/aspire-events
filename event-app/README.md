# Aspire Events

An AI-powered event management platform built with **React** and **Supabase**. The core idea behind Aspire Events is to use artificial intelligence to help event managers understand their audience before, during, and after events. By analyzing real-time chat conversations between attendees, the platform generates actionable insights — from pre-event excitement and expectations to post-event sentiment and feedback — giving managers data-driven tools that traditional event platforms lack.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, React Router, Leaflet (maps), Lucide icons |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| AI Engine | OpenAI GPT-4o-mini via Supabase Edge Functions (Deno runtime) |
| AI Data Source | Real-time event chat messages analyzed for sentiment, expectations, and feedback |
| PDF | jsPDF + QRCode for ticket and invitation generation |

---

## Roles and Permissions

The platform supports three user roles, each with distinct access levels.

**Owner (Admin)**
- View and manage all events across the platform
- Approve or reject events submitted by managers
- Ban or unban users and change user roles
- Full visibility over all ticket orders, sales, and RSVP data

**Event Manager**
- Create events with full details: title, description, rules, lineup, location with map, promoter info, media gallery, and ticket waves
- Edit their own events
- Manage event chat: pin messages, create polls, kick or restore members
- View ticket sales, order details, and RSVP responses for their events
- Generate AI reports to analyze attendee sentiment and feedback

**Client (Attendee)**
- Browse and search approved events with filters (This Week, Near Me, location-based)
- Purchase tickets through a wave-based pricing system with service fees
- Buy tickets for friends (gift mode) with personalized invitation PDFs
- RSVP to events (Going, Maybe, Can't Go) even without purchasing a ticket
- Join event group chats: send text, photos, videos, and voice notes
- Reply to messages and delete own messages in chat
- Vote in polls created by the event manager
- Download PDF tickets with QR codes for each ticket holder
- Change password with current password verification
- Reset password via email

---

## AI Integration -- The Core of Aspire Events

The central feature of Aspire Events is its AI-powered analysis system. Traditional event platforms only handle logistics (tickets, dates, venues). Aspire Events goes further by turning attendee conversations into structured intelligence that event managers can act on.

**How It Works -- End to End**

1. Every approved event has a real-time group chat where attendees (ticket holders) and the event manager communicate freely. People discuss expectations, ask questions, share excitement, and after the event, talk about their experience.

2. When the event manager wants insights, they open the AI Report page for their event. The system collects all chat messages from the event's group chat and sends them to OpenAI's GPT-4o-mini model via a Supabase Edge Function.

3. The AI processes the messages and returns structured JSON data. The prompt is carefully engineered to extract specific categories of information depending on whether the event has already happened or not.

4. The frontend takes the structured JSON and renders it as a rich visual dashboard with animated sentiment rings, color-coded lists, and topic pills.

**Pre-Event Analysis (Expectations Report)**

Before the event date, the AI analyzes chat conversations to generate:

- **Excitement Level** -- A score from 0 to 100 representing how hyped attendees are, displayed as an animated circular ring
- **Top Expectations** -- What attendees are most looking forward to (specific performances, activities, etc.)
- **Main Concerns** -- Worries or questions people have raised (parking, weather, timing, etc.)
- **Trending Topics** -- The most discussed subjects in the chat, shown as topic pills with mention counts
- **Summary** -- A natural language overview of the overall mood and expectations

**Post-Event Analysis (Feedback Report)**

After the event date passes, the AI switches to feedback mode and generates:

- **Sentiment Score** -- A 0 to 100 rating of overall attendee satisfaction, color-coded (green for positive, yellow for mixed, red for negative)
- **Positive Highlights** -- What people loved about the event
- **Negative Feedback** -- What disappointed attendees or what went wrong
- **Actionable Suggestions** -- Concrete improvements the manager can make for future events
- **Top Discussed Topics** -- What people talked about most after the event
- **Summary** -- A paragraph-level recap of the overall reception

**Technical Architecture**

- The AI logic runs inside a **Supabase Edge Function** (`analyze-event-feedback/index.ts`), which executes in a Deno runtime on Supabase's infrastructure. This keeps the OpenAI API key secure on the server side.
- The Edge Function receives the event ID, fetches all chat messages from the database, determines whether the event is pre or post based on the event date, builds a tailored prompt, calls the OpenAI API, and returns the structured result.
- Reports are **cached in the `ai_event_reports` table** with separate columns for expectations data and feedback data. When a manager views the report page, the app first checks for a cached report. If one exists, it loads instantly. If not, it triggers the Edge Function.
- Managers can **force-refresh** a report at any time to get updated analysis based on newer messages.
- The frontend component (`AIReportPanel`) renders the JSON data as visual cards -- animated SVG rings for scores, ordered lists for highlights and suggestions, and pill-shaped tags for topics.

**Why This Matters**

Event managers traditionally rely on post-event surveys (which most people ignore) or manual observation. With Aspire Events, the AI passively analyzes organic conversations that are already happening. Managers get honest, unfiltered insights without asking attendees to fill out anything. This makes the feedback more authentic and the analysis more useful.

---

## Key Features

**Ticketing System**
- Wave-based pricing (Early Bird, Regular, VIP, etc.) with automatic wave progression when capacity fills
- Service fee added to each order
- Order and ticket numbers generated automatically
- Multi-ticket purchases with individual holder names
- Gift tickets with recipient name and personalized invitation PDF
- QR codes on every ticket for event-day scanning

**Real-Time Chat**
- Per-event group chat for ticket holders and event managers
- Text messages, image and video uploads, and voice notes
- Reply to messages with quoted reference
- Delete own messages in real-time
- Polls created by the event manager, displayed inline in the chat timeline
- Pin important messages (manager only)
- Kick and restore members (manager only)
- Group info panel with member list
- Leave and rejoin functionality

**PDF Generation**
- Professional dark-themed ticket PDFs with gold accents
- Event banner image and QR code on every ticket
- Multi-page PDFs when buying multiple tickets (one page per holder)
- Gift invitation variant with "You are invited by..." header and no price shown

**RSVP System**
- Attendees can indicate Going, Maybe, or Can't Go on any event
- Live counts visible on the event detail page
- RSVP breakdown visible to event managers and owners in the detail panel

**Mobile-Friendly UI**
- Fully responsive design that works on phones, tablets, and desktops
- On mobile, the admin sidebar transforms into a bottom navigation bar
- Chat screens go fullscreen on mobile with no wasted space (top bar and tab bar hide automatically)
- Event grids, ticket modals, forms, and all pages adapt to small screens
- Safe area support for iOS devices (notch, home indicator)
- No horizontal overflow or layout breaking on any screen size

---

## Getting Started

**Prerequisites**
- Node.js 16 or higher
- A Supabase project

**Step 1 -- Install dependencies**

```
cd event-app
npm install
```

**Step 2 -- Configure environment variables**

```
cp .env.example .env
```

Open the `.env` file and fill in your Supabase URL, Supabase anon key, and OpenAI API key.

**Step 3 -- Set up the database**

- Open the Supabase SQL Editor
- Copy and run the entire contents of `supabase/database_setup.sql`
- In Supabase Storage, create a public bucket named `event-media`

**Step 4 -- Create the owner account**

- Sign up through the app normally
- Then in the Supabase SQL Editor, run:

```
UPDATE public.profiles SET role = 'owner' WHERE id = 'your-user-id-here';
```

**Step 5 -- Deploy the AI Edge Function (optional)**

If you want AI-powered event reports, deploy the function at `supabase/functions/analyze-event-feedback/index.ts` using the Supabase CLI.

**Step 6 -- Start the development server**

```
npm start
```

The app will be available at `http://localhost:3000`.

---

## Project Structure

```
event-app/
  src/
    components/       Shared UI components (Layout, WavesEditor, AIReportPanel, etc.)
    context/          AuthContext (session, profile, role management)
    screens/
      auth/           Login, Signup, ResetPassword
      client/         EventsList, EventDetail, EventChat, MyTickets, etc.
      manager/        MyEvents, CreateEvent, EditEvent, AIReport
      owner/          AllEvents, PendingEvents, UsersList
    services/         Supabase client configuration
    utils/            PDF generation utility
supabase/
  database_setup.sql  Complete database schema (run once in Supabase SQL Editor)
  functions/          Edge Functions for AI analysis
```
