"""Generate disposable synthetic cases in memory; never persist fixture text."""

import re
from dataclasses import dataclass

from preprocessing.span_evaluation import EntitySpan


@dataclass(frozen=True)
class SpanCase:
    family: str
    split: str
    language: str
    text: str
    gold: tuple[EntitySpan, ...]


def _parse(marked):
    text, gold, cursor = "", [], 0
    for match in re.finditer(r"<([A-Z_]+)>(.*?)</\1>", marked):
        text += marked[cursor : match.start()]
        start = len(text)
        text += match[2]
        gold.append(EntitySpan(start, len(text), match[1]))
        cursor = match.end()
    return text + marked[cursor:], tuple(gold)


def build_benchmark():
    # Related variants belong to one explicit split; no random row splitting.
    families = {
        "development-explicit": (
            "development",
            {
                "english": [
                    "My name is <PERSON>Nimal</PERSON>.",
                    "Call <PHONE>0771234567</PHONE>.",
                ],
                "sinhala": ["මගේ නම <PERSON>නිමල්</PERSON>.", "අමතන්න <PHONE>0771234567</PHONE>."],
                "romanized": ["Mage nama <PERSON>Nimal</PERSON>.", "Mata dukai."],
                "code_mixed": [
                    "මගේ email <EMAIL>fixture@example.com</EMAIL>.",
                    "Mage nama <PERSON>Kasun</PERSON> and I feel tired.",
                ],
            },
        ),
        "heldout-identifiers": (
            "heldout",
            {
                language: [
                    f"{prefix} <EMAIL>synthetic.a@example.com</EMAIL> and <EMAIL>synthetic.a@example.com</EMAIL>.",
                    f"{prefix} <PHONE>071-234-5678</PHONE>, <PHONE>+94 77 1234567</PHONE>.",
                    f"{prefix} <STUDENT_ID>IT87654321</STUDENT_ID>.",
                    f"{prefix} [EMAIL] <EMAIL>fixture.b@example.com</EMAIL> [PERSON].",
                ]
                for language, prefix in (
                    ("english", "Contact"),
                    ("sinhala", "අමතන්න"),
                    ("romanized", "Amathanna"),
                    ("code_mixed", "මට contact"),
                )
            },
        ),
        "heldout-names-locations": (
            "heldout",
            {
                "english": [
                    "My name is <PERSON>Sunil Perera</PERSON>.",
                    "I am <PERSON>Kavindu</PERSON>.",
                    "<PERSON>Alice Smith</PERSON> studies in <LOCATION>Colombo</LOCATION>.",
                    "I live in <LOCATION>New York</LOCATION>.",
                    "My name is <PERSON>Sunill</PERSON>.",
                ],
                "sinhala": [
                    "මගේ නම <PERSON>සුනිල් පෙරේරා</PERSON>.",
                    "මම <PERSON>නිමාලි</PERSON>.",
                    "<PERSON>කසුන්</PERSON> ඉන්නේ <LOCATION>මහනුවර</LOCATION>.",
                    "මගේ නම <PERSON>සුනිල්ල</PERSON>.",
                ],
                "romanized": [
                    "Mage nama <PERSON>Sunil Perera</PERSON>.",
                    "Mage nama <PERSON>Sunill</PERSON>.",
                    "<PERSON>Kasun</PERSON> inne <LOCATION>Kandy</LOCATION>.",
                    "Mama <PERSON>Nimali</PERSON>.",
                ],
                "code_mixed": [
                    "Mage nama <PERSON>Sunil Perera</PERSON> and I feel sad.",
                    "මගේ නම <PERSON>කසුන්</PERSON>, I live in <LOCATION>Kandy</LOCATION>.",
                    "<PERSON>Alice</PERSON> මහනුවර ඉගෙන ගන්නවා.",
                    "My name is <PERSON>Nimall</PERSON>, mata dukai.",
                ],
            },
        ),
        "heldout-wellbeing-negatives": (
            "heldout",
            {
                "english": [
                    "I am Stressed about exams.",
                    "I am tired and need support.",
                    "I am Happy today.",
                    "My name is [PERSON] and email is [EMAIL].",
                    "The library timetable is busy.",
                ],
                "sinhala": [
                    "මම දුකෙන් ඉන්නේ.",
                    "මම අද සතුටින්.",
                    "මම පාඩම් කරනවා.",
                    "මගේ නම [PERSON].",
                    "විභාග නිසා බයයි.",
                ],
                "romanized": [
                    "Mama dukin inne.",
                    "Mage nama [PERSON].",
                    "Mata exam pressure.",
                    "Mama ada sathutin.",
                    "Assignments godak thiyenawa.",
                ],
                "code_mixed": [
                    "මම stressed about exams.",
                    "I am Sad, mata dukai.",
                    "Mage nama [PERSON], I need support.",
                    "මම අද tired.",
                    "Library eke assignments karanawa.",
                ],
            },
        ),
    }
    cases = []
    for family, (split, languages) in families.items():
        for language, variants in languages.items():
            for marked in variants:
                text, gold = _parse(marked)
                cases.append(SpanCase(family, split, language, text, gold))
    return tuple(cases)
