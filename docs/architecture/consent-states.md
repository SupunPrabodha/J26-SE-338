# Consent state model

PENDING → ACTIVE or REJECTED after a recorded decision. ACTIVE → EXPIRED, WITHDRAWN or INVALID. REJECTED, WITHDRAWN, INVALID and EXPIRED cannot become ACTIVE; a new consent record is required. The bootstrap endpoint records only ACTIVE or REJECTED; other states are represented and tested as governance/expiry conditions. ACTIVE with an elapsed expires_at is treated as expired on reads and every gate.

Processing requires current ACTIVE status, `dev-notice-1`, matching `synthetic-wellbeing-screening` purpose and a future UTC expiry. Missing records, foreign ownership, wrong purpose, bad version and elapsed expiry all block processing. One active decision authorizes one case in this bootstrap. Retries use the same case, purpose and consent; a fresh submission needs a fresh decision.
