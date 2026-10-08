"""
Data Loader & Splitter for Stage A Benchmarks (Dreaddit & GoEmotions).
Owner: C3 - Ramanayake R. H. B. D. G. (IT23164130)

Handles downloading, preprocessing, and fixed 80/20 stratified splitting.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Tuple

import pandas as pd
from sklearn.model_selection import train_test_split


def clean_text(text: str) -> str:
    """Basic text sanitization: normalizes whitespace and removes URL noise."""
    if not isinstance(text, str):
        return ""
    text = re.sub(r"http\S+|www\.\S+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def load_dreaddit_dataset(
    data_dir: Path | str = "data/dreaddit",
    test_size: float = 0.20,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Downloads and splits the Dreaddit dataset into 80% train and 20% test.
    
    Returns:
        (train_df, test_df) containing columns ['text', 'label']
    """
    data_path = Path(data_dir)
    data_path.mkdir(parents=True, exist_ok=True)
    
    train_cache = data_path / "dreaddit_train_80.csv"
    test_cache = data_path / "dreaddit_test_20.csv"
    
    if train_cache.exists() and test_cache.exists():
        print(f"[Dreaddit] Loading cached splits from {data_path}...")
        return pd.read_csv(train_cache), pd.read_csv(test_cache)

    print("[Dreaddit] Fetching dataset from Hugging Face...")
    from datasets import load_dataset  # type: ignore
    ds = load_dataset("andreagasparini/dreaddit")
    records = []
    for split_name in ds.keys():
        for item in ds[split_name]:
            text = clean_text(item.get("text", ""))
            if len(text) > 10:
                records.append({
                    "text": text,
                    "label": int(item.get("label", 0))
                })
    df_combined = pd.DataFrame(records).dropna().drop_duplicates(subset=["text"]).reset_index(drop=True)
    
    # 80/20 stratified split
    train_df, test_df = train_test_split(
        df_combined,
        test_size=test_size,
        random_state=random_state,
        stratify=df_combined["label"],
    )
    
    train_df.to_csv(train_cache, index=False)
    test_df.to_csv(test_cache, index=False)
    print(f"[Dreaddit] Saved splits -> Train: {len(train_df)} samples, Test: {len(test_df)} samples")
    return train_df, test_df


# Ekman emotion taxonomy mapping (GoEmotions index mapping)
EKMAN_MAPPING = {
    # anger
    2: 0, 3: 0, 10: 0,
    # disgust
    11: 1,
    # fear / nervousness
    18: 2,
    # joy / positive
    0: 3, 1: 3, 4: 3, 8: 3, 13: 3, 14: 3, 16: 3, 17: 3, 19: 3, 20: 3, 21: 3, 5: 3,
    # sadness / negative
    9: 4, 12: 4, 15: 4, 22: 4, 23: 4,
    # surprise
    6: 5, 7: 5, 24: 5,
    # neutral
    27: 6
}

EKMAN_LABELS = {
    0: "anger",
    1: "disgust",
    2: "fear",
    3: "joy",
    4: "sadness",
    5: "surprise",
    6: "neutral"
}


def load_goemotions_dataset(
    data_dir: Path | str = "data/goemotions",
    test_size: float = 0.20,
    random_state: int = 42,
    use_ekman: bool = True,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Downloads and splits the GoEmotions dataset from Hugging Face.
    
    Args:
        data_dir: Local path to cache split CSVs.
        test_size: Fraction of samples reserved for test (0.20 = 20%).
        random_state: Fixed random seed for reproducibility.
        use_ekman: If True, maps fine-grained emotions into 7 Ekman groups.
        
    Returns:
        (train_df, test_df) containing columns ['text', 'label']
    """
    data_path = Path(data_dir)
    data_path.mkdir(parents=True, exist_ok=True)
    
    suffix = "ekman" if use_ekman else "full"
    train_cache = data_path / f"goemotions_{suffix}_train_80.csv"
    test_cache = data_path / f"goemotions_{suffix}_test_20.csv"
    
    if train_cache.exists() and test_cache.exists():
        print(f"[GoEmotions] Loading cached splits from {data_path}...")
        return pd.read_csv(train_cache), pd.read_csv(test_cache)

    print("[GoEmotions] Fetching dataset from Hugging Face...")
    from datasets import load_dataset  # type: ignore
    ds = load_dataset("google-research-datasets/go_emotions", "simplified")
    
    combined_records = []
    for split_name in ds.keys():
        for item in ds[split_name]:
            text = clean_text(item.get("text", ""))
            labels = item.get("labels", [])
            if labels and len(text) > 5:
                raw_label = labels[0]
                if use_ekman:
                    if raw_label in EKMAN_MAPPING:
                        label = EKMAN_MAPPING[raw_label]
                        combined_records.append({"text": text, "label": label, "label_name": EKMAN_LABELS[label]})
                else:
                    combined_records.append({"text": text, "label": raw_label})
                    
    df_all = pd.DataFrame(combined_records).drop_duplicates(subset=["text"]).reset_index(drop=True)
    
    # 80/20 stratified split
    train_df, test_df = train_test_split(
        df_all,
        test_size=test_size,
        random_state=random_state,
        stratify=df_all["label"],
    )
    
    train_df.to_csv(train_cache, index=False)
    test_df.to_csv(test_cache, index=False)
    print(f"[GoEmotions] Saved splits -> Train: {len(train_df)} samples, Test: {len(test_df)} samples")
    return train_df, test_df


if __name__ == "__main__":
    print("=== Testing Stage A Data Loading & Splitting ===")
    d_train, d_test = load_dreaddit_dataset(data_dir="data/dreaddit")
    print(f"Dreaddit Balance:\n{d_train['label'].value_counts(normalize=True)}\n")
    
    g_train, g_test = load_goemotions_dataset(data_dir="data/goemotions", use_ekman=True)
    print(f"GoEmotions Ekman Distribution:\n{g_train['label_name'].value_counts(normalize=True)}\n")
