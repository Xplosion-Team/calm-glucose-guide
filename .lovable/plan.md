# Engagement & Logging Upgrade Plan

A bundle of related features that turn the Today tab into a full multi-modal logging system, add proactive SMS check-ins during the trial, give users a clear "Training" path, and make the journal easy to browse.

---

## 1. Multi-modal LLM Logging (photo + text + voice)

Today already has a camera button calling the `analyze-food` edge function. Extend it so a single AI flow handles **photo, free text, and voice**.

### UI changes (TodayTab)
- Replace the single "Camera" tile with a **Smart Log** card that has three input modes:
  - 📷 **Photo** (existing flow)
  - ✍️ **Describe** — text input ("a bowl of oatmeal with banana")
  - 🎤 **Voice** — push-to-talk; uses browser `MediaRecorder` + sends audio to a new edge function for transcription, then to the LLM
- All three modes return the same structured AI result card (food name, carbs, portion, category) which the user can edit before confirming.

### Edge functions
- **Extend `analyze-food`** to accept `{ imageBase64?, text?, lang }` — same tool-calling response shape. If only text, skip vision input.
- **New `transcribe-audio`** function: accepts base64 audio, calls Lovable AI gateway with an audio-capable model (Gemini 2.5 Flash supports audio input) to return a transcript. Frontend then passes the transcript to `analyze-food` as `text`.

### Translations
- Keys for "Describe what you ate", "Tap to speak", "Listening…", "Transcribing…", mode labels.

---

## 2. SMS Check-ins During Trial (proactive engagement)

Send positive-tone SMS messages via Twilio (already connected via `send-otp` infra) when a trial user hasn't logged anything in the last 36 hours, plus a daily 10am nudge if no log yet.

### Database (new tables)
- **`user_engagement`** — `user_id`, `trial_start`, `trial_tier` ('A' | 'B' | 'C'), `phone`, `timezone`, `last_log_at`, `total_meals_logged`, `last_checkin_sent_at`
- **`food_logs`** — persist the entries that are currently local-only: `user_id`, `type`, `label`, `carbs_grams`, `portion_size`, `logged_at`, `source` ('photo' | 'text' | 'voice' | 'sms')
- RLS: users see only their own rows; service role can read all (for cron).

### Edge functions
- **`send-checkin-sms`** (cron, runs hourly): finds trial users where `now() - last_log_at > 36h` OR (it's ~10am local and no log today). Sends one warm SMS per user max per 24h. Uses Twilio gateway.
- **`sms-inbound`** (public, no JWT): Twilio webhook for incoming SMS. Parses message body, runs through `analyze-food` text mode, inserts into `food_logs`, and replies with a confirmation SMS ("Got it — oatmeal logged ✨").

### Cron
- `pg_cron` job invoking `send-checkin-sms` every hour.

### Trial tiers (A / B / C)
Stored on `user_engagement.trial_tier`. Default to **C** (10 meals total). Drives the **Training** progress (section 3) and how aggressive the nudges are:
- **A**: nudge if no log today
- **B**: nudge every other day
- **C**: nudge until 10 meals logged

Copy is always positive ("How about a quick photo of breakfast? 🌱"). Never clinical.

---

## 3. "Training" Section in Journey Tab

Add a **Training** card at the top of `JourneyTab` showing what the user needs to do during their trial. Two tracks: **Nutrition** and **Medication**.

- Progress bars per track based on `food_logs` counts and (future) med-log counts
- Tier-aware target ("Log 10 meals during your trial" for C; "Log every day" for A; "Log every other day" for B)
- Checklist items: "Log your first meal", "Try a photo log", "Try a voice log", "Log a medication"
- Friendly tone, completion celebrates with a sparkle animation

---

## 4. Portion-Size Visual Guide

A new lightweight reference component used in two places:

- Inline in the AI result card (next to the portion chip, "?" icon opens it)
- Standalone link in the Training section ("See portion examples")

Shows three illustrated cards (small / medium / large) with example foods and approximate carb ranges. Uses generated illustrations (`imagegen`) saved to `src/assets/portions/` so it works offline and stays on-brand. Kept non-clinical — "about a fist", "about a plate", etc.

---

## 5. Enhanced Journal / Diary Review

Today's log only shows entries from the current session. Build a real journal view:

- New **Journal** sub-section accessible from `TodayTab` ("View past days") and from `JourneyTab`
- Component `JournalView` queries `food_logs` grouped by day
- Per-day expandable card with: total meals, total carbs, list of entries with time + source icon (📷/✍️/🎤/💬)
- Search box to filter by food name
- Date jump (last 7 days quick chips, plus a date picker)
- Tap any entry to see details and (optional) edit/delete

---

## Technical Details

### New files
- `supabase/functions/transcribe-audio/index.ts`
- `supabase/functions/send-checkin-sms/index.ts`
- `supabase/functions/sms-inbound/index.ts`
- `src/components/today/SmartLogCard.tsx` (replaces inline camera button block)
- `src/components/today/PortionGuide.tsx`
- `src/components/journal/JournalView.tsx`
- `src/components/journey/TrainingCard.tsx`
- `src/hooks/useFoodLogs.ts` (replace local state with Supabase-backed hook)
- `src/assets/portions/{small,medium,large}.jpg` (generated)

### Edited files
- `supabase/functions/analyze-food/index.ts` — accept text-only input
- `src/components/tabs/TodayTab.tsx` — use SmartLogCard + useFoodLogs
- `src/components/tabs/JourneyTab.tsx` — insert TrainingCard
- `src/i18n/translations.ts` — new keys (EN + ES)
- `supabase/config.toml` — `verify_jwt = false` for `sms-inbound`

### Migrations
- Create `food_logs` and `user_engagement` tables with RLS
- Add `pg_cron` + `pg_net` extensions and the hourly cron job (via `supabase--insert` since it embeds project URL + anon key)

### Secrets
All needed secrets are already configured: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `LOVABLE_API_KEY`.

### Twilio inbound webhook
After deploy, user pastes the `sms-inbound` function URL into the Twilio phone number's "A message comes in" webhook. I'll surface that URL in chat after deploy.

---

## Scope Notes & Open Questions

This is a **large** bundle. I'd suggest shipping in two passes:

1. **Pass 1 (this turn):** sections 1, 3, 4, 5 — all client + `analyze-food` extension + `food_logs` table + portion illustrations.
2. **Pass 2 (next turn):** sections 2's SMS pieces (cron, inbound webhook, tier logic) — needs Twilio webhook config from you.

Confirm or tell me to do everything in one shot.
