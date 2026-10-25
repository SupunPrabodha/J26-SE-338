"""
Reddit Public Corpus Collector for Domain-Adaptive Pretraining (DAPT).
Owner: C3 - Ramanayake R. H. B. D. G. (IT23164130)

Collects public, anonymized Sinhala, Singlish, and English student/wellbeing
text from public discussion subreddits for unsupervised Masked Language Modeling.
Strictly adheres to privacy rules: strips all usernames, URLs, and personal metadata.
"""

from __future__ import annotations

import re
import time
from pathlib import Path

import requests

# Default targeted search queries for Sri Lankan student wellbeing context
TARGET_QUERIES = [
    "university exam stress",
    "campus semester assignment",
    "sliit exam stress",
    "degree gpa pressure",
    "studies overwhelmed depression",
    "counselling mental health student",
    "exam amarui",
    "campus epawela",
    "semester assignment wadi",
    "results awul",
    "විභාග පීඩනය",
    "කැම්පස් අමාරුයි",
]


def sanitize_text(text: str) -> str:
    """Anonymizes and sanitizes extracted text."""
    if not isinstance(text, str):
        return ""
    # Remove URLs
    text = re.sub(r"http\S+|www\.\S+", "", text)
    # Remove Reddit user handles (e.g. u/username) and subreddits
    text = re.sub(r"u\/[A-Za-z0-9_-]+", "", text)
    text = re.sub(r"r\/[A-Za-z0-9_-]+", "", text)
    # Remove Reddit markdown artefacts
    text = re.sub(r"\[deleted\]|\[removed\]", "", text, flags=re.IGNORECASE)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def fetch_subreddit_posts(
    subreddit: str = "srilanka",
    queries: list[str] = TARGET_QUERIES,
    max_per_query: int = 50,
) -> list[str]:
    """Fetches public posts and comments matching target queries via Reddit JSON API."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AcademicResearchBot/1.0"}
    collected_texts: set[str] = set()

    print(f"\n[Collector] Searching r/{subreddit} for student and wellbeing discussions...")

    for query in queries:
        print(f"  -> Querying: '{query}'...")
        url = f"https://www.reddit.com/r/{subreddit}/search.json"
        params = {
            "q": query,
            "restrict_sr": 1,
            "limit": max_per_query,
            "sort": "relevance",
        }

        try:
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                children = data.get("data", {}).get("children", [])
                for child in children:
                    item_data = child.get("data", {})
                    title = sanitize_text(item_data.get("title", ""))
                    selftext = sanitize_text(item_data.get("selftext", ""))

                    for text_chunk in [title, selftext]:
                        # Keep meaningful sentences between 15 and 400 characters
                        if len(text_chunk) > 15:
                            # Split paragraphs into individual sentences
                            sentences = re.split(r"(?<=[.!?]) +", text_chunk)
                            for s in sentences:
                                cleaned_s = s.strip()
                                if 15 <= len(cleaned_s) <= 400:
                                    collected_texts.add(cleaned_s)
            elif response.status_code == 429:
                print("    Rate limited by Reddit. Sleeping for 5 seconds...")
                time.sleep(5)
            else:
                print(f"    Notice: Reddit returned HTTP {response.status_code} for query.")
        except Exception as err:
            print(f"    Error querying '{query}': {err}")

        # Polite rate-limiting delay between queries
        time.sleep(1.5)

    return list(collected_texts)


def run_collection(
    output_path: Path | str = "data/adaptation/unlabeled_adaptation_corpus.txt",
    subreddits: list[str] | None = None,
) -> None:
    """Executes collection and saves clean line-by-line sentences for MLM pretraining."""
    if subreddits is None:
        subreddits = ["srilanka"]
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    all_sentences: set[str] = set()
    for sub in subreddits:
        sub_sentences = fetch_subreddit_posts(subreddit=sub)
        all_sentences.update(sub_sentences)

    if not all_sentences:
        print("\n[Collector] No new sentences collected. Please verify your internet connection.")
        return

    # Append to existing file or write new
    existing_lines: set[str] = set()
    if out_file.exists():
        with open(out_file, encoding="utf-8") as f:
            existing_lines = {line.strip() for line in f if line.strip()}

    combined = existing_lines.union(all_sentences)

    with open(out_file, "w", encoding="utf-8") as f:
        for sentence in sorted(combined):
            f.write(sentence + "\n")

    print("\n=======================================================")
    print(f"[Collector] Successfully collected {len(all_sentences)} new sentences!")
    print(f"[Collector] Total corpus size: {len(combined)} sentences saved to:")
    print(f"            {out_file.resolve()}")
    print("=======================================================\n")


if __name__ == "__main__":
    target_out = (
        Path(__file__).resolve().parent.parent
        / "data"
        / "adaptation"
        / "unlabeled_adaptation_corpus.txt"
    )
    run_collection(output_path=target_out)
