"""
Unified Corpus Builder for Stage B Domain-Adaptive Pretraining.
Owner: C3 - Ramanayake R. H. B. D. G. (IT23164130)

Aggregates and deduplicates all separate YouTube text files from
`data/adaptation/youtube_videos/*.txt` into:
1. `data/adaptation/youtube_unified_corpus.txt`
2. `data/adaptation/unlabeled_adaptation_corpus.txt` (merging with UOM dataset)

Preserves all original individual files completely intact.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def unify_youtube_corpus(
    videos_dir: Path | str = "data/adaptation/youtube_videos",
    output_unified_youtube: Path | str = "data/adaptation/youtube_unified_corpus.txt",
    output_master_adaptation: Path | str = "data/adaptation/unlabeled_adaptation_corpus.txt",
    uom_corpus_file: Path | str = "data/adaptation/uom_codemixed_sentences.txt",
) -> None:
    vid_path = Path(videos_dir)
    out_yt = Path(output_unified_youtube)
    out_master = Path(output_master_adaptation)
    uom_path = Path(uom_corpus_file)

    if not vid_path.exists():
        print(f"Directory not found: {vid_path}")
        return

    txt_files = list(vid_path.glob("*.txt"))
    print("\n=======================================================")
    print(f" UNIFYING YOUTUBE CORPUS ({len(txt_files)} files found)")
    print("=======================================================")

    unique_youtube: set[str] = set()
    total_raw_lines = 0

    for file_path in txt_files:
        with open(file_path, encoding="utf-8", errors="ignore") as f:
            for line in f:
                total_raw_lines += 1
                cleaned = line.strip()
                # Skip commented header metadata and blank lines
                if cleaned and not cleaned.startswith("#"):
                    unique_youtube.add(cleaned)

    # 1. Save unified YouTube corpus
    out_yt.parent.mkdir(parents=True, exist_ok=True)
    with open(out_yt, "w", encoding="utf-8") as f:
        for sentence in sorted(unique_youtube):
            f.write(sentence + "\n")

    print(f"✓ Total raw lines scanned:        {total_raw_lines:,}")
    print(f"✓ Unique clean YouTube sentences:  {len(unique_youtube):,}")
    print(f"✓ Saved YouTube unified corpus to: '{out_yt.resolve()}'")

    # 2. Merge into master adaptation corpus (combining with UOM if present)
    master_set: set[str] = set(unique_youtube)

    if uom_path.exists():
        with open(uom_path, encoding="utf-8", errors="ignore") as f:
            for line in f:
                cleaned = line.strip()
                if cleaned and not cleaned.startswith("#"):
                    master_set.add(cleaned)
        print(f"✓ Merged with UOM code-mixed dataset ('{uom_path.name}')")

    with open(out_master, "w", encoding="utf-8") as f:
        for sentence in sorted(master_set):
            f.write(sentence + "\n")

    print(f"✓ Final Master Adaptation Corpus:  {len(master_set):,} total unique sentences!")
    print(f"✓ Saved Master Corpus to:          '{out_master.resolve()}'")
    print("=======================================================\n")


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent / "data" / "adaptation"
    unify_youtube_corpus(
        videos_dir=base_dir / "youtube_videos",
        output_unified_youtube=base_dir / "youtube_unified_corpus.txt",
        output_master_adaptation=base_dir / "unlabeled_adaptation_corpus.txt",
        uom_corpus_file=base_dir / "uom_codemixed_sentences.txt",
    )
