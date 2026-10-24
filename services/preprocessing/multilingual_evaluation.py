"""Aggregate exact-span and masking metrics; no fixture/model execution."""


def aggregate(rows):
    keys = (
        "gold_entities",
        "predicted_entities",
        "tp",
        "fp",
        "fn",
        "missed_gold_pii",
        "partial_masking",
        "unmasked_gold_characters",
        "unnecessary_masked_characters",
    )
    totals = {key: sum(row[key] for row in rows) for key in keys}
    precision = totals["tp"] / totals["predicted_entities"] if totals["predicted_entities"] else 1.0
    recall = totals["tp"] / totals["gold_entities"] if totals["gold_entities"] else 1.0
    totals.update(
        precision=precision,
        recall=recall,
        f1=2 * precision * recall / (precision + recall) if precision + recall else 0.0,
    )
    return totals
