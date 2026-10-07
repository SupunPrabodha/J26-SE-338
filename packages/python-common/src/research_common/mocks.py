"""Fixed synthetic outputs. No anonymization, model or explainer is implemented."""

from fastapi import Depends
from research_contracts import (
    FIXTURES,
    ErrorCode,
    ExplanationRequest,
    ExplanationResponse,
    InferenceRequest,
    InferenceResponse,
    PreprocessRequest,
    PreprocessResponse,
    ServiceContext,
)

from research_common.service_auth import service_auth
from research_common.web import SafeError, create_app


def context(body):
    return {key: getattr(body, key) for key in ServiceContext.model_fields}


def mock_app(name):
    app = create_app(name)
    authorized = Depends(service_auth(name))
    if name == "preprocessing":

        @app.post(
            "/internal/v1/preprocess", response_model=PreprocessResponse, dependencies=[authorized]
        )
        def preprocess(body: PreprocessRequest):
            if body.text not in FIXTURES.values():
                raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
            index = list(FIXTURES.values()).index(body.text)
            return PreprocessResponse(
                **context(body),
                anonymized_text=body.text,
                normalized_text=body.text,
                language=["en", "si", "romanized-si", "mixed"][index],
                tokens=[body.text],
                token_offsets=[(0, len(body.text))],
                transformations=["MOCK_IDENTITY_FIXTURE"],
            )
    elif name == "nlp":

        @app.post("/internal/v1/infer", response_model=InferenceResponse, dependencies=[authorized])
        def infer(body: InferenceRequest):
            if context(body) != context(body.preprocessing):
                raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
            return InferenceResponse(
                **context(body),
                confidence=0.5,
                stress_language_signals=["synthetic-busy-timetable"],
            )
    elif name == "xai":

        @app.post(
            "/internal/v1/explain", response_model=ExplanationResponse, dependencies=[authorized]
        )
        def explain(body: ExplanationRequest):
            if context(body) != context(body.preprocessing) or context(body) != context(
                body.inference
            ):
                raise SafeError(ErrorCode.CONTRACT_INVALID, 422)
            return ExplanationResponse(
                **context(body),
                evidence=["MOCK: fixed timetable fixture; no feature attribution was calculated."],
            )

    return app
