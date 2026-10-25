"""
Language Splitter Script for Student Video Comments.
Separates comments into:
1. Pure English (pure_english.txt)
2. Pure Sinhala (pure_sinhala.txt)
3. Romanized Sinhala & Code-Mixed (romanized_codemixed.txt)
"""

import os
import re
import sys

from nltk.corpus import names as nltk_names
from nltk.corpus import stopwords as nltk_stopwords
from nltk.corpus import words as nltk_words
from nltk.stem import WordNetLemmatizer

# Configure UTF-8 encoding for Windows console if run interactively
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = BASE_DIR
SOURCE_FILE = os.path.join(DATA_DIR, "student_video_comments.txt")

OUT_PURE_ENGLISH = os.path.join(DATA_DIR, "pure_english.txt")
OUT_PURE_SINHALA = os.path.join(DATA_DIR, "pure_sinhala.txt")
OUT_ROMAN_CODEMIXED = os.path.join(DATA_DIR, "romanized_codemixed.txt")

# Regex detectors
SINHALA_RE = re.compile(r"[\u0D80-\u0DFF]")
LATIN_RE = re.compile(r"[a-zA-Z]")
TOKEN_RE = re.compile(r"[a-zA-Z]+")


def build_lexicons():
    lemmatizer = WordNetLemmatizer()
    eng_words = set(w.lower() for w in nltk_words.words())
    eng_stops = set(w.lower() for w in nltk_stopwords.words("english"))
    eng_names = set(w.lower() for w in nltk_names.words())
    base_eng = eng_words | eng_stops | eng_names

    # Expanded English vocabulary (domain-specific for student/academic context, tech, platforms)
    expanded_eng = {
        "ai",
        "sliit",
        "kdu",
        "nsbm",
        "iit",
        "uom",
        "moratuwa",
        "colombo",
        "pera",
        "ruhuna",
        "gpa",
        "al",
        "ol",
        "dr",
        "mr",
        "mrs",
        "pls",
        "plz",
        "bro",
        "sis",
        "sub",
        "sem",
        "youtube",
        "vlog",
        "vlogs",
        "video",
        "videos",
        "lecture",
        "lectures",
        "campus",
        "degree",
        "degrees",
        "batch",
        "hostel",
        "uni",
        "university",
        "fac",
        "faculty",
        "online",
        "offline",
        "zoom",
        "teams",
        "cv",
        "intern",
        "internship",
        "it",
        "cs",
        "se",
        "ds",
        "cyber",
        "software",
        "hardware",
        "engineering",
        "science",
        "maths",
        "bio",
        "tech",
        "ict",
        "exam",
        "exams",
        "test",
        "tests",
        "pass",
        "passes",
        "fail",
        "fails",
        "failed",
        "accredited",
        "recognized",
        "syllabus",
        "modules",
        "course",
        "courses",
        "fees",
        "free",
        "cost",
        "fee",
        "payment",
        "semester",
        "semesters",
        "years",
        "year",
        "months",
        "month",
        "days",
        "day",
        "hours",
        "hour",
        "mins",
        "min",
        "admin",
        "dm",
        "id",
        "link",
        "page",
        "post",
        "comment",
        "comments",
        "subscribe",
        "subscribers",
        "views",
        "like",
        "likes",
        "thank",
        "thanks",
        "thx",
        "welcome",
        "great",
        "good",
        "super",
        "awesome",
        "amazing",
        "nice",
        "helpful",
        "informative",
        "valuable",
        "love",
        "best",
        "proud",
        "god",
        "bless",
        "congrats",
        "congratulations",
        "true",
        "really",
        "actually",
        "definitely",
        "absolutely",
        "probably",
        "maybe",
        "okay",
        "ok",
        "cool",
        "yeah",
        "yep",
        "nope",
        "lol",
        "omg",
        "rip",
        "btw",
        "idk",
        "tbh",
        "imo",
        "goodluck",
        "goodnight",
        "goodmorning",
        "everyone",
        "anyone",
        "someone",
        "nobody",
        "beautiful",
        "pretty",
        "handsome",
        "smart",
        "cute",
        "sweet",
        "dear",
        "darling",
        "keep",
        "doing",
        "sharing",
        "uploading",
        "inspiring",
        "motivating",
        "waiting",
        "wait",
        "looking",
        "forward",
        "more",
        "content",
        "much",
        "support",
        "don",
        "t",
        "s",
        "m",
        "d",
        "ll",
        "ve",
        "re",
        "didn",
        "doesn",
        "won",
        "couldn",
        "shouldn",
        "isn",
        "aren",
        "wasn",
        "weren",
        "hasn",
        "haven",
        "hadn",
        "can",
        "cant",
        "cannot",
        "u",
        "ur",
        "urself",
        "r",
        "bcoz",
        "coz",
        "cuz",
        "plss",
        "yess",
        "noo",
        "hii",
        "heyy",
        "fyi",
        "vs",
        "etc",
        "macbook",
        "laptop",
        "pc",
        "windows",
        "ios",
        "android",
        "google",
        "microsoft",
        "apple",
        "chatgpt",
        "openai",
        "gemini",
        "watson",
        "sherlock",
        "sushanth",
        "netflix",
        "spotify",
        "facebook",
        "instagram",
        "tiktok",
        "whatsapp",
        "telegram",
        "linkedin",
        "github",
        "stackoverflow",
        "reddit",
        "elakiri",
        "eventhough",
        "thankyou",
        "shoutout",
        "subtitles",
        "mindfulness",
    }
    all_eng = base_eng | expanded_eng

    def is_eng_word(w):
        w = w.lower()
        if w in all_eng:
            return True
        if lemmatizer.lemmatize(w, "n") in all_eng:
            return True
        if lemmatizer.lemmatize(w, "v") in all_eng:
            return True
        if lemmatizer.lemmatize(w, "a") in all_eng:
            return True
        if lemmatizer.lemmatize(w, "r") in all_eng:
            return True
        # Strip repeated characters
        sub_w = re.sub(r"(.)\1{2,}", r"\1\1", w)
        if sub_w in all_eng or lemmatizer.lemmatize(sub_w, "v") in all_eng:
            return True
        sub_w1 = re.sub(r"(.)\1{2,}", r"\1", w)
        if sub_w1 in all_eng or lemmatizer.lemmatize(sub_w1, "v") in all_eng:
            return True
        return False

    def extract_non_eng(filepath):
        words = set()
        if not os.path.exists(filepath):
            return words
        with open(filepath, encoding="utf-8") as f:
            for line in f:
                tokens = TOKEN_RE.findall(line.lower())
                for t in tokens:
                    if not is_eng_word(t) and len(t) >= 2:
                        words.add(t)
        return words

    roman_file = os.path.join(DATA_DIR, "roman_validate.txt")
    uom_file = os.path.join(DATA_DIR, "uom_codemixed_sentences.txt")
    roman_non_eng = extract_non_eng(roman_file)
    uom_non_eng = extract_non_eng(uom_file)

    # Core high-frequency Singlish function words and particles
    core_singlish = {
        "oya",
        "oyata",
        "oyage",
        "oyala",
        "oyalata",
        "oyalath",
        "oye",
        "oyath",
        "mama",
        "mage",
        "mata",
        "mawa",
        "magen",
        "mamat",
        "mamath",
        "math",
        "api",
        "apita",
        "ape",
        "apith",
        "apiva",
        "apen",
        "uba",
        "ubata",
        "ube",
        "uben",
        "umbata",
        "umbe",
        "umba",
        "ubala",
        "ubalata",
        "eya",
        "eyata",
        "eyage",
        "eyalath",
        "eyala",
        "eyalata",
        "un",
        "unta",
        "unge",
        "unuth",
        "eka",
        "eke",
        "ekak",
        "ekata",
        "eken",
        "ekenuth",
        "ekk",
        "ekeda",
        "ekada",
        "meka",
        "meke",
        "mekak",
        "mekata",
        "meken",
        "mekada",
        "oka",
        "oke",
        "okak",
        "okata",
        "oken",
        "okada",
        "araka",
        "arake",
        "arakata",
        "araken",
        "nisa",
        "hinda",
        "thama",
        "thmai",
        "thamai",
        "thamaa",
        "kiyala",
        "kiwwa",
        "kiyanna",
        "kiwwoth",
        "kiyapan",
        "kiwwe",
        "kiyanawa",
        "kiyannako",
        "kiyannkoo",
        "kiyana",
        "kiuwata",
        "hithanawa",
        "hithenawa",
        "hithuna",
        "hithanna",
        "hithala",
        "hithaganna",
        "hithannath",
        "hithagannabaruwa",
        "wenne",
        "wela",
        "una",
        "unath",
        "wunath",
        "unanam",
        "wnne",
        "wuna",
        "wunama",
        "unama",
        "wenawa",
        "wenakn",
        "weddi",
        "karanawa",
        "karanna",
        "karala",
        "karapu",
        "karoth",
        "krla",
        "krlm",
        "kranna",
        "krnna",
        "krpu",
        "karanne",
        "karnna",
        "krl",
        "thiyenne",
        "thiyenawa",
        "thibba",
        "tibba",
        "thibune",
        "tyenawa",
        "thiynawa",
        "thiyenkot",
        "thiyenakota",
        "thiyenawada",
        "thiyena",
        "inne",
        "innawa",
        "hitiye",
        "hitye",
        "hitya",
        "inna",
        "hitapu",
        "ganna",
        "gaththa",
        "denna",
        "dunna",
        "deepan",
        "gaththoth",
        "ganne",
        "danna",
        "danne",
        "dannawa",
        "danna ba",
        "dannawada",
        "ba",
        "baa",
        "bahe",
        "baane",
        "bae",
        "bari",
        "barida",
        "brid",
        "baree",
        "na",
        "naa",
        "naha",
        "ne",
        "neh",
        "neda",
        "nedda",
        "nae",
        "nathi",
        "nathuwa",
        "nane",
        "nah",
        "dan",
        "dannam",
        "danma",
        "methana",
        "ethana",
        "koheda",
        "koheth",
        "mokakda",
        "mokada",
        "moko",
        "mkkda",
        "monada",
        "mnda",
        "mokak",
        "kohomada",
        "kohomath",
        "khmda",
        "aiyo",
        "aiyoo",
        "aida",
        "aey",
        "keeyak",
        "kawuda",
        "kwd",
        "kawda",
        "keeyada",
        "kyada",
        "godak",
        "tika",
        "tikak",
        "podi",
        "loku",
        "patta",
        "supiri",
        "supirima",
        "sira",
        "sirawata",
        "machan",
        "mchn",
        "kollo",
        "kello",
        "kollek",
        "kellek",
        "ban",
        "bn",
        "bng",
        "yako",
        "ado",
        "adoo",
        "ane",
        "ammo",
        "ammoo",
        "appo",
        "pissuda",
        "gedara",
        "weda",
        "wadak",
        "salli",
        "katha",
        "hitha",
        "oluwa",
        "dawas",
        "sathiye",
        "rata",
        "lankawe",
        "lankawa",
        "gihin",
        "awith",
        "dakkada",
        "dakala",
        "balapan",
        "balala",
        "balanna",
        "hodai",
        "hoda",
        "awul",
        "awula",
        "awulak",
        "awlak",
        "thawa",
        "thawath",
        "ekka",
        "wath",
        "witharai",
        "akke",
        "akka",
        "akki",
        "ayye",
        "ayya",
        "aiye",
        "aiyya",
        "malli",
        "nangi",
        "puluwan",
        "puluwanda",
        "plwn",
        "puluwn",
        "oni",
        "oneda",
        "ooni",
        "wage",
        "wagemai",
        "lassana",
        "lassanai",
        "manika",
        "suduu",
        "sudoo",
        "soodoo",
        "aniva",
        "aniwaryen",
        "aniwaryenma",
        "ikamanta",
        "karannm",
        "kenekt",
        "kenek",
        "mona",
        "thoraganne",
        "aapu",
        "sub",
        "dekk",
        "klin",
        "madi",
        "thaman",
        "issarahata",
        "issrht",
        "issrhat",
        "aththada",
        "dkkoth",
        "genth",
        "kamathi",
        "hodi",
        "danagnn",
        "tbboth",
        "krgnn",
        "pattata",
        "mulinm",
        "bedanne",
        "thiyala",
        "anuwa",
        "hodayi",
        "thiyanawa",
        "ahanna",
        "oyaage",
        "ekkenek",
        "gannako",
        "dhenna",
        "thiye",
        "nadda",
        "melo",
        "meloo",
        "rahak",
        "kellekt",
        "kollekt",
        "kellanta",
        "kollanta",
        "gannepa",
        "yanawa",
        "yanna",
        "yanne",
        "giya",
        "giye",
        "yaddi",
        "yaddith",
        "mn",
        "mt",
        "mta",
        "dn",
        "eth",
        "beheth",
        "dewal",
        "wada",
        "ehema",
        "wala",
        "walata",
        "deyak",
        "hama",
        "hri",
        "padam",
        "kiyla",
        "okkoma",
        "enna",
        "wge",
        "jeenu",
        "vedio",
        "mm",
        "prashna",
        "marenna",
        "kiyl",
        "duk",
        "adu",
        "oba",
        "nh",
        "prashne",
        "hodama",
        "jiwithe",
        "docter",
        "kisima",
        "harima",
        "aththa",
        "watinawa",
        "gdk",
        "samahara",
        "udau",
        "duka",
        "kiyanne",
        "idan",
        "aththatama",
        "watina",
        "vishwavidyalaya",
        "scl",
        "scllta",
    }

    singlish_markers = core_singlish | roman_non_eng | uom_non_eng
    singlish_markers = {
        w
        for w in singlish_markers
        if not is_eng_word(w) or w in {"me", "no", "a", "to", "in", "so", "he", "is", "it"}
    }

    return is_eng_word, singlish_markers


def split_comments():
    print(f"Reading source file: {SOURCE_FILE}")
    if not os.path.exists(SOURCE_FILE):
        print(f"Error: {SOURCE_FILE} does not exist.")
        return

    is_eng_word, singlish_markers = build_lexicons()

    with open(SOURCE_FILE, encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    pure_sinhala = []
    pure_english = []
    roman_codemixed = []

    for line in lines:
        has_sinhala = bool(SINHALA_RE.search(line))
        has_latin = bool(LATIN_RE.search(line))

        if has_sinhala and not has_latin:
            # Entirely Sinhala Unicode characters (+ punctuation / digits / emojis)
            pure_sinhala.append(line)
        elif has_sinhala and has_latin:
            # Script-level Code-mixed (Sinhala script + English / Latin words)
            roman_codemixed.append(line)
        elif not has_sinhala and has_latin:
            # Latin script only: distinguish Pure English from Singlish / Romanized Code-mixed
            tokens = TOKEN_RE.findall(line.lower())
            if not tokens:
                continue

            has_strong_singlish = any(
                t in singlish_markers
                and t not in {"me", "no", "to", "so", "in", "a", "he", "is", "it"}
                for t in tokens
            )

            has_singlish_suffix = False
            for t in tokens:
                if is_eng_word(t):
                    continue
                # Common Sinhala grammatical clitics / affixes in Singlish
                if len(t) >= 4 and (
                    t.endswith("da")
                    or t.endswith("ko")
                    or t.endswith("th")
                    or t.endswith("la")
                    or t.endswith("ta")
                    or t.endswith("ken")
                ):
                    has_singlish_suffix = True
                    break

            eng_count = sum(1 for t in tokens if is_eng_word(t) and t not in {"me", "no"})
            eng_ratio = eng_count / len(tokens)

            if not has_strong_singlish and not has_singlish_suffix and eng_ratio >= 0.70:
                pure_english.append(line)
            else:
                roman_codemixed.append(line)

    # Write output files
    print(f"\nWriting Pure Sinhala ({len(pure_sinhala)} lines) to: {OUT_PURE_SINHALA}")
    with open(OUT_PURE_SINHALA, "w", encoding="utf-8") as f:
        f.write("\n".join(pure_sinhala) + "\n")

    print(f"Writing Pure English ({len(pure_english)} lines) to: {OUT_PURE_ENGLISH}")
    with open(OUT_PURE_ENGLISH, "w", encoding="utf-8") as f:
        f.write("\n".join(pure_english) + "\n")

    print(
        f"Writing Romanized / Code-Mixed ({len(roman_codemixed)} lines) to: {OUT_ROMAN_CODEMIXED}"
    )
    with open(OUT_ROMAN_CODEMIXED, "w", encoding="utf-8") as f:
        f.write("\n".join(roman_codemixed) + "\n")

    print("\nExtraction Summary:")
    print(f"  Total Comments Input : {len(lines)}")
    print(
        f"  Pure Sinhala Output  : {len(pure_sinhala)} ({len(pure_sinhala) / len(lines) * 100:.1f}%)"
    )
    print(
        f"  Pure English Output  : {len(pure_english)} ({len(pure_english) / len(lines) * 100:.1f}%)"
    )
    print(
        f"  Romanized/Code-Mixed : {len(roman_codemixed)} ({len(roman_codemixed) / len(lines) * 100:.1f}%)"
    )
    print(
        f"  Total Processed      : {len(pure_sinhala) + len(pure_english) + len(roman_codemixed)}"
    )


if __name__ == "__main__":
    split_comments()
