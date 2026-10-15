"""Fictional coverage diagnostics; no runtime detector logic or gold substitution."""

from dataclasses import dataclass

from preprocessing.span_evaluation import EntitySpan


@dataclass(frozen=True)
class CoverageCase:
    case_id: str
    language: str
    text: str
    gold: tuple[EntitySpan, ...]
    category: str = "entity"


def case(key, language, text, entities=(), category="entity"):
    spans = []
    for label, value in entities:
        if text.count(value) != 1:
            raise ValueError("Diagnostic span must occur exactly once.")
        start = text.index(value)
        spans.append(EntitySpan(start, start + len(value), label))
    return CoverageCase(key, language, text, tuple(sorted(spans)), category)


def cases():
    groups = (
        (
            "english",
            "My name is Jane Miller.",
            "Jane Miller",
            "I met Oliver Reed.",
            "Oliver Reed",
            "I live in London.",
            "London",
            "I visited Paris.",
            "Paris",
            "I feel worried about exams, but talking helps. 🙂",
        ),
        (
            "sinhala",
            "මගේ නම නිමල් පෙරේරා.",
            "නිමල් පෙරේරා",
            "මම රුවිනි සමඟ කතා කළා.",
            "රුවිනි",
            "මම කොළඹ ජීවත් වෙමි.",
            "කොළඹ",
            "මම මහනුවර ගියා.",
            "මහනුවර",
            "විභාග නිසා මට බයයි. 🙂",
        ),
        (
            "romanized-si",
            "Mage nama Nimal Perera.",
            "Nimal Perera",
            "mt supun banna nisa duki",
            "supun",
            "Mama Colombo wala innawa.",
            "Colombo",
            "Mama Kandy giya.",
            "Kandy",
            "Mata exams gana dukai.",
        ),
        (
            "code-mixed",
            "මගේ නම Nimal Perera.",
            "Nimal Perera",
            "මම කතා කළේ Jane Miller සමඟ.",
            "Jane Miller",
            "මම live in London.",
            "London",
            "මම Paris ගියා.",
            "Paris",
            "මට exams pressure තියෙනවා. 🙂",
        ),
    )
    output = []
    for language, p1, n1, p2, n2, l1, place1, l2, place2, ordinary in groups:
        for index, text, value in ((1, p1, n1), (2, p2, n2)):
            output.append(case(f"{language}-person-{index}", language, text, (("PERSON", value),)))
        for index, text, value in ((1, l1, place1), (2, l2, place2)):
            output.append(
                case(f"{language}-location-{index}", language, text, (("LOCATION", value),))
            )
        for label, values in (
            ("EMAIL", ("fixture@example.com", "sample.two@example.com")),
            ("PHONE", ("0771234567", "+94 71 234 5678")),
            ("STUDENT_ID", ("IT12345678", "se87654321")),
        ):
            for index, value in enumerate(values, 1):
                text = f"{ordinary} ({value})!"
                output.append(
                    case(f"{language}-{label.lower()}-{index}", language, text, ((label, value),))
                )
        details = (
            ("PERSON", n1),
            ("LOCATION", place1),
            ("EMAIL", "details@example.com"),
            ("PHONE", "0777654321"),
            ("STUDENT_ID", "CS11223344"),
        )
        text = f"{p1} {l1} details@example.com, 0777654321; CS11223344! 🙂"
        output.append(case(f"{language}-combined", language, text, details, "combined"))
        output.append(case(f"{language}-ordinary", language, ordinary, category="negative"))
    output.extend(
        (
            case(
                "code-mixed-sinhala-person",
                "code-mixed",
                "මගේ නම නිමල් පෙරේරා. Exams ගැන බයයි.",
                (("PERSON", "නිමල් පෙරේරා"),),
            ),
            case(
                "code-mixed-sinhala-location",
                "code-mixed",
                "මම කොළඹ live කරනවා.",
                (("LOCATION", "කොළඹ"),),
            ),
            case(
                "english-lowercase-person",
                "english",
                "I spoke with avira about exams.",
                (("PERSON", "avira"),),
            ),
            case(
                "english-address",
                "english",
                "My fictional address is 42 Willow Lane, London.",
                (("LOCATION", "42 Willow Lane, London"),),
                "address",
            ),
            case(
                "sinhala-address",
                "sinhala",
                "ලිපිනය අංක 42, මල් මාවත, කොළඹ.",
                (("LOCATION", "අංක 42, මල් මාවත, කොළඹ"),),
                "address",
            ),
            case(
                "romanized-si-address",
                "romanized-si",
                "Mage lipinaya 42 Mal Mawatha, Colombo.",
                (("LOCATION", "42 Mal Mawatha, Colombo"),),
                "address",
            ),
            case(
                "code-mixed-address",
                "code-mixed",
                "ලිපිනය 42 Willow Lane, London.",
                (("LOCATION", "42 Willow Lane, London"),),
                "address",
            ),
            case(
                "protected",
                "english",
                "[PERSON] [LOCATION] [EMAIL] [PHONE] [STUDENT_ID]",
                category="placeholder",
            ),
            case(
                "neighbour-overlap",
                "english",
                "Jane Miller IT12345678, practice@example.com; 0771234567.",
                (
                    ("PERSON", "Jane Miller"),
                    ("STUDENT_ID", "IT12345678"),
                    ("EMAIL", "practice@example.com"),
                    ("PHONE", "0771234567"),
                ),
                "overlap",
            ),
            case(
                "other-identifiers",
                "english",
                "Fictional US social security number 123-45-6789; passport X1234567.",
                category="unsupported-id",
            ),
            case("title-offline", "english", "Ms. aprna", (("PERSON", "aprna"),), "diagnostic"),
        )
    )
    return tuple(output)
