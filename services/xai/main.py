"""Component 4 Explainable AI service.

Preserves the shared mock /internal/v1/explain endpoint, provides sentiment classifier prediction,
and provides real LIME and SHAP explanation endpoints with replaceable classifier interface.
"""

from __future__ import annotations

import logging

from fastapi import Depends, Request
from research_common.config import settings
from research_common.mocks import mock_app
from research_common.service_auth import service_auth
from research_common.web import SafeError
from research_contracts import (
    C4EncoderCheckRequest,
    C4EncoderCheckResponse,
    C4ExplanationRequest,
    C4ExplanationResponse,
    C4PredictionRequest,
    C4PredictionResponse,
    ErrorCode,
)

logger = logging.getLogger(__name__)

app = mock_app("xai")


def _get_or_init_classifier():
    """Retrieve active classifier or automatically initialize the temporary sentiment adapter."""
    from xai.classifier_interface import get_classifier

    classifier = get_classifier()
    if classifier is None:
        try:
            from xai.encoder_adapter import get_classifier_adapter

            classifier = get_classifier_adapter()
        except Exception as exc:
            logger.warning("Could not auto-initialize classifier: %s", exc)
            return None
    return classifier


@app.post("/internal/v1/dev/encoder-check", response_model=C4EncoderCheckResponse)
def dev_encoder_check(
    request: C4EncoderCheckRequest, http_request: Request
) -> C4EncoderCheckResponse:
    """Development-only check running input text through the pretrained base encoder."""
    if settings().environment != "development":
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not request.text or not request.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    try:
        from xai.encoder_adapter import get_encoder_adapter

        adapter = get_encoder_adapter()
        return adapter.run_check(request.text)
    except ModuleNotFoundError:
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None
    except ValueError:
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422) from None
    except Exception:
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None


@app.post("/internal/v1/dev/predict", response_model=C4PredictionResponse)
def dev_predict(
    request: C4PredictionRequest, http_request: Request
) -> C4PredictionResponse:
    """Predict sentiment (Negative, Neutral, Positive) using the temporary sentiment classifier."""
    if settings().environment != "development":
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not request.text or not request.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    classifier = _get_or_init_classifier()
    if classifier is None:
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503)

    try:
        from xai.encoder_adapter import get_classifier_adapter

        adapter = get_classifier_adapter()
        res = adapter.predict_single(request.text)
        return C4PredictionResponse(
            model_id=res["model_id"],
            model_version=res["model_version"],
            model_revision=res["model_revision"],
            predicted_sentiment=res["predicted_sentiment"],
            confidence=res["confidence"],
            probabilities=res["probabilities"],
            token_count=res["token_count"],
            truncated=res["truncated"],
            max_sequence_length=res["max_sequence_length"],
            status="READY",
            status_message="Sentiment prediction completed successfully.",
        )
    except ValueError:
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422) from None
    except Exception as exc:
        logger.exception("Prediction failed: %s", exc)
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None


@app.post(
    "/internal/v1/dev/explain",
    response_model=C4ExplanationResponse,
    dependencies=[Depends(service_auth("xai"))],
)
def dev_explain(
    request: C4ExplanationRequest, http_request: Request
) -> C4ExplanationResponse:
    """Generate real LIME or SHAP explanation using registered classifier, or report awaiting."""
    if settings().environment != "development":
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not request.text or not request.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    from xai.classifier_interface import get_classifier

    classifier = get_classifier()
    if classifier is None:
        return C4ExplanationResponse(
            method=request.method,
            status="AWAITING_CLASSIFIER_CONNECTION",
            status_message="Awaiting classifier connection",
        )

    try:
        if request.method == "LIME":
            from xai.lime_explainer import explain_with_lime

            return explain_with_lime(
                text=request.text,
                classifier=classifier,
                target_class=request.target_class,
            )
        elif request.method == "SHAP":
            from xai.shap_explainer import explain_with_shap

            return explain_with_shap(
                text=request.text,
                classifier=classifier,
                target_class=request.target_class,
            )
        else:
            raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
    except ValueError:
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422) from None
    except Exception as exc:
        logger.exception("Explanation generation failed: %s", exc)
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None
