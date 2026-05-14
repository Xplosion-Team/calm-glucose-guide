# Calm Glucose T2D — Clinical Trial Builder Spec

Pivot from the current Type 1-flavored "what if" simulator to a **Type 2 diabetes postprandial prediction trial app**. One primary model: a **personalized metabolic digital twin** that predicts 2–4h glucose response after a logged meal, using CGM + meal + meds + Apple Health context. No CGMformer. No T1D insulin-bolus physiology.

---

## 1. Product Principles

- Calm, reassuring, senior-friendly (keep current sage palette + 18px base).
- Meal logging in <15 seconds (photo / text / voice → already built in `SmartLogCard`).
- One chart: observed CGM trace + predicted postprandial overlay + confidence band.
- Plain-English insight ("This lunch is likely to peak around 175 mg/dL near 1:30pm and settle by 3pm.").
- Trial-safe: never recommends insulin doses, never overrides clinician guidance, always surfaces "share with your care team."
- Everything written to the DB is **versioned + auditable** (model_version, input_hash, prediction_id).

---

## 2. App Structure

```text
apps/
  patient/                 # existing Vite/React app, repurposed
    /onboarding            # consent, demographics, CGM connect, Apple Health, meds
    /today                 # current glucose + quick log + last prediction
    /log                   # SmartLogCard (photo/text/voice) — already built
    /predict/:mealId       # 2-4h forecast chart + plain-English insight
    /journal               # past meals + observed vs predicted (already scaffolded)
    /trial                 # protocol tasks, reminders, adherence streak
    /settings              # meds, devices, language, withdraw consent
  clinician/               # NEW Next.js subroute (or /clinician under same app)
    /cohort                # patient list, adherence %, alerts
    /patient/:id           # CGM timeline, predictions vs observed, meds, notes
    /trial-metrics         # MARD, prediction error distribution, TIR delta
    /audit                 # immutable audit log viewer
services/
  edge-functions/          # Supabase edge fns (auth-light glue)
    analyze-food           # already exists
    transcribe-audio       # already exists
    predict-meal           # NEW: proxies to model service, writes prediction row
    ingest-cgm             # NEW: Dexcom/Apple Health → cgm_readings
    trial-events           # consent, adherence, audit writes
    clinician-export       # CSV/JSON export for trial team
  model-service/           # NEW Python (FastAPI) — personalized T2D twin
    /v1/predict/postprandial
    /v1/twin/calibrate
    /v1/twin/{patient_id}/state
    /healthz
```

Replace the current `DigitalTwinDashboard` "What if I…" Type 1 flow with a **Postprandial Forecast** view bound to a meal log entry.

---

## 3. Key Screens

### Patient
1. **Onboarding** — eConsent (PDF + signature), demographics, T2D confirmation, meds (class + dose + schedule), CGM pairing (Dexcom already wired), Apple Health permissions, baseline questionnaire.
2. **Today** — current CGM value, time-in-range today, "Log a meal" CTA, last prediction card.
3. **Quick Log** — already built (`SmartLogCard`): photo/text/voice → carbs, optional fat/protein/fiber editable.
4. **Postprandial Forecast** — overlay chart (observed CGM solid line + predicted dashed + 80% CI band), peak value, time-to-peak, estimated TIR impact, one-sentence insight, "How sure are we?" confidence chip.
5. **Journal** — already built; add observed-vs-predicted mini-sparkline per meal.
6. **Trial** — today's protocol tasks (e.g., "Log breakfast", "Wear CGM"), weekly adherence ring, upcoming visit, message clinician.
7. **Settings** — meds, devices, language, export my data, withdraw.

### Clinician
1. **Cohort** — table: patient ID, arm, adherence %, last sync, alerts.
2. **Patient detail** — 14-day CGM, meal markers, prediction-vs-observed scatter, MARD, meds timeline, notes.
3. **Trial metrics** — enrollment funnel, dropout, prediction MAE/MARD, TIR delta vs baseline, model_version breakdown.
4. **Audit log** — append-only viewer with filters (actor, action, patient, date).

---

## 4. Backend Services

| Service | Runtime | Purpose |
|---|---|---|
| Supabase (Lovable Cloud) | managed | Auth, Postgres, RLS, storage, cron, edge fns |
| `predict-meal` edge fn | Deno | Auth check → call model service → persist `predictions` row |
| `ingest-cgm` edge fn | Deno | Pull Dexcom/Apple Health on schedule, normalize to `cgm_readings` |
| `trial-events` edge fn | Deno | Consent, adherence ticks, audit writes |
| Model service | Python 3.11 + FastAPI | Personalized T2D digital twin; stateless API, state in Postgres |
| Worker (cron) | pg_cron + edge fn | Nightly twin recalibration per patient, adherence rollups |

Model service is the only place model code lives. Edge fns are thin. Frontend never calls the model directly.

---

## 5. Database Schema (Postgres / Supabase)

All tables RLS-enabled. Patient tables: `auth.uid() = user_id`. Clinician access via `has_role(auth.uid(),'clinician')` + `trial_assignments` join. Audit + predictions are append-only (no UPDATE/DELETE policies for patients).

```sql
-- Identity & trial
profiles(user_id, display_name, dob, sex, ...)               -- exists
trial_enrollments(id, user_id, trial_id, arm, status, consented_at, withdrawn_at)
consents(id, user_id, version, signed_at, pdf_url, signature_hash)

-- Devices & context
devices(id, user_id, kind /*dexcom|apple_health*/, connected_at, last_sync_at)
cgm_readings(id, user_id, ts, mg_dl, trend, source)          -- partition by month
activity_samples(id, user_id, ts_start, ts_end, kind, value, unit, source)
sleep_samples(id, user_id, ts_start, ts_end, stage, source)
heart_rate_samples(id, user_id, ts, bpm, source)
weight_samples(id, user_id, ts, kg, source)

-- Meds
medications(id, user_id, class /*metformin|sglt2|glp1|dpp4|su|tzd|basal_insulin|...*/,
            name, dose, unit, schedule_cron, started_at, stopped_at)
medication_events(id, user_id, medication_id, taken_at, dose, source)

-- Meals (extends current food_logs)
meal_logs(id, user_id, logged_at, label, carbs_g, fat_g, protein_g, fiber_g,
          portion_size, source /*photo|text|voice|manual|sms*/, image_url, raw_ai jsonb)

-- Predictions (append-only, versioned)
predictions(id, user_id, meal_log_id, requested_at, model_version, input_hash,
            horizon_min, peak_mg_dl, time_to_peak_min, tir_delta_pct,
            confidence, curve jsonb /* [{t_min,mg_dl,lo,hi}] */,
            insight_text, inputs_snapshot jsonb)
prediction_outcomes(id, prediction_id, observed_curve jsonb, mard, mae, computed_at)

-- Twin state
twin_states(id, user_id, model_version, params jsonb, fit_metrics jsonb,
            calibrated_at, n_samples)

-- Trial ops
protocol_tasks(id, trial_id, key, title, schedule)
task_completions(id, user_id, task_key, completed_at)
adherence_daily(user_id, day, meals_logged, cgm_pct, tasks_done, score)
clinician_notes(id, clinician_id, user_id, body, created_at)
audit_log(id, ts, actor_id, actor_role, action, entity, entity_id, diff jsonb)
```

Reuse existing `food_logs` → migrate into `meal_logs` (additive columns + view for back-compat).

---

## 6. API Endpoints

### Patient-facing (Supabase edge fns, JWT-required)
- `POST /functions/v1/predict-meal` `{ meal_log_id }` → `{ prediction_id, curve, peak, ttp, tir_delta, confidence, insight }`
- `POST /functions/v1/ingest-cgm` `{ source, samples[] }`
- `POST /functions/v1/trial-events` `{ kind, payload }` (consent, task_complete, withdraw)
- `GET  /functions/v1/clinician-export?patient_id=...` (clinician role only)

### Model service (internal, mTLS / shared secret)
- `POST /v1/predict/postprandial` — see schema below
- `POST /v1/twin/calibrate` `{ patient_id, window_days }` → new `twin_states` row
- `GET  /v1/twin/{patient_id}/state` → current params + fit metrics
- `GET  /healthz`

---

## 7. Model Design — Personalized T2D Postprandial Twin

**One model.** A personalized metabolic digital twin (compartmental glucose–insulin–incretin model adapted for T2D, with patient-specific parameters fit from CGM + meal history). No CGMformer. No T1D bolus simulator.

### Approach
- **Base structure**: reduced Dalla Man-style oral glucose minimal model adapted for T2D — removes exogenous insulin bolus compartment, adds:
  - reduced β-cell responsivity (Φ) parameter
  - hepatic insulin resistance (R_H)
  - peripheral insulin sensitivity (S_I)
  - GLP-1 / SGLT2 / metformin effect modifiers (multiplicative on relevant compartments, only when patient is on that med class)
- **Personalization**: per-patient parameter vector fit nightly via Bayesian update (e.g., particle filter or MAP with Gaussian prior) from last 14–28 days of (meal, CGM response) pairs.
- **Inference**: ODE-integrated forward 2–4h after meal; uncertainty band from posterior parameter samples (50–200 draws).
- **Versioning**: every parameter set is a `twin_states` row; every prediction stores `model_version` + `input_hash` + `inputs_snapshot`.

### Input schema
```json
{
  "patient_id": "uuid",
  "meal": {
    "logged_at": "iso8601",
    "carbs_g": 60, "fat_g": 18, "protein_g": 25, "fiber_g": 6
  },
  "cgm_recent": [{"ts":"...","mg_dl":118}, ...],   // last 3h, 5-min cadence
  "current_glucose_mg_dl": 122,
  "context": {
    "activity_last_60min": {"steps": 420, "active_minutes": 8, "avg_hr": 88},
    "sleep_last_night":   {"duration_min": 410, "efficiency": 0.86},
    "heart_rate_now":     74,
    "weight_trend_kg_30d": -0.6
  },
  "medications_active": [
    {"class":"metformin","dose_mg":1000,"taken_at":"...","hours_since":2.1},
    {"class":"glp1","dose_mg":1.0,"taken_at":"...","hours_since":36}
  ],
  "horizon_min": 240,
  "twin_version": "twin-2026.05.1"
}
```

### Output schema
```json
{
  "prediction_id": "uuid",
  "model_version": "twin-2026.05.1",
  "horizon_min": 240,
  "curve": [{"t_min":0,"mg_dl":122,"lo":118,"hi":126}, ...],   // every 5 min
  "peak_mg_dl": 178,
  "time_to_peak_min": 65,
  "tir_delta_pct": -4.2,
  "confidence": 0.78,
  "insight_text": "This lunch is likely to peak around 178 in about an hour and come back near your range by 3pm.",
  "inputs_hash": "sha256:..."
}
```

### Safety
- Never returns dose recommendations.
- If confidence < threshold or inputs incomplete → returns insight with "we don't have enough data yet — share with your care team if unsure."
- Hard guardrails: no advice when glucose < 70 or > 300; instead surface "contact care team."

---

## 8. Apple Health & CGM

- **CGM (Dexcom)**: already wired; extend to write into `cgm_readings` continuously.
- **Apple Health**: context only. Activity, sleep, HR, weight pulled via existing `useHealthKit`; written to context tables on a schedule. Never used as the intervention surface.

---

## 9. Trial Workflows

- **Consent**: signed PDF + hash stored in `consents`; required before any prediction call.
- **Adherence**: `adherence_daily` rolled up nightly (meals logged, CGM coverage %, tasks done). Drives existing trial tier nudges (A/B/C SMS already built).
- **Reminders**: existing `send-checkin-sms` cron extended to honor protocol_tasks.
- **Clinician review**: read-only dashboards, notes append to `clinician_notes`, every read/write hits `audit_log`.
- **Audit**: trigger on insert/update for predictions, meds, consents, notes → `audit_log`.
- **Export**: `clinician-export` produces CSV/NDJSON snapshot tied to a `model_version` for regulatory review.

---

## 10. Phased Rollout

**Phase 0 — Repoint (1 week)**
- Remove T1D "What if" simulator UI and `WhatIfSimulator`, `simulation-engine`, `BrainQuery` Type-1 framing.
- Rename `DigitalTwinDashboard` → `PostprandialForecast`, bind to a `meal_log_id`.
- Add `meal_logs`, `predictions`, `twin_states`, `cgm_readings`, context tables (migrations).

**Phase 1 — Predict MVP (2 weeks)**
- Stand up Python model service with a **population baseline twin** (no personalization yet).
- `predict-meal` edge fn + Postprandial Forecast screen with overlay chart + insight.
- Persist predictions + inputs_snapshot + model_version.

**Phase 2 — Personalization (2–3 weeks)**
- Nightly per-patient calibration job → `twin_states`.
- Prediction service loads latest twin_state per patient.
- Compute `prediction_outcomes` (MARD/MAE) once observed CGM is in.

**Phase 3 — Clinical Trial Ops (2 weeks)**
- eConsent flow, protocol_tasks, adherence rollups, audit triggers.
- Clinician dashboard (cohort, patient detail, trial metrics, audit viewer).
- Role-based RLS (`clinician` role via `user_roles` table + `has_role()`).

**Phase 4 — Hardening & Submission (2 weeks)**
- Model versioning lock, export pipeline, retention policy, withdrawal flow.
- Penetration test, RLS review, PHI storage review (existing HIPAA arch in memory).
- IRB packet: model card, data dictionary, audit sample.

**Phase 5 — Pilot (ongoing)**
- 10–25 patient pilot, weekly MARD review, twin recalibration cadence tuning.

---

## 11. What Gets Removed

- `src/components/simulation/*` (T1D What-If)
- `src/lib/simulation-engine.ts`
- `BrainQuery` Type-1 framing in `src/components/twin/`
- Any insulin-bolus copy in `translations.ts`

## 12. What Gets Reused

- `SmartLogCard`, `analyze-food`, `transcribe-audio`, `JournalView`, `PortionGuide`
- Dexcom auth + token tables
- SMS check-ins + trial tiers (A/B/C)
- Sage palette, 18px typography, senior-first UX

---

Say **go** and I'll start Phase 0: migrations + remove T1D simulator + scaffold Postprandial Forecast screen + `predict-meal` edge fn calling a stub model service. Phases 1+ will follow.
