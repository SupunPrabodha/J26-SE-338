"""Manually specified synthetic PERSON gold; failures remain diagnostic evidence."""

import pytest
from preprocessing.demo import SCENARIOS
from preprocessing.span_evaluation import select_presidio

# Original Unicode character offsets, half-open; labels never come from predictions.
GOLD = {
    "english-person": (11, 23),
    "sinhala-person": (7, 19),
    "romanized-person": (10, 22),
    "code-mixed-person": (7, 19),
}


@pytest.mark.parametrize("scenario", GOLD)
def test_manual_person_labels_are_intact(scenario):
    text = next(row[3][0] for row in SCENARIOS if row[0] == scenario)
    start, end = GOLD[scenario]
    expected = "නිමල් පෙරේරා" if scenario == "sinhala-person" else "Nimal Perera"
    assert text[start:end] == expected


@pytest.mark.parametrize(
    "scenario",
    [
        "english-person",
        "sinhala-person",  # Shared explicit introduction now gives the exact span.
        "romanized-person",
        "code-mixed-person",
    ],
)
def test_current_person_diagnostic(scenario):
    text = next(row[3][0] for row in SCENARIOS if row[0] == scenario)
    spans = {(r.start, r.end) for r in select_presidio(text) if r.entity_type == "PERSON"}
    assert spans == {GOLD[scenario]}


@pytest.mark.parametrize(
    "scenario",
    [
        "english-ordinary",
        "sinhala",
        "romanized",
        "code-mixed",
    ],
)
def test_ordinary_has_no_person(scenario):
    text = next(row[3][0] for row in SCENARIOS if row[0] == scenario)
    assert not [r for r in select_presidio(text) if r.entity_type == "PERSON"]
