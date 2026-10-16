# Architecture rules

- Generate persona-styled outbound nudges only in server functions, with validated structured facts and safe deterministic fallbacks, so prompts and health-safety guardrails never depend on the browser.
- Route inbound meal texts through shared pure intent helpers and an oldest-first draft queue, so separate meals cannot silently overwrite each other.
- Analyze SMS meal photos through the same server-side analyzer as in-app photos; verify photo webhook signatures and scoped media URLs, download with bounded memory and no credential forwarding, and never persist image bytes or media URLs.
- Derive the live daily carb summary from saved food/drink journal rows using the browser's local calendar day, separate from yesterday's generated insight, so confirmed SMS meals appear without regenerating AI summaries.