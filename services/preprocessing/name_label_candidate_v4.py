"""Evaluated v4 label adapter, used by the experimental GLiNER demo.

The PII policy requests names, not every reference to a person. This changes
only GLiNER label prompts; offsets, scores, structured recognition and overlap
selection use the existing verified adapter. No lexical filters or name lists.
"""

from preprocessing.multilingual_candidate import MultilingualCandidate

VERSION = "gliner-name-labels-v4-offline"
PROMPTS = {"person name": "person", "location name": "location"}


class NameLabelModel:
    def __init__(self, model):
        self.model = model

    def predict_entities(self, text, labels, **kwargs):
        if labels != ["person", "location"]:
            raise ValueError("Unexpected experimental entity schema")
        predictions = self.model.predict_entities(text, list(PROMPTS), **kwargs)
        if any(item.get("label") not in PROMPTS for item in predictions):
            raise RuntimeError("Unexpected experimental model label")
        return [dict(item, label=PROMPTS[item["label"]]) for item in predictions]


def candidate(model, *, structured=None):
    options = {} if structured is None else {"structured": structured}
    return MultilingualCandidate(NameLabelModel(model), threshold=0.7, **options)
