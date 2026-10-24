// Explicit non-sensitive extracts; never load arbitrary reports into the browser.
export const c1Evidence = [
  {
    title: "Consent and authorization regressions",
    result: "103 integration, security and contract tests passed",
    detail: "Recorded suite includes consent rejection/expiry, submission conflict recovery, ownership, assigned review and withdrawal negatives. The total is the suite count, not a count of consent scenarios.",
    source: "docs/evidence/c1-pp1-readiness.md — Newly executed verification",
    date: "2026-10-08 (Asia/Colombo); exact run timestamp not recorded",
    revision: "Baseline c5a433b; UI verification was uncommitted at the time and later included in 54d51c2. Exact execution SHA not recorded.",
    limitation: "Synthetic fixtures and development authentication; not a comprehensive security assessment or current test run.",
  },
  {
    title: "Audit scenario catalogue",
    result: "29 / 29 required observations; 27 / 27 critical",
    detail: "No missing tuples in the fixed scenario/event/status catalogue. Checks include prohibited-content absence and consistent case trace links.",
    source: "docs/evidence/c1-lifecycle-evaluation.md — Verification provenance; docs/security/audit-catalogue.md; scripts/evaluate_traces.py",
    date: "2026-10-08 report date (Asia/Colombo); exact run timestamp not recorded",
    revision: "Implementation recorded in c5a433b, developed from 112efa0; exact execution SHA not recorded.",
    limitation: "Catalogue coverage only, not all possible C1 events, universal ordering or a live audit feed.",
  },
  {
    title: "PostgreSQL reliability",
    result: "9 synthetic reliability checks passed",
    detail: "Parallel claims, lease recovery, stale/duplicate executors, expiry at publication, withdrawal races, exhausted leases and bounded timeouts.",
    source: "docs/evidence/c1-lifecycle-evaluation.md — Verification provenance; scripts/postgres_checks.py",
    date: "2026-10-08 report date (Asia/Colombo); exact run timestamp not recorded",
    revision: "Implementation recorded in c5a433b; exact execution SHA not recorded.",
    limitation: "Selected database race scenarios. Worker interruption was simulated; no OS-kill or distributed soak-test claim.",
  },
  {
    title: "Mock-based performance proxy",
    result: "200 / 200 workflows; core p95 383.257 ms",
    detail: "20 warm-ups, concurrency 4; p50 229.262 ms, p99 516.522 ms; batch throughput 16.131 workflows/s; zero errors in that run.",
    source: "docs/evidence/c1-lifecycle-evaluation.md — Retained performance evidence; scripts/c1_performance.py",
    date: "2026-10-07T19:33:21.589801Z (2026-10-08 in Asia/Colombo)",
    revision: "Retained measurement predates final audit/logout refinements in c5a433b; exact measured SHA unavailable.",
    limitation: "Core submission/worker proxy subtracting measured mock execution. Excludes HTTP/authentication transport, queue delay and real inference; not end-to-end latency or proof of the proposal target. Shared-machine contention was uncontrolled.",
  },
] as const;
