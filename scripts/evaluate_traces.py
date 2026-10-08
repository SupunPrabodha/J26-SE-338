"""Synthetic trace coverage: fixed scenario/event denominator, never emit event payloads."""

import json
from pathlib import Path

from research_contracts import FIXTURES

# scenario: (event, status, critical). Each tuple is one required observation.
CATALOGUE = {
    "recovery": [("SUBMISSION_REPLAY", "RECOVERED", True)],
    "success": [
        ("CONSENT_RECORDED", "ACTIVE", True),
        ("SUBMISSION", "ACCEPTED", True),
        ("SUBMISSION_REPLAY", "DUPLICATE", False),
        ("JOB_CLAIM", "CLAIMED", False),
        *[
            ("WORKFLOW_TRANSITION", state, True)
            for state in (
                "RECEIVED",
                "CONSENT_VERIFIED",
                "PREPROCESSING",
                "INFERENCE",
                "EXPLANATION",
                "READY_FOR_REVIEW",
            )
        ],
        ("ASSIGNMENT", "AUTO_GRANTED", True),
        ("HUMAN_REVIEW", "START_REVIEW", True),
        ("HUMAN_REVIEW", "COMPLETE_REVIEW", True),
        ("WITHDRAWAL", "WITHDRAWN", True),
        ("RETENTION", "DERIVED_EVIDENCE_DELETED", True),
    ],
    "rejection": [("CONSENT_RECORDED", "REJECTED", True)],
    "prewithdraw": [
        ("WITHDRAWAL", "BEFORE_SUBMISSION", True),
        ("OPERATION_BLOCKED", "SUBMISSION", True),
    ],
    "expiry": [("CONSENT_EXPIRED", "DETECTED", True), ("OPERATION_BLOCKED", "SUBMISSION", True)],
    "retry": [
        ("JOB_RETRY", "DOWNSTREAM_TIMEOUT", True),
        ("JOB_TERMINAL", "DOWNSTREAM_TIMEOUT", True),
    ],
    "exhaustion": [("JOB_TERMINAL", "RETRY_EXHAUSTED", True)],
    "session": [
        ("AUTH_LOGIN", "SYNTHETIC_SESSION", True),
        ("AUTH_REFRESH", "ROTATED", True),
        ("SESSION_REVOKED", "REFRESH_DENIED", True),
        ("AUTH_LOGOUT", "SUCCESS", True),
    ],
    "retention": [("RETENTION", "DERIVED_EVIDENCE_DELETED", True)],
}


def evaluate(traces, prohibited=()):
    missing, total, critical, found, critical_found = [], 0, 0, 0, 0
    for scenario, required in CATALOGUE.items():
        observed = {(e["event_type"], e["status"]) for e in traces.get(scenario, [])}
        for event, status, important in required:
            total += 1
            critical += important
            present = (event, status) in observed
            found += present
            critical_found += present and important
            if not present:
                missing.append(f"{scenario}:{event}:{status}")
    serialized = json.dumps(traces)
    forbidden_keys = {
        "text",
        "raw_text",
        "password",
        "token",
        "account_id",
        "username",
        "email",
        "consent_id",
        "refresh_hash",
    }
    safe = not any(value in serialized for value in (*FIXTURES.values(), *prohibited) if value)
    safe = safe and all(
        not forbidden_keys.intersection(event) for trace in traces.values() for event in trace
    )
    rows = [event for trace in traces.values() for event in trace]
    case_traces = {}
    for event in rows:
        if event.get("case_id"):
            case_traces.setdefault(event["case_id"], set()).add(event.get("trace_id"))
    reconstructed = bool(case_traces) and all(
        len(refs) == 1 and None not in refs for refs in case_traces.values()
    )
    return {
        "synthetic": True,
        "required": total,
        "observed": found,
        "critical_required": critical,
        "critical_observed": critical_found,
        "overall_coverage": found / total,
        "critical_coverage": critical_found / critical,
        "missing_events": missing,
        "prohibited_content_absent": safe,
        "case_trace_links_consistent": reconstructed,
        "scope": "Fixed synthetic scenario catalogue; not coverage of all C1 requirements.",
    }


def save_report(report, path):
    destination = Path(path).resolve()
    if not destination.is_relative_to(Path(".local").resolve()):
        raise ValueError("Evidence destination must be in ignored .local")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
