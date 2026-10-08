# Nudge Persona & Voice Settings

## Goal

Let each signed-in member choose who reminders feel like they come from and the tone used for both in-app nudges and reminder SMS. Keep every message warm, accurate, short, and within the app’s health-safety boundaries.

## User experience

- Add a senior-friendly **Nudge Persona & Voice Settings** panel to Account.
- Persona choices:
  - Standard Guide (default)
  - Comedian
  - Spokesperson / Celebrity
  - Custom Persona
- For celebrity/custom choices, show large quick-select chips for the requested examples plus **Or type your own favorite persona…**.
- Tone choices:
  - Encouraging & Upbeat
  - Sarcastic & Witty
  - Direct / Tough Love
  - Calm & Mindful
- Show a live in-app sample so members can understand the selected style before saving.
- Add **Send Test SMS Nudge**. It sends only to the phone already linked to the signed-in account, then reports sent/failed clearly.
- Keep English and Spanish labels aligned with the app’s language switch.

## Message behavior

- Apply the saved persona and tone to:
  - post-meal in-app check-ins;
  - unexplained-rise in-app logging nudges;
  - post-meal SMS reminders;
  - inactive-user check-in SMS reminders;
  - the test SMS preview.
- Preserve required actions and facts verbatim in meaning: what prompted the nudge, what the member should log, and any YES/NO reply instruction.
- Keep transactional confirmations and audit wording unchanged; only nudges/reminders get persona styling.

## Safe personalization

- Use Lovable AI on the server to create short SMS copy from structured facts plus the saved persona and tone.
- Never send glucose thresholds, diagnoses, medication advice, dose/timing suggestions, insults, profanity, fear, shame, or coercion.
- Treat named public figures as high-level inspiration only: never claim the message is actually from them, reproduce signature catchphrases, or imitate them exactly.
- “Sarcastic” and “tough love” stay playful and respectful, especially for the senior audience.
- Validate AI output for length and required action. If generation is unavailable, use a safe tone-aware template so scheduled reminders are not lost.

## Data and access

- Extend each member’s existing private notification preferences with:
  - persona type;
  - optional persona name;
  - voice style.
- Keep Standard Guide plus Calm & Mindful as safe defaults for existing members.
- Preserve the existing owner-only access rules on notification preferences.
- Harden the test endpoint so a signed-in member cannot supply an arbitrary destination number; it resolves the member’s linked phone on the server.

## Technical implementation

- Add a database migration for the preference columns and validation constraints.
- Extend the notification preferences hook and settings UI with typed fields, immediate saving, loading, disabled, and success/error states.
- Add shared server-only persona prompt/validation and Lovable AI Gateway helpers using the Responses API, `openai/gpt-6-astra`, request-scoped run IDs, and required reasoning/store options.
- Update reminder functions to fetch persona preferences and pass structured reminder facts into the shared generator.
- Add a small shared frontend formatter so in-app banners use the same selected persona/tone without exposing prompts or model calls in the browser.
- Record the shared personalization boundary in `AGENTS.md`.

## Verification

- Test preference defaults, custom persona validation, tone selection, and safe in-app formatting.
- Test the authenticated test-SMS endpoint rejects arbitrary recipient input and uses the linked account number.
- Exercise the real Account flow in the preview and send one real test SMS to the signed-in test account.
- Verify the outbound audit log records the test and the current build remains healthy.
