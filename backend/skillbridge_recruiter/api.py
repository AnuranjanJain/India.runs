from __future__ import annotations

import csv
import io
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .document import extract_docx_text
from .jd import analyze_job_text
from .ranker import (
    ScoringWeights,
    build_rank_diagnostics,
    iter_candidates,
    rank_candidates,
    score_candidate,
    summarize_candidate_file,
)
from .storage import Store


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
DEFAULT_JOB = DATA_DIR / "job_description.docx"
DEFAULT_SAMPLE = DATA_DIR / "demo_candidates.json"
DB_PATH = DATA_DIR / "skillbridge.sqlite"

app = FastAPI(title="SkillBridge Recruiter API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
store = Store(DB_PATH)


class AnalyzeJobRequest(BaseModel):
    text: str | None = None
    job_path: str | None = None


class RankRequest(BaseModel):
    candidate_path: str | None = None
    job_path: str | None = None
    job_text: str | None = None
    mode: str = Field(default="demo", pattern="^(demo|challenge|custom)$")
    top_n: int = Field(default=100, ge=100, le=1000)
    weights: dict[str, float] | None = None


class CompareRequest(BaseModel):
    candidate_ids: list[str] = Field(min_length=2, max_length=5)


class CandidateSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=120)
    candidate_path: str | None = None
    limit: int = Field(default=20, ge=1, le=50)


class CandidateAuditRequest(BaseModel):
    candidate_id: str
    candidate_path: str | None = None
    run_id: str | None = None


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "product": "SkillBridge Recruiter",
        "sample_candidates": DEFAULT_SAMPLE.exists(),
        "job_description": DEFAULT_JOB.exists(),
    }


@app.get("/api/rank-runs")
def rank_runs() -> dict[str, Any]:
    return {"runs": store.list_rank_runs()}


@app.get("/api/dataset/summary")
def dataset_summary(
    mode: str = Query(default="demo", pattern="^(demo|challenge|custom)$"),
    candidate_path: str | None = None,
) -> dict[str, Any]:
    path = _candidate_path(mode, candidate_path)
    summary = summarize_candidate_file(path)
    summary["mode"] = mode
    summary["official_export_rows"] = 100
    summary["supported_top_k"] = [100, 250, 500, 1000]
    summary["source_label"] = "Full challenge pool" if mode == "challenge" else "Demo pool"
    return summary


@app.post("/api/jobs/analyze")
def analyze_job(payload: AnalyzeJobRequest) -> dict[str, Any]:
    text = _job_text(payload.text, payload.job_path)
    analysis = analyze_job_text(text)
    job_id = store.save_job(analysis)
    return {"job_id": job_id, "analysis": analysis.to_dict()}


@app.post("/api/rank")
def rank(payload: RankRequest) -> dict[str, Any]:
    candidate_path = _candidate_path(payload.mode, payload.candidate_path)
    if not candidate_path.exists():
        raise HTTPException(status_code=404, detail=f"Candidate file not found: {candidate_path}")
    dataset = summarize_candidate_file(candidate_path)
    text = _job_text(payload.job_text, payload.job_path)
    analysis = analyze_job_text(text)
    job_id = store.save_job(analysis)
    weights = ScoringWeights.from_mapping(payload.weights)
    results = rank_candidates(
        candidate_path,
        analysis,
        top_n=payload.top_n,
        weights=weights,
    )
    run_id = store.save_rank_run(
        job_id=job_id,
        mode=payload.mode,
        candidate_path=str(candidate_path),
        weights=asdict(weights),
        results=results,
    )
    return {
        "run_id": run_id,
        "job_id": job_id,
        "analysis": analysis.to_dict(),
        "results": [result.to_public_dict(include_candidate=False) for result in results],
        "metrics": _metrics(results, dataset),
        "dataset": dataset,
        "diagnostics": build_rank_diagnostics(results, dataset.get("total_candidates")),
    }


@app.get("/api/rank-runs/{run_id}")
def get_rank_run(run_id: str) -> dict[str, Any]:
    run = store.get_rank_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Rank run not found")
    return run


@app.get("/api/rank-runs/{run_id}/diagnostics")
def rank_run_diagnostics(run_id: str) -> dict[str, Any]:
    run = store.get_rank_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Rank run not found")
    dataset = summarize_candidate_file(run["candidate_path"])
    return build_rank_diagnostics(run["results"], dataset.get("total_candidates"))


@app.get("/api/rank-runs/{run_id}/near-misses")
def rank_run_near_misses(run_id: str, start: int = 101, end: int = 125) -> dict[str, Any]:
    if start < 1 or end < start or end > 1000:
        raise HTTPException(status_code=400, detail="Use a valid rank window between 1 and 1000.")
    run = store.get_rank_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Rank run not found")
    rows = [row for row in run["results"] if start <= int(row.get("rank", 0)) <= end]
    return {"run_id": run_id, "start": start, "end": end, "candidates": rows}


@app.get("/api/candidates/{candidate_id}")
def get_candidate(candidate_id: str) -> dict[str, Any]:
    candidate = store.get_candidate(candidate_id) or _find_candidate(DEFAULT_SAMPLE, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@app.get("/api/candidates/{candidate_id}/explain")
def explain_candidate(candidate_id: str) -> dict[str, Any]:
    candidate = store.get_candidate(candidate_id) or _find_candidate(DEFAULT_SAMPLE, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    analysis = analyze_job_text(_job_text(None, None))
    result = score_candidate(candidate, analysis, ScoringWeights())
    return result.to_public_dict(include_candidate=True)


@app.post("/api/candidates/search")
def search_candidates(payload: CandidateSearchRequest) -> dict[str, Any]:
    path = _candidate_path("custom", payload.candidate_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Candidate file not found: {path}")
    query = payload.query.lower()
    matches = []
    for candidate in iter_candidates(path):
        cid = str(candidate.get("candidate_id", ""))
        profile = candidate.get("profile") or {}
        haystack = " ".join(
            [
                cid,
                str(profile.get("current_title", "")),
                str(profile.get("headline", "")),
                str(profile.get("location", "")),
                str(profile.get("current_company", "")),
            ]
        ).lower()
        if query in haystack:
            matches.append(
                {
                    "candidate_id": cid,
                    "current_title": profile.get("current_title"),
                    "location": profile.get("location"),
                    "headline": profile.get("headline"),
                }
            )
        if len(matches) >= payload.limit:
            break
    return {"matches": matches}


@app.post("/api/candidates/audit")
def audit_candidate(payload: CandidateAuditRequest) -> dict[str, Any]:
    candidate = store.get_candidate(payload.candidate_id)
    rank_row: dict[str, Any] | None = None
    if payload.run_id:
        run = store.get_rank_run(payload.run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Rank run not found")
        rank_row = next((row for row in run["results"] if row.get("candidate_id") == payload.candidate_id), None)
        if not candidate:
            candidate = _find_candidate(Path(run["candidate_path"]), payload.candidate_id)
    if not candidate:
        path = _candidate_path("custom", payload.candidate_path)
        candidate = _find_candidate(path, payload.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    analysis = analyze_job_text(_job_text(None, None))
    scored = score_candidate(candidate, analysis, ScoringWeights()).to_public_dict(include_candidate=True)
    return {
        "candidate": candidate,
        "rank_row": rank_row,
        "audit": scored,
        "in_current_run": rank_row is not None,
    }


@app.post("/api/compare")
def compare(payload: CompareRequest) -> dict[str, Any]:
    analysis = analyze_job_text(_job_text(None, None))
    rows = []
    for candidate_id in payload.candidate_ids:
        candidate = store.get_candidate(candidate_id) or _find_candidate(DEFAULT_SAMPLE, candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail=f"Candidate not found: {candidate_id}")
        rows.append(score_candidate(candidate, analysis, ScoringWeights()).to_public_dict())
    rows.sort(key=lambda item: (-item["score"], item["candidate_id"]))
    return {"candidates": rows}


@app.get("/api/export/{run_id}.csv")
def export_csv(run_id: str) -> StreamingResponse:
    run = store.get_rank_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Rank run not found")
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=["candidate_id", "rank", "score", "reasoning"])
    writer.writeheader()
    for row in run["results"][:100]:
        writer.writerow(
            {
                "candidate_id": row["candidate_id"],
                "rank": row["rank"],
                "score": f"{float(row['score']):.6f}",
                "reasoning": row["reasoning"],
            }
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{run_id}.csv"'},
    )


@app.get("/api/export/{run_id}/exploration.csv")
def export_exploration_csv(run_id: str, limit: int = Query(default=1000, ge=100, le=1000)) -> StreamingResponse:
    run = store.get_rank_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Rank run not found")
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=["candidate_id", "rank", "score", "reasoning"])
    writer.writeheader()
    for row in run["results"][:limit]:
        writer.writerow(
            {
                "candidate_id": row["candidate_id"],
                "rank": row["rank"],
                "score": f"{float(row['score']):.6f}",
                "reasoning": row["reasoning"],
            }
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{run_id}-top-{limit}.csv"'},
    )


@app.post("/api/validate-submission")
def validate_submission(payload: dict[str, Any]) -> dict[str, Any]:
    csv_text = str(payload.get("csv", ""))
    errors = _validate_submission_text(csv_text)
    return {"valid": not errors, "errors": errors}


def _job_text(text: str | None, job_path: str | None) -> str:
    if text:
        return text
    path = Path(job_path) if job_path else DEFAULT_JOB
    if path.exists() and path.suffix.lower() == ".docx":
        return extract_docx_text(path)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def _candidate_path(mode: str, candidate_path: str | None) -> Path:
    if candidate_path:
        return Path(candidate_path)
    challenge = DATA_DIR / "candidates.jsonl"
    if mode == "challenge" and challenge.exists():
        return challenge
    return DEFAULT_SAMPLE


def _find_candidate(path: Path, candidate_id: str) -> dict[str, Any] | None:
    if not path.exists():
        return None
    for candidate in iter_candidates(path):
        if candidate.get("candidate_id") == candidate_id:
            return candidate
    return None


def _metrics(results: list[Any], dataset: dict[str, Any] | None = None) -> dict[str, Any]:
    if not results:
        return {"count": 0}
    scores = [row.score for row in results]
    risks = sum(len(row.risk_flags) for row in results)
    return {
        "count": len(results),
        "selected_top_k": len(results),
        "official_export_rows": min(len(results), 100),
        "total_candidates": int((dataset or {}).get("total_candidates") or len(results)),
        "valid_candidates": int((dataset or {}).get("valid_candidates") or len(results)),
        "missing_data_candidates": int((dataset or {}).get("missing_data_candidates") or 0),
        "top_score": round(max(scores), 4),
        "avg_score": round(sum(scores) / len(scores), 4),
        "avg_trust": round(sum(row.trust_score for row in results) / len(results), 4),
        "risk_flags": risks,
    }


def _validate_submission_text(csv_text: str) -> list[str]:
    errors: list[str] = []
    reader = csv.DictReader(io.StringIO(csv_text))
    if reader.fieldnames != ["candidate_id", "rank", "score", "reasoning"]:
        return ["Header must be exactly candidate_id,rank,score,reasoning"]
    rows = list(reader)
    if len(rows) != 100:
        errors.append(f"Expected exactly 100 data rows, found {len(rows)}.")
    seen_ids: set[str] = set()
    seen_ranks: set[int] = set()
    ranked: list[tuple[int, float, str]] = []
    for index, row in enumerate(rows, start=2):
        cid = row.get("candidate_id", "")
        if not cid.startswith("CAND_") or len(cid) != 12:
            errors.append(f"Row {index}: invalid candidate_id.")
        if cid in seen_ids:
            errors.append(f"Row {index}: duplicate candidate_id.")
        seen_ids.add(cid)
        try:
            rank = int(row.get("rank", ""))
            score = float(row.get("score", ""))
        except ValueError:
            errors.append(f"Row {index}: rank must be int and score must be float.")
            continue
        if not 1 <= rank <= 100 or rank in seen_ranks:
            errors.append(f"Row {index}: invalid or duplicate rank.")
        seen_ranks.add(rank)
        ranked.append((rank, score, cid))
    ranked.sort()
    for left, right in zip(ranked, ranked[1:]):
        if left[1] < right[1]:
            errors.append(f"Score increases between rank {left[0]} and {right[0]}.")
    return errors
