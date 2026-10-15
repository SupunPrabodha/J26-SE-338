"""Frozen fictional development/held-out fixtures, never a runtime dictionary."""

from preprocessing.pii_coverage import case


def development():
    return (
        case(
            "reported-role",
            "romanized-si",
            "ape supervisor MS. Aprna . Ape group leader supun",
            (("PERSON", "Aprna"), ("PERSON", "supun")),
        ),
        case(
            "protected-neluni",
            "romanized-si",
            "mage nama neluni mt exam gna byi",
            (("PERSON", "neluni"),),
        ),
        *(
            case(
                "title-" + str(i), "english", f"{title} avira feels tired.", (("PERSON", "avira"),)
            )
            for i, title in enumerate(("Ms.", "MS.", "ms", "Mr.", "MR", "Mrs.", "mRs", "Dr.", "dR"))
        ),
        case(
            "title-full", "english", "Ms. Jane Miller feels worried.", (("PERSON", "Jane Miller"),)
        ),
        case(
            "role-full",
            "english",
            "Our supervisor elora venn is here.",
            (("PERSON", "elora venn"),),
        ),
        case("role-colon", "english", "Group leader: nilara devan.", (("PERSON", "nilara devan"),)),
        case(
            "no-punctuation",
            "romanized-si",
            "ape supervisor ms avira ape group leader talin",
            (("PERSON", "avira"), ("PERSON", "talin")),
        ),
        case("title-sinhala", "sinhala", "Ms. ශ්‍රියා රුවිනි. මට බයයි. 🙂", (("PERSON", "ශ්‍රියා රුවිනි"),)),
        case(
            "role-mixed",
            "code-mixed",
            "my supervisor නිමලි. මට exams pressure තියෙනවා.",
            (("PERSON", "නිමලි"),),
        ),
        case(
            "title-contacts",
            "english",
            "Ms. elora. Contact sample@example.com, 0771234567, IT12345678.",
            (
                ("PERSON", "elora"),
                ("EMAIL", "sample@example.com"),
                ("PHONE", "0771234567"),
                ("STUDENT_ID", "IT12345678"),
            ),
        ),
        *(
            case("negative-" + str(i), "english", text, category="negative")
            for i, text in enumerate(
                (
                    "our supervisor is helpful",
                    "our supervisor helpful",
                    "our supervisor works hard.",
                    "Our group leader is kind.",
                    "Write Ms. before the name in this exercise.",
                    "The abbreviation Dr. means doctor.",
                    "The title Mrs. is optional.",
                    "Ms.aprna",
                    "Mrship avira",
                    "Ms.\navira",
                    "Our supervisor is worried about exams.",
                    "Ms. [PERSON]. Our group leader [PERSON].",
                    "Mata exams gana dukai.",
                )
            )
        ),
    )


def held_out():
    # Frozen before development inference; these are small synthetic regressions,
    # not the historical annotation reserved partition or research validation.
    return (
        case("held-title-lower", "english", "mr. lorin. I feel tired.", (("PERSON", "lorin"),)),
        case(
            "held-role-multi",
            "english",
            "My supervisor serina vale. Our group leader emren.",
            (("PERSON", "serina vale"), ("PERSON", "emren")),
        ),
        case(
            "held-role-romanized",
            "romanized-si",
            "ape group leader ravini ape supervisor devran",
            (("PERSON", "ravini"), ("PERSON", "devran")),
        ),
        case(
            "held-title-romanized",
            "romanized-si",
            "MS. pavini. Mata exams gana dukai.",
            (("PERSON", "pavini"),),
        ),
        case(
            "held-role-sinhala",
            "sinhala",
            "our supervisor දිලිනි කුමාරි. මට බයයි.",
            (("PERSON", "දිලිනි කුමාරි"),),
        ),
        case("held-title-joiner", "sinhala", "DR. ශ්‍රීමා. මට මහන්සියි. 🙂", (("PERSON", "ශ්‍රීමා"),)),
        case(
            "held-title-mixed",
            "code-mixed",
            "Ms. නෙරිනි. මට exam pressure තියෙනවා.",
            (("PERSON", "නෙරිනි"),),
        ),
        case(
            "held-contacts-mixed",
            "code-mixed",
            "my supervisor ruvana. මට බයයි. contact@example.com 0712345678 SE87654321",
            (
                ("PERSON", "ruvana"),
                ("EMAIL", "contact@example.com"),
                ("PHONE", "0712345678"),
                ("STUDENT_ID", "SE87654321"),
            ),
        ),
        *(
            case("held-negative-" + str(i), "english", text, category="negative")
            for i, text in enumerate(
                (
                    "My supervisor is supportive.",
                    "Our group leader feels tired.",
                    "Place Mr. before a fictional name.",
                    "The abbreviation Mrs. means a title.",
                    "Our supervisor can listen.",
                    "Ms. [PERSON]. I feel worried.",
                )
            )
        ),
    )
