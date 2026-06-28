from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from skillbridge_recruiter.document import extract_docx_text  # noqa: E402
from skillbridge_recruiter.jd import analyze_job_text  # noqa: E402
from skillbridge_recruiter.ranker import ScoringWeights, rank_candidates, write_submission_csv  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="SkillBridge Recruiter offline ranker")
    parser.add_argument("--candidates", required=True, help="Path to candidates.jsonl or sample_candidates.json")
    parser.add_argument("--job", default="data/job_description.docx", help="Path to job description docx/txt")
    parser.add_argument("--out", default="submission.csv", help="Output CSV path")
    parser.add_argument("--top-n", type=int, default=100, choices=range(1, 101), metavar="[1-100]")
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
    print(f"Wrote {len(results)} ranked candidates to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
