# SkillBridge Recruiter

SkillBridge Recruiter is a recruiter-facing MVP for the Redrob candidate discovery challenge. It combines a SaaS-style webapp with a deterministic offline ranking engine that can produce the required `candidate_id,rank,score,reasoning` CSV.

## What It Does

- Analyzes the Senior AI Engineer JD into must-haves, nice-to-haves, logistics, culture signals, and disqualifiers.
- Streams candidates and ranks them using hybrid JD concept fit, career proof, seniority alignment, production AI/search evidence, skill trust, evaluation depth, Redrob behavioral signals, logistics, profile quality, explanation quality, and anti-keyword-stuffing checks.
- Shows a challenge command center, top-K explorer, dataset overview, shortlist, near misses, candidate evidence drawer, comparison view, control sliders, export, and validation.
- Generates explanations only from candidate fields so reasoning stays evidence-backed.
- Adds a Judge Brief, signal fingerprints, recruiter verdicts, proof chains, and a decision memo so reviewers can see why the product is different in under a minute.

## Why It Stands Out

- **Judge Brief**: a dedicated page explains the core thesis, guardrails, anti-keyword-stuffing strategy, and proof scorecard.
- **Signal Fingerprints**: each candidate gets compact tags for proof strength, trust, availability, logistics, and risk.
- **Proof Chain**: the detail view shows how JD intent, career evidence, trust, and penalties shaped the recommendation.
- **Recruiter Decision Memo**: export includes a human-readable shortlist summary in addition to the challenge CSV.
- **Top-K Explorer**: recruiters can inspect top 100, 250, 500, or 1000 candidates while the official challenge export remains locked to top 100.
- **Dataset Overview + Near Misses**: the app surfaces total candidate count, missing-data count, selected top-K, official export rows, and candidates just outside the cutoff.
- **Challenge-safe architecture**: the UI demo can run online, while the official ranking path remains deterministic, offline, CPU-only, and reproducible.

## Run The Webapp

```powershell
pip install -r requirements.txt
cd frontend
npm install
cd ..
$env:PYTHONPATH='backend'
python -m uvicorn skillbridge_recruiter.api:app --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd frontend
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173`.

## Offline Challenge Command

Use the full dataset when available:

```powershell
python rank.py --candidates .\data\candidates.jsonl --job .\data\job_description.docx --out .\submission.csv --top-n 1000 --diagnostics
python .\data\validate_submission.py .\submission.csv
```

`--top-n` supports `100`, `250`, `500`, and `1000` for exploration. The CSV written by `rank.py` is always the official top-100 submission format.

The repo includes `data/demo_candidates.json` with 10,000 candidates for fast local demo runs. The full local `data/candidates.jsonl` is intentionally ignored because it is large, while GitHub Pages serves the 100,000-candidate pool through static chunks under `frontend/public/data/candidate_chunks/`.

## API

- `GET /api/health`
- `GET /api/dataset/summary`
- `POST /api/jobs/analyze`
- `POST /api/rank`
- `GET /api/rank-runs`
- `GET /api/rank-runs/{run_id}`
- `GET /api/rank-runs/{run_id}/diagnostics`
- `GET /api/rank-runs/{run_id}/near-misses`
- `GET /api/candidates/{candidate_id}`
- `GET /api/candidates/{candidate_id}/explain`
- `POST /api/candidates/search`
- `POST /api/candidates/audit`
- `POST /api/compare`
- `GET /api/export/{run_id}.csv`
- `GET /api/export/{run_id}/exploration.csv`
- `POST /api/validate-submission`

## Verification

- `python -m pytest`
- `python rank.py --candidates data\demo_candidates.json --job data\job_description.docx --out data\demo_submission.csv --top-n 250 --diagnostics`
- `python data\validate_submission.py data\demo_submission.csv`
- `npm run build`
- API smoke test for dataset summary, rank, diagnostics, near misses, and export endpoints
- Browser smoke test for ranking top 100/250/500/1000 candidates and validating the official top-100 export in the UI
