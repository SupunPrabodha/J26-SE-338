"""Authenticated C2 contextual-runtime parity; no credential/payload output."""

from preprocessing.pii_coverage import case, cases

from scripts import c2_pii_coverage_verify as verify


def contextual_cases():
    return (
        *cases(),
        case("location-ordinary-hope", "english", "I live in hope.", category="negative"),
        case("location-ordinary-peace", "english", "I live in peace.", category="negative"),
        case(
            "location-ordinary-sinhala-adverb", "sinhala", "මම සතුටින් ජීවත් වෙමි.", category="negative"
        ),
        case("location-ordinary-sinhala-fear", "sinhala", "මම බයෙන් ජීවත් වෙමි.", category="negative"),
        case("reported-mge", "romanized-si", "mge nama neluni", (("PERSON", "neluni"),)),
        case("reported-sinhala-ordinary", "sinhala", "මම අද මහන්සියි.", category="negative"),
        case("reported-sinhala-location", "sinhala", "මම කොළඹ ජීවත් වෙමි.", (("LOCATION", "කොළඹ"),)),
        case(
            "nimal-wellbeing",
            "romanized-si",
            "Mage nama Nimal Perera. Mata exams gana dukai.",
            (("PERSON", "Nimal Perera"),),
        ),
        case(
            "unseen-english-intro",
            "english",
            "My name is Elora Venn. I feel worried.",
            (("PERSON", "Elora Venn"),),
        ),
        case(
            "unseen-sinhala-intro",
            "sinhala",
            "මගෙ නම ශ්‍රියා රුවිනි. මට බයයි. 🙂",
            (("PERSON", "ශ්‍රියා රුවිනි"),),
        ),
        case(
            "unseen-address",
            "english",
            "My address is 17 Cedar Road, London.",
            (("LOCATION", "17 Cedar Road, London"),),
        ),
    )


if __name__ == "__main__":
    verify.cases = contextual_cases
    verify.main()
