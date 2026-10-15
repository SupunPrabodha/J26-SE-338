"""Additional development cases; no runtime recognizer/output special cases."""

import pytest
from preprocessing.span_evaluation import select_presidio

CASES = (
    ("informal-name", "mt supun banna nisa duki", ((3, 8),)),
    ("name-with-wellbeing", "Mage nama Nimal Perera. Mata exams gana dukai.", ((10, 22),)),
)


@pytest.mark.parametrize("case_id,text,gold", CASES, ids=[row[0] for row in CASES])
def test_manual_labels(case_id, text, gold):
    expected = "supun" if case_id == "informal-name" else "Nimal Perera"
    assert text[gold[0][0] : gold[0][1]] == expected


@pytest.mark.parametrize(
    "case_id,text,gold",
    [
        pytest.param(
            *row,
            id=row[0],
            marks=pytest.mark.xfail(strict=True, reason="Informal name is still missed")
            if row[0] == "informal-name"
            else (),
        )
        for row in CASES
    ],
)
def test_actual_person_diagnostic(case_id, text, gold):
    actual = tuple((r.start, r.end) for r in select_presidio(text) if r.entity_type == "PERSON")
    assert sorted(actual) == sorted(gold), (
        f"{case_id}: expected offsets {gold}; actual offsets {actual}"
    )
