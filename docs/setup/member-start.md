# Member handoff

Run these commands only after this bootstrap branch is merged into develop through review.

Component 2:
```sh
git switch develop
git pull origin develop
git switch -c feature/c2-pipeline-foundation
```

Component 3:
```sh
git switch develop
git pull origin develop
git switch -c feature/c3-baseline-models
```

Component 4:
```sh
git switch develop
git pull origin develop
git switch -c feature/c4-xai-dashboard
```

Component 1 next increment:
```sh
git switch develop
git pull origin develop
git switch -c feature/c1-consent-orchestration
```

Use the ownership table in [governance](../governance/ownership.md). C2 replaces the preprocessing mock and adds its dataset pipeline. C3 replaces NLP inference with a validated model adapter and owns experiments. C4 replaces the XAI mock and develops the final dashboard, explanation reliability and UI/UX. C1 maintains orchestration/auth/consent and shared integration.

Before replacing a mock, read [source differences](../governance/source-review.md), [contract policy](../api/contracts.md) and [mock replacement](mock-replacement.md). Shared changes to contracts, common libraries, root dependencies, CI, Compose or migrations require affected members' review. Database changes are coordinated through one Alembic head with C1.

Every PR runs Ruff, pytest including negative security/contract/integration tests, frontend lint/typecheck/tests, contract generation/drift checks and relevant Compose smoke tests. Keep synthetic failure/withdrawal fixtures even when real service adapters arrive. Never remove a failing safety test to enable research integration.

Data, annotation exports, notebooks with participant outputs, weights and experiment artifacts are ignored and prohibited in commits. Inspect `git diff --cached` and run the repository safety scanner. DVC may track approved metadata only; configure an approved private remote locally after governance approval. No real-data or training job belongs in public CI.
