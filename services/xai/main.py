"""Component 4 Explainable AI service.

Preserves the shared mock /internal/v1/explain endpoint, provides base encoder check,
and provides real LIME and SHAP explanation endpoints with replaceable classifier interface.
"""

from fastapi import Request
from research_common.config import settings
from research_common.mocks import mock_app
from research_common.web import SafeError
from research_contracts import (
    C4EncoderCheckRequest,
    C4EncoderCheckResponse,
    C4ExplanationRequest,
    C4ExplanationResponse,
    ErrorCode,
)

app = mock_app("xai")


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


@app.post("/internal/v1/dev/explain", response_model=C4ExplanationResponse)
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
    except Exception:
        raise SafeError(ErrorCode.INTERNAL_ERROR, 500) from None
