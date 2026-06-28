# SkillBridge Recruiter

SkillBridge Recruiter is a recruiter-facing MVP for the Redrob candidate discovery challenge. It combines a SaaS-style webapp with a deterministic offline ranking engine that can produce the required `candidate_id,rank,score,reasoning` CSV.

## What It Does

- Analyzes the Senior AI Engineer JD into must-haves, nice-to-haves, logistics, culture signals, and disqualifiers.
- Streams candidates and ranks them using career proof, skill trust, JD fit, evaluation depth, Redrob behavioral signals, logistics, profile quality, and anti-keyword-stuffing checks.
- Shows a recruiter dashboard, shortlist, candidate evidence drawer, comparison view, control sliders, export, and validation.
- Generates explanations only from candidate fields so reasoning stays evidence-backed.
- Adds a Judge Brief, signal fingerprints, recruiter verdicts, proof chains, and a decision memo so reviewers can see why the product is different in under a minute.

## Why It Stands Out

- **Judge Brief**: a dedicated page explains the core thesis, guardrails, anti-keyword-stuffing strategy, and proof scorecard.
- **Signal Fingerprints**: each candidate gets compact tags for proof strength, trust, availability, logistics, and risk.
- **Proof Chain**: the detail view shows how JD intent, career evidence, trust, and penalties shaped the recommendation.
- **Recruiter Decision Memo**: export includes a human-readable shortlist summary in addition to the challenge CSV.
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
python rank.py --candidates .\data\candidates.jsonl --job .\data\job_description.docx --out .\submission.csv
python .\data\validate_submission.py .\submission.csv
```

The repo includes `data/demo_candidates.json` with 200 candidates for fast UI/demo export. The full `candidates.jsonl` is intentionally ignored because it is large.

## API

- `GET /api/health`
- `POST /api/jobs/analyze`
- `POST /api/rank`
- `GET /api/rank-runs`
- `GET /api/rank-runs/{run_id}`
- `GET /api/candidates/{candidate_id}`
- `GET /api/candidates/{candidate_id}/explain`
- `POST /api/compare`
- `GET /api/export/{run_id}.csv`
- `POST /api/validate-submission`

## Verification

- `python -m pytest`
- `python rank.py --candidates data\demo_candidates.json --job data\job_description.docx --out data\demo_submission.csv`
- `python data\validate_submission.py data\demo_submission.csv`
- `npm run build`
- API smoke test for health, rank, and export endpoints
- Browser smoke test for ranking 100 candidates and validating export in the UI
