# Linea — 24-Hour Plan (User Features Only)

**Solo, 24 hours, React + Vite + Firebase RTDB.**
**Scope: every user-facing feature from the SIKAPTala brief.**

---

## What's In Scope (User-Side Only)

Every feature below is from the brief. Tagged by build depth:

- **🟢 FULL** — works live, demo-ready, you click through it confidently
- **🟡 VISIBLE** — UI built, basic happy-path works, don't stress-test on stage
- **🔵 STUB** — UI present with realistic mock state, labeled "v2" or shown as read-only

### General Context

| Feature | Tier | Notes |
|---|---|---|
| Weather context (sunny/rainy/cloudy → "good time to go") | 🟡 VISIBLE | OpenWeatherMap free tier, simple icon + label banner. Doesn't affect queue logic per brief. |
| Crowd surge detection ("right now: 41 people, usual: 35-45, lighter at 1PM") | 🔵 STUB | "Usual" needs historical data. Hardcode a realistic "usual range" per queue in the seed data. Display it convincingly. |

### Queue Discovery

| Feature | Tier | Notes |
|---|---|---|
| Browse available queues | 🟢 FULL | Cards grid, the home page |
| Queue status (open/paused/near capacity) | 🟢 FULL | Three states, color-coded badge |
| Crowd level (low/moderate/high) | 🟢 FULL | The core visual hook. `crowd_score = queue_length ÷ max_capacity`, clamped |
| "Walk-in disabled" when crowd is high | 🟢 FULL | Conditional CTA: high crowd → only "Join Remotely" enabled |
| Queue length breakdown (waiting / serving / next) | 🟢 FULL | Three small stats on each card and the queue detail page |
| Service type per station (regular vs priority) | 🟡 VISIBLE | Shown as a tag on the queue card. Single-line behavior in v1, but the tag is honest. |
| ETA display | 🟢 FULL | `people_ahead × avg_service_time`, fallback 3 min |

### Join Queue

| Feature | Tier | Notes |
|---|---|---|
| Remote join (from anywhere) | 🟢 FULL | The headline feature |
| On-site join indicator | 🟡 VISIBLE | "I'm at the venue" toggle on the join form — sets `join_method: walk_in`. No actual geofencing. |
| Get ticket number + position + ETA on join | 🟢 FULL | Confirmation screen |

### Live Queue Tracking

| Feature | Tier | Notes |
|---|---|---|
| Current serving number (live) | 🟢 FULL | Updates the moment admin clicks Next |
| Your position updates dynamically | 🟢 FULL | The money shot |
| "X people ahead of you" | 🟢 FULL | Big readable number |
| Queue movement animation | 🟡 VISIBLE | CSS transition on the position number when it changes. Subtle, not gimmicky. |
| Crowd control status display | 🟢 FULL | Same crowd badge as discovery, kept visible on ticket page |
| Smart ETA (updates dynamically) | 🟢 FULL | Re-derives from formula on every RTDB update |
| "You are next" notification | 🟢 FULL | In-app banner + sound when position = 1. (Not FCM push — that's a separate 3hr swamp.) |

### QR Check-in

| Feature | Tier | Notes |
|---|---|---|
| User has a QR code on their ticket | 🟢 FULL | `qrcode.react` — encodes the user's pushKey |
| Scan QR at location to verify arrival | 🟡 VISIBLE | "I'm here" button on the ticket page that simulates the scan result. Real camera scanning is a separate scope creep — only build if you're ahead at hour 16. |

### Rejoin / Missed Turn Recovery

| Feature | Tier | Notes |
|---|---|---|
| Missed turn → moves to back of line | 🟢 FULL | When admin clicks Skip, customer's UI shows "You missed your turn. Rejoin?" with a Rejoin button that re-inserts with new timestamp. |

---

## Counting It Up

- **🟢 FULL: 14 features**
- **🟡 VISIBLE: 5 features**
- **🔵 STUB: 1 feature**

That's full brief coverage on the user side. Admin side gets a minimum-viable control panel (4 hours total) just so you can drive the demo from another tab.

---

## Hour-by-Hour

### Hours 0-2: Setup + Foundation

- [ ] `npm create vite@latest linea -- --template react-ts`
- [ ] Install: `firebase react-router-dom zustand recharts qrcode.react`
- [ ] Tailwind setup
- [ ] Firebase project: enable RTDB (asia-southeast1) + Anonymous Auth. Permissive rules for now.
- [ ] `src/types/linea.ts` — TypeScript types matching the RTDB schema
- [ ] `src/lib/firebase.ts` — init
- [ ] `src/lib/paths.ts` — path builders (`queuesPublic(id)`, `queueUser(qid, uid)`, etc.)
- [ ] `src/lib/formulas.ts` — pure functions:
  ```ts
  export const computeCrowdScore = (waiting: number, capacity: number) =>
    Math.min(waiting / capacity, 1.0);

  export const computeCrowdLevel = (score: number, thresholds: CrowdThresholds) =>
    score <= thresholds.low ? "low" :
    score <= thresholds.moderate ? "moderate" : "high";

  export const computeETA = (peopleAhead: number, avgServiceTime: number) =>
    peopleAhead * (avgServiceTime || 180); // 3 min fallback
  ```
- [ ] `src/hooks/useRtdbValue.ts` — generic `onValue` listener hook

**Checkpoint hour 2:** App boots. Console writes/reads from RTDB. Types compile.

### Hours 2-4: Seed Data + Shared Components

- [ ] `scripts/seed.ts` (Node, run with `tsx`): seed 3 establishments (LGU window, salon, pharmacy), 4 queues, 6-10 users at various statuses across queues. Include realistic `usual_range` field per queue for crowd surge stub.
- [ ] Run seed. Verify in Firebase console.
- [ ] Shared components in `src/components/`:
  - `CrowdLevelBadge` — green/yellow/red pill, takes a score, renders label
  - `QueueStatusBadge` — active/paused/closed
  - `ETADisplay` — formats "~12 min" from seconds
  - `PriorityBadge` — senior/PWD/pregnant (used on tickets later)
  - `WeatherBanner` — icon + label, accepts `sunny | rainy | cloudy`
  - `Button`, `Card`, `Stat` — Tailwind primitives

**Checkpoint hour 4:** Components render in isolation with seeded data visible.

### Hours 4-6: Queue Discovery Page

The home page. Where every demo starts.

- [ ] Route: `/`
- [ ] Subscribe to `/queues_public`
- [ ] Layout: weather banner at top, filter chips (LGU/salon/pharmacy/bank), queue card grid
- [ ] Each card shows:
  - Establishment name + type icon
  - Queue name
  - 🟢 `CrowdLevelBadge` (the visual hook)
  - 🟢 Waiting count + currently serving + next-in-line (three small stats)
  - 🟢 `ETADisplay`
  - 🟢 `QueueStatusBadge`
  - 🟡 Service type tag ("Regular" / "Priority Lane")
  - CTA button — disabled when status = paused/closed
  - **If crowd_level = "high":** CTA shows "Walk-in disabled — Join Remotely"
- [ ] Weather banner: fetch OpenWeatherMap once on page load, cache in Zustand, render contextual message
  - sunny → "Good time to go ☀️"
  - rainy → "Expect delays — heavy traffic possible 🌧️"
  - cloudy → "Mild conditions 🌥️"

**Checkpoint hour 6:** Home page looks polished. All queues display correctly. Status badges update when you manually flip a queue's status in Firebase console.

### Hours 6-8: Queue Detail + Crowd Surge

- [ ] Route: `/queue/:id`
- [ ] Subscribe to `/queues_public/{id}` + `/queues_private/{id}/users` (for queue length breakdown)
- [ ] Sections on this page:
  - Queue header (name, establishment, status)
  - Big `CrowdLevelBadge` + crowd_score visual (e.g. a progress bar)
  - Queue length breakdown card: "12 waiting · 1 serving · #042 next"
  - ETA card
  - 🔵 **Crowd surge widget:**
    ```
    Right now: 18 people · ~54 min wait
    Usual at this time: 12-22 (normal range)
    Lighter at 2:00 PM: ~5 people · ~15 min
    ```
    The "usual" and "lighter" values come from a hardcoded `usual_pattern` field in the seed data per queue. It's a stub — but a credible-looking one.
  - Service type display
  - "Join Queue" CTA → `/queue/:id/join`

**Checkpoint hour 8:** A user can browse queues and drill into one. Every visible number is real (pulled from RTDB) except the "usual" comparison which is seeded.

### Hours 8-10: Join Flow

- [ ] Route: `/queue/:id/join`
- [ ] Form:
  - Name (required)
  - Phone (optional)
  - Priority dropdown: none / senior / PWD / pregnant
  - "I'm at the venue (on-site)" toggle → sets `join_method`
  - If queue's `allow_remote_join` is false AND toggle is off → form is blocked with explanation
- [ ] Submit logic:
  1. Anonymous Firebase sign-in if not yet signed in
  2. `transaction()` on `/queues_private/{id}/current_ticket_number` to atomically increment
  3. Write user object to `/queues_private/{id}/users/{pushKey}` with `ServerValue.TIMESTAMP`
  4. Mirror to `/user_tickets/{uid}/{pushKey}` (denormalized for fast home read)
  5. Append event to `/queues_private/{id}/events`
  6. Update `live_state.total_waiting` and recompute `crowd_score` + `crowd_level`
  7. Redirect to `/ticket/{pushKey}`
- [ ] Confirmation toast: "You're in! Ticket A042"

**Checkpoint hour 10:** A user can fill the form, join, and see their ticket page load. Open another tab — they should appear in the queue.

### Hours 10-14: The Live Ticket Page (THE MONEY SHOT)

This is where you spend your best attention. The whole demo lives or dies here.

- [ ] Route: `/ticket/:pushKey` (also accessible via `/queue/:qid/ticket/:pushKey`)
- [ ] Subscribe to:
  - `/queues_private/{queueId}/users/{pushKey}` (the user's own node)
  - `/queues_private/{queueId}/users` (full list, to compute position)
  - `/queues_public/{queueId}/live_state` (for serving number, crowd state)
- [ ] Compute on every update:
  ```
  position = count of users where:
    status == "waiting" AND
    (
      (is_priority(me) && joined_at < me.joined_at) ||
      (!is_priority(me) && is_priority(them)) ||
      (same priority class && joined_at < me.joined_at)
    )
  eta = position * avg_service_time
  ```
  Move this to a `usePosition` hook so the page just reads two numbers.
- [ ] Visual layout (top to bottom):
  - Big ticket number ("A042") — huge, takes center stage
  - `QRCode` from `qrcode.react`, encoding the pushKey, with caption "Show this at the venue"
  - **Live position display** — "3 people ahead of you" with CSS transition on number change
  - **ETA countdown** — recomputes on every queue change
  - **Crowd badge** — same component as elsewhere, kept visible
  - **Status timeline** — Joined → Called → Serving → Done, current step highlighted
  - **"YOU ARE NEXT" banner** — fullscreen-ish overlay or large banner that appears when `position === 1`. Pulses. Plays a short beep (Web Audio API tone or a small .mp3).
  - "I'm here" button (🟡 mock QR check-in) — when tapped, updates `join_method` to confirm presence
  - "Leave queue" button — sets status to `cancelled`, removes from `user_tickets`
- [ ] **Missed turn recovery:** when status changes to `skipped`, the page swaps to a "You missed your turn" view with two buttons:
  - **Rejoin at back** — creates new user entry with current timestamp, old one stays cancelled
  - **I'm here now** — flips status back to `waiting` (admin can decide to honor it)

**Checkpoint hour 14:** Open the ticket page in one tab, the admin panel (built next) in another. Click Next in admin, watch position decrement in ticket. Click again. When position hits 1, banner fires. This is your demo. Don't move on until this is smooth.

### Hours 14-18: Minimal Admin Panel (just enough to drive the demo)

You said user-only, but you need *some* admin UI to demo the live updates. Build the absolute minimum.

- [ ] Route: `/admin/:queueId` (no auth, just open access for demo)
- [ ] Single page with:
  - Big "Now Serving: A041" display
  - Three buttons: **Next** / **Skip** / **Recall**
    - Next: advance to first waiting user (priority first), update statuses, increment counters
    - Skip: current serving → `skipped`, advance
    - Recall: most recent skipped → `waiting` with position 1
  - Pause / Resume toggle
  - Live list of waiting users (just shows ticket number, name, priority badge, time waited)
- [ ] No styling polish needed — this is your demo control panel. It should work, not impress.

**Checkpoint hour 18:** You can run the whole user journey solo: open `/` in one tab as customer, `/admin/:id` in another, drive the demo from the admin side.

### Hours 18-21: Polish Pass (User-Side Only)

Resist adding features. Make what's built look great.

- [ ] **Mobile responsive** — test in Chrome DevTools at 375px width. Fix the worst breakages on home, queue detail, ticket page.
- [ ] **The "YOU ARE NEXT" moment** — make it dramatic. Big text, pulse animation, color flash, sound. Judges will remember this single moment more than any other.
- [ ] **Position change animation** — CSS transition on the number when it decrements. Even a subtle scale + fade looks pro.
- [ ] **Empty states** — "No queues available right now", "You're not in any queues yet"
- [ ] **Loading skeletons** — at least on home page card grid and ticket page
- [ ] **Typography pass** — one font, consistent sizing, clear hierarchy
- [ ] **One accent color** — pick something distinctive (not default blue). Use it on CTAs and the crowd-level badges.
- [ ] **Logo** — even a text logo in a distinctive font works
- [ ] **Hero copy** — one line on the home page that explains what Linea is

### Hours 21-23: Deploy + Real Device Test

- [ ] `firebase deploy --only hosting`
- [ ] Open production URL on your phone. Test the full user journey on mobile.
- [ ] Test the two-window demo on production (not localhost — wifi gets weird at venues).
- [ ] If RTDB anonymous auth fails on production, debug now.
- [ ] Re-seed clean demo data so demo starts from a known state.

### Hours 23-24: Demo Prep

- [ ] **Demo script (90 sec), rehearse 3x:**
  1. *"Linea — real-time queue and crowd coordination for Philippine retail."* (5s)
  2. Home page. *"Crowd level is queue length over capacity. This salon is moderate, ETA 12 min. Notice the weather banner — sunny, good time to go."* (15s)
  3. Tap a queue. *"Here's the breakdown — 12 waiting, 1 serving, A042 next. The 'usual at this time' helps users decide when to go."* (15s)
  4. Tap Join. Fill form. *"I'm joining remotely from home. Senior priority enabled."* Get ticket. (15s)
  5. Switch to admin tab. *"The staff sees me here."* Click Next. (5s)
  6. Switch back. *"Position just updated live. ETA recalculated. No refresh."* (10s)
  7. Switch to admin, click Next until customer's position = 1. (10s)
  8. *"Your turn."* The banner fires. Sound plays. (5s)
  9. *"And if I missed it — rejoin at the back. Schema runs on Firebase RTDB. Formulas are open: ETA = people ahead times service time, crowd score = length over capacity, clamped."* (10s)
- [ ] **Record a backup video.** If venue wifi dies, this is your insurance.
- [ ] Sleep if any time remains.

---

## What Each Brief Feature Maps To

Cross-reference for "did I cover everything":

| Brief feature | Where it lives |
|---|---|
| Browse queues + see open/paused/near-capacity | Home page (h4-6) |
| Crowd level (low/mod/high) | Badge component, home + detail + ticket |
| Walk-in disabled at high crowd | Conditional CTA on cards (h4-6) |
| ETA = people_ahead × avg_service_time | `formulas.ts`, displayed everywhere |
| Queue length breakdown (waiting/serving/next) | Three stats on cards + detail page (h6-8) |
| Service type per station | Tag on queue cards (visible, single-line in v1) |
| Remote queue join | Join form, default behavior (h8-10) |
| On-site join | Toggle on join form (h8-10) |
| Get ticket + position + ETA | Confirmation + ticket page (h10-14) |
| Current serving number live | Ticket page (h10-14) |
| Position updates dynamically | `usePosition` hook (h10-14) |
| "X people ahead" | Ticket page main display |
| Queue movement animation | CSS transition (h18-21) |
| Crowd control status | Crowd badge persistent on ticket |
| Smart ETA, updates live | Recomputed on every RTDB tick |
| "You are next" notification | In-app banner + sound (h10-14, polished h18-21) |
| QR check-in | QR displayed on ticket; "I'm here" mock button (h10-14) |
| Rejoin / missed turn | Status = skipped → recovery view (h10-14) |
| Weather context | `WeatherBanner` (h4-6) |
| Crowd surge detection | Stub on queue detail page (h6-8) |

That's all 19 user-side items from the brief.

---

## Hard Rules

1. **Hour 14 is the make-or-break checkpoint.** If the customer/admin live sync isn't working at hour 14, drop everything else and fix it. Without it, nothing else matters.
2. **Don't build admin features beyond Next/Skip/Recall/Pause.** It's tempting because admin is "easy." It's not the demo.
3. **Don't add features past hour 18.** Polish only. New features at hour 19 break working features at hour 22.
4. **Test on production, on a phone, before hour 22.** Localhost demos lie to you about what works.
5. **The "YOU ARE NEXT" moment must be dramatic.** That's the screenshot judges remember. Spend extra time on it during the polish pass.

---

## If You're Behind Schedule

- **Hour 10 and join flow isn't done:** skip the priority dropdown for now. Add it back in polish.
- **Hour 14 and ticket page sync is buggy:** drop everything else. This is the demo.
- **Hour 18 and admin panel isn't built:** build a 30-line component with three buttons. Skip styling entirely.
- **Hour 21 and not deployed:** deploy broken. Fix on production.
- **Hour 23 and "YOU ARE NEXT" is plain:** add CSS scale + a color flash. 10 minutes of work, big payoff.
