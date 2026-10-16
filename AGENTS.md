# Architecture rules

- Generate persona-styled outbound nudges only in server functions, with validated structured facts and safe deterministic fallbacks, so prompts and health-safety guardrails never depend on the browser.
- Route inbound meal texts through shared pure intent helpers and an oldest-first draft queue, so separate meals cannot silently overwrite each other.
- Analyze SMS meal photos through the same server-side analyzer as in-app photos; verify photo webhook signatures and scoped media URLs, download with bounded memory and no credential forwarding, and never persist image bytes or media URLs.
- Derive the live daily carb summary from saved food/drink journal rows using the browser's local calendar day, separate from yesterday's generated insight, so confirmed SMS meals appear without regenerating AI summaries.- Resolve when an SMS meal was eaten server-side in priority order (stated time, CGM rise, typical meal window, time texted) and save it as the journal time on YES, so glucose matching uses eating time rather than texting time.
- Detect unlogged glucose rises server-side with the shared rise detector (mirrored in the app's meal-glucose helper), queue each once in spike_events, and text only within caps/quiet hours, so app cards and texts always agree.
