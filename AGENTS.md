# Architecture rules

- Generate persona-styled outbound nudges only in server functions, with validated structured facts and safe deterministic fallbacks, so prompts and health-safety guardrails never depend on the browser.
- Route inbound meal texts through shared pure intent helpers and an oldest-first draft queue, so separate meals cannot silently overwrite each other.