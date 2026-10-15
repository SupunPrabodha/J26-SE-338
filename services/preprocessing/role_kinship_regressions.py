"""Frozen synthetic v3 development and separately reserved regressions."""

from preprocessing.pii_coverage import case


def development():
    return (
        case(
            "reported-variants",
            "romanized-si",
            "ape supervisior ms aparna. ape grp leader supun",
            (("PERSON", "aparna"), ("PERSON", "supun")),
        ),
        case("reported-kinship", "romanized-si", "mge nngi senali", (("PERSON", "senali"),)),
        case(
            "role-title-spacing",
            "romanized-si",
            "ape supervisior\tMS.  aruni devan . ape grp leader\tmalira",
            (("PERSON", "aruni devan"), ("PERSON", "malira")),
        ),
        case(
            "role-variant-full",
            "english",
            "Our supervisior Dr. elina vale feels tired.",
            (("PERSON", "elina vale"),),
        ),
        case(
            "role-abbreviation",
            "english",
            "Grp leader: venora devan.",
            (("PERSON", "venora devan"),),
        ),
        case(
            "role-no-punctuation",
            "romanized-si",
            "ape grp leader dilara ape supervisior MS nilan",
            (("PERSON", "dilara"), ("PERSON", "nilan")),
        ),
        *(
            case(
                "kinship-" + str(i),
                "romanized-si",
                prefix + " navira perera mt exams gana dukai.",
                (("PERSON", "navira perera"),),
            )
            for i, prefix in enumerate(("mage nangi", "mge nangi", "mage nngi", "MGE NNGI"))
        ),
        case(
            "kinship-sinhala-name",
            "code-mixed",
            "mage nangi ශ්‍රියා කුමාරි. මට බයයි. 🙂",
            (("PERSON", "ශ්‍රියා කුමාරි"),),
        ),
        case(
            "kinship-contacts",
            "romanized-si",
            "mge nngi elora. sample@example.com 0771234567 IT12345678",
            (
                ("PERSON", "elora"),
                ("EMAIL", "sample@example.com"),
                ("PHONE", "0771234567"),
                ("STUDENT_ID", "IT12345678"),
            ),
        ),
        *(
            case("new-negative-" + str(i), "romanized-si", text, category="negative")
            for i, text in enumerate(
                (
                    "Our supervisior is helpful.",
                    "Our grp leader feels tired.",
                    "mge nngi is helpful",
                    "mage nangi feels worried",
                    "mge nngi helpful",
                    "mge nngi hondai",
                    "mage nangi dukai",
                    "mage nangi harima hondai",
                    "mge nngi",
                    "ape grp leader [PERSON]. mge nngi [PERSON].",
                    "ape supervisior MS. [PERSON]. Mata exams gana dukai.",
                )
            )
        ),
    )


def unresolved():
    return (
        case("kinship-malformed", "romanized-si", "mge nngi avira123.", category="diagnostic"),
        case(
            "kinship-unbounded",
            "romanized-si",
            "mage nangi relora venira devina noravi kelira.",
            category="diagnostic",
        ),
        case("kinship-ambiguous", "romanized-si", "mge nngi ruvai.", category="diagnostic"),
    )


def held_out():
    # Frozen before development inference; fresh name pool and combinations.
    return (
        case(
            "held-variant-title",
            "romanized-si",
            "ape supervisior mRs. mirena solan. ape grp leader darvin",
            (("PERSON", "mirena solan"), ("PERSON", "darvin")),
        ),
        case(
            "held-kinship-full",
            "romanized-si",
            "Mge nangi rasini kumara mt exam gna byi",
            (("PERSON", "rasini kumara"),),
        ),
        case(
            "held-kinship-lower",
            "romanized-si",
            "mage nngi tanira. Mata classes gana dukai.",
            (("PERSON", "tanira"),),
        ),
        case(
            "held-role-sinhala",
            "code-mixed",
            "Our supervisior ms ශ්‍රීමාලි. මට බයයි.",
            (("PERSON", "ශ්‍රීමාලි"),),
        ),
        case(
            "held-kinship-title",
            "romanized-si",
            "mge nngi Dr. helora venn.",
            (("PERSON", "helora venn"),),
        ),
        *(
            case("held-new-negative-" + str(i), "romanized-si", text, category="negative")
            for i, text in enumerate(
                (
                    "My grp leader is kind.",
                    "mage nngi works hard.",
                    "mge nangi sathutui.",
                    "ape supervisior mr [PERSON].",
                )
            )
        ),
    )
