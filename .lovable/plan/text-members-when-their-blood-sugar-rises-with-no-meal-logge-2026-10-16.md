# Text members when their blood sugar rises with no meal logged

## Goal

When a member's sensor shows a rise and no meal is logged around that time, add a text to the queue: "Your glucose started rising around 12:40 PM. Did you eat something? Text me what you had." When they reply, the meal is saved at the time the rise started, so it lines up with the spike.

## Two ways of matching

1. **Real time (while it's happening)**
  - Every 10 minutes the app already checks new sensor readings. It adds a check for rises of about 15+ points within 2 hours that have no meal logged from 90 minutes before to 60 minutes after the rise started.
  - Wait about 30 minutes after the rise starts before texting, so a meal the member is about to log doesn't trigger a text.
2. **After the fact (sensor data that arrives late)**
  - Sensor readings sometimes sync hours late. The same check also scans the last 12 hours, so rises that were missed get matched too.
  - Rises older than 3 hours are not texted one by one. They go into one evening summary text: "I noticed 2 rises today without a meal logged — around 12:40 PM and 5:10 PM. Reply with what you ate, like '12:40 salmon and rice'."
  - These rises also show as "Did you eat something?" cards in the app (already built), so members can tap a card and log the meal.

## Text rules

- Quiet hours (9 PM–8 AM local) and the member's text opt-out are respected. No texts while a meal is already waiting for a YES.
- At most 3 rise texts per day, and at least 2 hours between them.
- Written in the member's chosen persona and voice, using the existing safe nudge writer. No numbers that sound like medical advice, and the wording is about logging, not diagnosis.
- If the member logs a meal for that time in the app before the text goes out, the text is cancelled.

## Handling the reply

- A reply to a rise text ("salmon and rice") becomes a meal draft with the eating time set to the rise start (marked as a glucose rise estimate). They get the normal "Got it… Reply YES to save" text.
- "No" or "nothing" marks the rise as "didn't eat", and it won't be asked about again.
- An evening summary reply with times ("12:40 salmon") is matched to the nearest rise.
- Everything is recorded in the Message log, and approvals count in the Admin tab as usual.

## What you'll see

- On Today, a rise card changes from "Did you eat something?" to "Texted 12:55 PM" and then to the meal once the member confirms it.
- In Admin, a new count: rises texted, rises answered, and meals saved from rise texts.

## Technical details

- Extend `spike_events` with `kind` ('post_meal' | 'unlogged'), `rise_start_at`, `status` ('queued','sent','answered','no_meal','cancelled','expired'), `sms_sent_at`, `digest_date`; unique on (user_id, rise_start_at) so a rise is queued once.
- Shared pure detector in `supabase/functions/_shared/riseDetect.ts` (same rules as `src/lib/meal-glucose.ts`), unit tested in Deno.
- Extend the 10-minute `send-meal-reminders` run to: detect → queue → cancel if a meal now covers the rise → send due real-time texts via `sendSms` + persona generator; evening digest at 7 PM local, in the same job.
- `sms-inbound`: before routing as a new meal, check for a 'sent' unlogged rise within 6 hours; create the draft with `eaten_at = rise_start_at`, `eaten_at_source = 'glucose_rise'`, and link it back to the spike. Handle "no"/"nothing" and digest times. Extend `index_test.ts`.
- `admin_sms_approval_stats` gains rise counters; `MealsAndRises` reads spike status for the "Texted" label.
- Tests: detector thresholds, the 30-min wait, daily cap/spacing, cancellation when a meal is logged, reply → draft with rise time.