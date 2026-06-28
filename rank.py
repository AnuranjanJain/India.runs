from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from skillbridge_recruiter.document import extract_docx_text  # noqa: E402
from skillbridge_recruiter.jd import analyze_job_text  # noqa: E402
from skillbridge_recruiter.ranker import (  # noqa: E402
    ScoringWeights,
    build_rank_diagnostics,
    rank_candidates,
    summarize_candidate_file,
    write_submission_csv,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="SkillBridge Recruiter offline ranker")
    parser.add_argument("--candidates", required=True, help="Path to candidates.jsonl or sample_candidates.json")
    parser.add_argument("--job", default="data/job_description.docx", help="Path to job description docx/txt")
    parser.add_argument("--out", default="submission.csv", help="Output CSV path")
    parser.add_argument("--top-n", type=int, default=100, choices=[100, 250, 500, 1000])
    parser.add_argument("--diagnostics", action="store_true", help="Print ranking diagnostics after writing the official top-100 CSV")
    args = parser.parse_args()

    job_path = Path(args.job)
    if job_path.suffix.lower() == ".docx":
        job_text = extract_docx_text(job_path)
    else:
        job_text = job_path.read_text(encoding="utf-8")
    analysis = analyze_job_text(job_text)
    results = rank_candidates(
        args.candidates,
        analysis,
        top_n=args.top_n,
        weights=ScoringWeights(),
    )
    write_submission_csv(results, args.out)
    print(f"Wrote official top-100 CSV to {args.out} from top-{len(results)} exploration results")
    if args.diagnostics:
        dataset = summarize_candidate_file(args.candidates)
        diagnostics = build_rank_diagnostics(results, dataset.get("total_candidates"))
        print(f"Dataset candidates: {dataset.get('total_candidates', 0)}")
        print(f"Official export rows: {diagnostics.get('official_export_rows', 0)}")
        print(f"Exploration rows: {diagnostics.get('exploration_rows', 0)}")
        print(f"Score bands: {diagnostics.get('score_bands', {})}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
