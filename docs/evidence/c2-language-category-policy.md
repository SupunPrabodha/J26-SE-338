# Provisional Language ID category policy

Policy frozen before the v1.2 rule change, 2026-10-15. This is a deterministic
development baseline, not validated multilingual support or calibrated confidence.

- Sinhala: Sinhala-script language evidence; Latin-script Romanized Sinhala
  markers alongside Sinhala remain Sinhala with mixed-script evidence.
- English: multiple distinct English grammatical markers, with sufficient text.
- Romanized Sinhala: multiple distinct Romanized grammatical markers, or the
  existing complete explicit possessive name-introduction phrase.
- Code-mixed: supported Sinhala (script or Romanized) AND English language
  evidence. Latin script alone and isolated borrowed/shared words are insufficient.
- Uncertain: ambiguous or insufficient evidence. Existing `unknown` remains the
  API abstention for empty, placeholder-only or unsupported-script evidence.

Precedence: ignore placeholders; reject unsupported scripts; identify Sinhala
script; require the existing English evidence threshold before code-mixed;
otherwise allow Sinhala plus recognized Romanized evidence as mixed-script
Sinhala. Unexplained Latin content abstains. Pure Latin decisions and the v1.1
short naming-phrase correction remain unchanged. Source text is never rewritten.

Frozen evaluation labels remain unchanged. Some frozen code-mixed labels contain
isolated English content without sufficient grammatical evidence; report these
as abstentions/policy disagreements, not relabelled successes. All previously
inspected cases and the added category diagnostics are development evidence.
