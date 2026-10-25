"""
YouTube Student Discussions & Comments Scraper for Stage B DAPT.
Owner: C3 - Ramanayake R. H. B. D. G. (IT23164130)

Scrapes, cleans, anonymizes, and segments comments from any YouTube video URL
(campus vlogs, student discussions, exam stress videos) to feed the
unlabeled domain-adaptive pretraining corpus for XLM-RoBERTa.

Features:
- CLI or interactive URL input (single URL or text file of URLs)
- Full comment & reply extraction via yt-dlp
- Strict privacy: strips all user handles, author tags, URLs, and timestamps
- Smart sentence segmentation and length filtering (15 - 400 chars)
- Automatic deduplication against existing corpus
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yt_dlp

# Force UTF-8 stdout to prevent Windows cp1252 UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def clean_comment_text(raw_text: str) -> str:
    """Anonymizes and sanitizes extracted comment text."""
    if not isinstance(raw_text, str):
        return ""

    # Remove URLs (http, https, www, youtu.be)
    text = re.sub(r"https?:\/\/\S+|www\.\S+", "", raw_text)
    # Remove @user mentions
    text = re.sub(r"@[\w\.-]+", "", text)
    # Remove timestamps (e.g., 03:45, 1:20:15)
    text = re.sub(r"\b\d{1,2}:\d{2}(?::\d{2})?\b", "", text)
    # Normalize excessive punctuation (e.g., !!!!!! or ????)
    text = re.sub(r"([!?.,])\1+", r"\1", text)
    # Collapse multiple whitespace characters and newlines
    text = re.sub(r"\s+", " ", text).strip()
    return text


def segment_into_sentences(text: str, min_len: int = 15, max_len: int = 400) -> list[str]:
    """
    Splits long comment blocks into coherent sentence units suitable for
    Masked Language Modeling (MLM).
    """
    if len(text) < min_len:
        return []

    # Split on sentence terminals or newlines
    raw_sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    clean_sentences = []

    for s in raw_sentences:
        s_clean = s.strip()
        # Drop junk or ultra-short expressions
        if len(s_clean) < min_len or len(s_clean) > max_len:
            continue
        # Drop lines that are purely numbers or special characters
        if not re.search(r"[a-zA-Z\u0D80-\u0DFF]", s_clean):
            continue
        clean_sentences.append(s_clean)

    return clean_sentences


def sanitize_filename(title: str, max_length: int = 50) -> str:
    """Sanitizes video title for safe filesystem filenames on Windows."""
    # Strip illegal Windows characters: \ / : * ? " < > |
    safe_name = re.sub(r'[\\/*?:"<>|]', "", title)
    safe_name = re.sub(r"\s+", "_", safe_name).strip("._ ")
    return safe_name[:max_length] if safe_name else "video"


def extract_comments_from_url(video_url: str) -> tuple[str, str, list[str]]:
    """
    Extracts all public comments and replies from a YouTube video URL using yt-dlp.
    Returns:
        (video_id, video_title, list_of_cleaned_sentences)
    """
    clean_url = video_url.strip()
    if not clean_url:
        return "", "", []

    print(f"\n[Scraper] Connecting to video: {clean_url} ...")

    ydl_opts = {
        "skip_download": True,
        "getcomments": True,
        "extract_flat": False,
        "quiet": True,
        "no_warnings": True,
        "extractor_args": {
            "youtube": {
                "max_comments": ["all", "all", "all", "all"],
            }
        },
    }

    sentences: list[str] = []
    video_id = ""
    video_title = "Unknown_Title"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=False)
            video_id = info.get("id", "")
            video_title = info.get("title", "Unknown Title")
            raw_comments = info.get("comments", [])
            print(f'[Scraper] Video Title: "{video_title}" (ID: {video_id})')
            print(f"[Scraper] Retrieved {len(raw_comments)} raw comments/replies.")

            for item in raw_comments:
                raw_text = item.get("text", "")
                cleaned = clean_comment_text(raw_text)
                split_sents = segment_into_sentences(cleaned)
                sentences.extend(split_sents)

    except Exception as exc:
        print(f"[Scraper] Error extracting from {clean_url}: {exc}")

    return video_id, video_title, sentences


def save_separate_video_file(
    video_id: str,
    video_title: str,
    sentences: list[str],
    video_dir: Path,
) -> Path:
    """Saves this video's extracted sentences into its own dedicated separate file."""
    video_dir.mkdir(parents=True, exist_ok=True)
    safe_title = sanitize_filename(video_title)
    filename = f"{video_id}_{safe_title}.txt" if safe_title else f"{video_id}.txt"
    out_file = video_dir / filename

    # Deduplicate within this video
    unique_sentences = list(dict.fromkeys(sentences))

    with open(out_file, "w", encoding="utf-8") as f:
        f.write(f"# Source: https://www.youtube.com/watch?v={video_id}\n")
        f.write(f"# Title: {video_title}\n")
        f.write(f"# Extracted Sentences: {len(unique_sentences)}\n\n")
        for s in unique_sentences:
            f.write(s + "\n")

    return out_file


def save_and_merge_sentences(
    new_sentences: list[str],
    comments_file: Path,
    unified_corpus_file: Path | None = None,
) -> int:
    """
    Deduplicates and appends new sentences to target accumulated corpus files.
    """
    comments_file.parent.mkdir(parents=True, exist_ok=True)

    existing_lines: set[str] = set()
    if comments_file.exists():
        with open(comments_file, encoding="utf-8") as f:
            existing_lines = {
                line.strip() for line in f if line.strip() and not line.startswith("#")
            }

    added_count = 0
    with open(comments_file, "a", encoding="utf-8") as f:
        for s in new_sentences:
            if s not in existing_lines and not s.startswith("#"):
                f.write(s + "\n")
                existing_lines.add(s)
                added_count += 1

    # Also append directly into the unified adaptation corpus
    if unified_corpus_file and unified_corpus_file.exists():
        with open(unified_corpus_file, encoding="utf-8") as f:
            unified_lines = {
                line.strip() for line in f if line.strip() and not line.startswith("#")
            }
        with open(unified_corpus_file, "a", encoding="utf-8") as f:
            for s in new_sentences:
                if s not in unified_lines and not s.startswith("#"):
                    f.write(s + "\n")
                    unified_lines.add(s)

    return added_count


def scrape_youtube_videos(
    urls: list[str],
    output_dir: Path | str = "data/adaptation",
) -> None:
    """Main routine to process a list of YouTube URLs."""
    out_dir = Path(output_dir)
    videos_subfolder = out_dir / "youtube_videos"
    comments_out = out_dir / "student_video_comments.txt"
    unified_out = out_dir / "unlabeled_adaptation_corpus.txt"

    all_extracted_sentences: list[str] = []
    saved_separate_files: list[Path] = []

    for idx, url in enumerate(urls, 1):
        print("\n=======================================================")
        print(f" Processing URL [{idx}/{len(urls)}]")
        print("=======================================================")
        vid_id, title, sents = extract_comments_from_url(url)
        all_extracted_sentences.extend(sents)

        if vid_id and sents:
            separate_file = save_separate_video_file(
                video_id=vid_id,
                video_title=title,
                sentences=sents,
                video_dir=videos_subfolder,
            )
            saved_separate_files.append(separate_file)
            print(f"[Scraper] Saved separate file -> {separate_file.resolve()}")

        print(f"[Scraper] Extracted {len(sents)} valid sentences from this video.")

    newly_added = save_and_merge_sentences(
        new_sentences=all_extracted_sentences,
        comments_file=comments_out,
        unified_corpus_file=unified_out if unified_out.exists() else None,
    )

    total_in_master = 0
    if comments_out.exists():
        with open(comments_out, encoding="utf-8") as f:
            total_in_master = sum(1 for line in f if line.strip() and not line.startswith("#"))

    print("\n=======================================================")
    print(" SUMMARY OF SCRAPING RUN")
    print("=======================================================")
    print(f" Videos Processed: {len(urls)}")
    print(f" Separate Files Created in: '{videos_subfolder.resolve()}'")
    for f in saved_separate_files:
        print(f"   • {f.name}")
    print(f" Total sentences extracted in this run: {len(all_extracted_sentences)}")
    print(f" Newly added (non-duplicate) to master: {newly_added}")
    print(f" Total sentences in master '{comments_out.name}': {total_in_master}")
    if unified_out.exists():
        print(f" Unified adaptation corpus updated at: '{unified_out.resolve()}'")
    print("=======================================================\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape student comments & code-mixed text from YouTube videos for Stage B DAPT."
    )
    parser.add_argument(
        "--url",
        type=str,
        help="A single YouTube video URL to scrape.",
    )
    parser.add_argument(
        "--file",
        type=str,
        help="A text file containing a list of YouTube video URLs (one per line).",
    )
    args = parser.parse_args()

    project_data_dir = Path(__file__).resolve().parent.parent / "data" / "adaptation"

    urls_to_scrape: list[str] = []

    if args.url:
        urls_to_scrape.append(args.url.strip())
    elif args.file:
        file_path = Path(args.file)
        if file_path.exists():
            with open(file_path, encoding="utf-8") as f:
                urls_to_scrape = [
                    line.strip() for line in f if line.strip() and not line.startswith("#")
                ]
        else:
            print(f"Error: File not found: {file_path}")
            sys.exit(1)
    else:
        # Interactive mode
        print("\n=== YouTube Student Discussion Scraper for Stage B ===")
        user_input = input("Enter a YouTube video URL (or press Enter to cancel): ").strip()
        if user_input:
            urls_to_scrape.append(user_input)
        else:
            print("No URL provided. Exiting.")
            sys.exit(0)

    if urls_to_scrape:
        scrape_youtube_videos(urls=urls_to_scrape, output_dir=project_data_dir)


if __name__ == "__main__":
    main()
