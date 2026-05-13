# Linea — Smart Queue & Errand Coordination App
> Product Specification Document

---

## Overview

Linea is a web-based queue and crowd coordination platform designed to improve the in-store waiting experience in retail environments such as malls, fast food chains, coffee shops, salons, pharmacies, and service counters.

Instead of traditional retail queues where customers physically line up without knowing how long they will wait, Linea provides:

- Real-time visibility of store crowd levels
- Estimated waiting times and queue status **before** customers decide to enter
- Remote queue joining and live position tracking
- Notifications when it's almost a customer's turn

On the business side, store staff and managers use a real-time dashboard to control queues, manage service flow per counter, prioritize customers, and monitor store crowd activity live.

> **Goal:** Transform retail waiting from a frustrating physical line into a smarter, faster, and more predictable customer flow experience.

---

## Core Data Logic

| Concept | Formula / Rule |
|---|---|
| **ETA** | `people_ahead × avg_service_time` |
| **Crowd Score** | `queue_length ÷ max_capacity` |
| **Queue Length** | Active users where `status = "waiting" OR "called"` |
| **People Ahead** | Position of user before current serving number |
| **Default Service Time** | 3 minutes (fallback if not configured) |

### Crowd Level Display Rules

| Score Range | Label | Behavior |
|---|---|---|
| 0.0 – 0.3 | 🟢 Low | Normal joining allowed |
| 0.3 – 0.7 | 🟡 Moderate | Normal joining allowed |
| 0.7+ | 🔴 High | Walk-in disabled; remote join only or "wait outside" |

---

## Context Features

### Weather Context
- Shows real-time weather at the store's location
- **Sunny** → "Good time to go"
- **Rainy** → "Expect delays / harder travel"
- **Cloudy** → Neutral condition
- ⚠️ Does **not** affect queue logic — only helps user decide *when* to go

### Crowd Surge Detection
Compares current queue size vs. usual queue size at the same time of day.

**Detection states:**
- 🔺 Crowd surge — higher than normal users for this time
- ✅ Normal crowd level — within expected range
- 🔽 Low crowd period — better time to go

**Example output:**
```
Right now: 41 people → ~33 min wait
Usual at this time: 35–45 people (busy period)
At 1:00 PM: 12 people → ~9 min wait
Best time to go: 1:00 PM today
```

---

## User Features

### Queue Discovery
- Browse available queue stations (businesses)
- See queue status: **Open**, **Paused**, **Near Capacity**
- View crowd level and ETA before joining

### Service Types (per Station)

| Type | Behavior |
|---|---|
| Regular Lane | 3–5 mins per user, FIFO order |
| Priority Lane | Overrides order for PWD, seniors, urgent cases |

Each station stores: `avg_service_time`, `service_type`

### Join Queue (Remote or On-site)
- Join without physically lining up
- Receive: queue number, position, and ETA upon joining

### Live Queue Tracking
- Current serving number (real-time)
- Dynamic position updates: *"X people ahead of you"*
- Queue movement animation
- Smart ETA display — updates as queue progresses

### QR Check-in (Arrival Verification)
- User scans QR code at the physical location
- Confirms physical presence
- Prevents queue abuse from remote no-show users

### Rejoin / Missed Turn Recovery
- If user misses their turn → moved to back of line
- Admin may allow re-queue at discretion

### Crowd Control Status Display
- Live indicator of crowd condition inside the store:
  - 🟢 Low Crowd
  - 🟡 Moderate Crowd
  - 🔴 High Crowd

---

## Admin Features

### Queue Station Management
- Create multiple queue stations (e.g., Counter 1, Counter 2, Priority Lane)
- Set service type per station: **Regular** or **Priority (PWD/Senior)**
- Configure average service time and cutoff time

### Live Queue Control Panel
Real-time operations available to staff:

| Action | Description |
|---|---|
| ➡️ Next | Advance to next customer |
| ⏭️ Skip | Skip current user |
| ↩️ Recall | Pull back previously served user |
| ⏸️ Pause | Pause queue (e.g., break time) |
| ▶️ Resume | Resume paused queue |
| 🔄 Auto Transfer | Move all waiting users to next active counter (keeps order) |

### Live Queue Monitoring Dashboard
- Current serving number
- Full queue list with status
- Waiting time per user
- Queue flow speed indicator

### Analytics Dashboard
- Average waiting time
- Peak hours chart
- Busiest hours by day/time

### Queue Configuration Settings
- Average service time per user
- Cutoff time
- Priority rules (PWD / Senior — optional toggle)

### Priority Handling System
- Mark users as priority manually
- Move users up the queue
- Separate priority lane management

### Pre-Queue Requirements Handling
User entry is tagged as:
- ✅ **Ready to Serve**
- ⚠️ **Needs Confirmation** (e.g., order not yet finalized, missing item selection)

---

## Emergency & Chaos Controls

### Instant Queue "Panic" Pause
- One-tap button to freeze **all** new entries (remote & on-site)
- Status: **Hard Stop**
- All waiting users are notified: *"Service is temporarily paused due to store capacity."*

### Capacity Flush
- Clears the "Now Serving" state when the queue list becomes too congested
- Allows admin to reset and restart flow cleanly

---

## Real-Time Sync

> All live features use **Supabase Realtime** for push-based updates without polling.

Key real-time events:
- Queue position changes (Next, Skip, Recall)
- Crowd level updates
- Pause / Resume broadcasts
- "You are next" notifications

---

## Deferred / Future Features

> ⚠️ Scope note: The following are good-to-have but should be deferred to v2 to avoid overbuilding early.

- Peak hour prediction (ML-based, needs historical data first)
- Automatic crowd surge detection algorithm
- Jeepney / LGU route integration
- Multi-branch analytics rollup
- SMS/push notification delivery (start with in-app only)

---

## Tech Stack (Recommended)

| Layer | Tool |
|---|---|
| Frontend | Next.js (App Router) |
| Backend / DB | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth |
| QR Code | `qrcode` npm package |
| Hosting | Vercel |

---

*Last updated: 2026 | Linea v1 Spec*
