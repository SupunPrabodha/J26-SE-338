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
    C4CounterfactualRequest,
    C4CounterfactualResponse,
    C4EncoderCheckRequest,
    C4EncoderCheckResponse,
    C4ExplanationRequest,
    C4ExplanationResponse,
    C4FaithfulnessResponse,
    C4InternalFaithfulnessRequest,
    C4InternalStabilityRequest,
    C4ManualEvaluationRequest,
    C4ManualEvaluationResponse,
    C4PredictionRequest,
    C4PredictionResponse,
    C4StabilityResponse,
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


@app.post(
    "/internal/v1/dev/encoder-check",
    response_model=C4EncoderCheckResponse,
    dependencies=[Depends(service_auth("xai"))],
)
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


@app.post(
    "/internal/v1/dev/predict",
    response_model=C4PredictionResponse,
    dependencies=[Depends(service_auth("xai"))],
)
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

    classifier = _get_or_init_classifier()
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


@app.post(
    "/internal/v1/dev/counterfactuals",
    response_model=C4CounterfactualResponse,
    dependencies=[Depends(service_auth("xai"))],
)
def dev_counterfactuals(
    request: C4CounterfactualRequest, http_request: Request
) -> C4CounterfactualResponse:
    """Generate model-backed counterfactuals using bounded candidate search."""
    if settings().environment != "development":
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not request.text or not request.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    classifier = _get_or_init_classifier()
    if classifier is None:
        return C4CounterfactualResponse(
            target_class=request.target_class,
            outcome="UNAVAILABLE_MODEL",
            outcome_message="Sentiment classifier model is unavailable.",
        )

    try:
        from xai.counterfactual_generator import generate_counterfactuals

        return generate_counterfactuals(request, classifier)
    except ValueError:
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422) from None
    except Exception as exc:
        logger.exception("Counterfactual generation failed: %s", exc)
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None


@app.post(
    "/internal/v1/dev/counterfactuals/manual",
    response_model=C4ManualEvaluationResponse,
    dependencies=[Depends(service_auth("xai"))],
)
def dev_manual_counterfactual(
    request: C4ManualEvaluationRequest, http_request: Request
) -> C4ManualEvaluationResponse:
    """Evaluate counsellor manual edit against original text with verified model probabilities."""
    if settings().environment != "development":
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not request.original_text or not request.original_text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
    if not request.edited_text or not request.edited_text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    classifier = _get_or_init_classifier()
    if classifier is None:
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503)

    try:
        from xai.counterfactual_generator import evaluate_manual_edit

        return evaluate_manual_edit(request, classifier)
    except ValueError:
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422) from None
    except Exception as exc:
        logger.exception("Manual counterfactual evaluation failed: %s", exc)
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None


@app.post(
    "/internal/v1/dev/faithfulness",
    response_model=C4FaithfulnessResponse,
    dependencies=[Depends(service_auth("xai"))],
)
def dev_faithfulness(
    request: C4InternalFaithfulnessRequest, http_request: Request
) -> C4FaithfulnessResponse:
    """Evaluate explanation faithfulness using real progressive token deletion, retention, and random baseline."""
    if settings().environment != "development":
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not request.text or not request.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    classifier = _get_or_init_classifier()
    if classifier is None:
        return C4FaithfulnessResponse(
            explanation_id=request.explanation_id,
            method=request.method,
            explained_class=request.explained_class,
            baseline_probability=0.0,
            outcome="UNAVAILABLE_MODEL",
            outcome_message="Sentiment classifier model is unavailable.",
        )

    try:
        from xai.faithfulness_evaluator import evaluate_faithfulness

        return evaluate_faithfulness(request, classifier)
    except ValueError:
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422) from None
    except Exception as exc:
        logger.exception("Faithfulness evaluation failed: %s", exc)
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None


@app.post(
    "/internal/v1/dev/stability",
    response_model=C4StabilityResponse,
    dependencies=[Depends(service_auth("xai"))],
)
def dev_stability(
    request: C4InternalStabilityRequest, http_request: Request
) -> C4StabilityResponse:
    """Evaluate repeated-run stability of a LIME or SHAP explanation using fresh computations and distinct seeds."""
    if settings().environment != "development":
        raise SafeError(ErrorCode.FORBIDDEN, 403)

    if not request.text or not request.text.strip():
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422)

    classifier = _get_or_init_classifier()
    if classifier is None:
        return C4StabilityResponse(
            explanation_id=request.explanation_id,
            method=request.method,
            explained_class=request.explained_class,
            baseline_probability=0.0,
            outcome="UNAVAILABLE_MODEL",
            outcome_message="Sentiment classifier model is unavailable.",
        )

    try:
        from xai.stability_evaluator import evaluate_stability

        return evaluate_stability(request, classifier)
    except ValueError:
        raise SafeError(ErrorCode.CONTRACT_INVALID, 422) from None
    except Exception as exc:
        logger.exception("Stability evaluation failed: %s", exc)
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None



