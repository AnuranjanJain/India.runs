from __future__ import annotations

from pathlib import Path

from skillbridge_recruiter.document import extract_docx_text
from skillbridge_recruiter.jd import analyze_job_text
from skillbridge_recruiter.ranker import ScoringWeights, rank_candidates, score_candidate


ROOT = Path(__file__).resolve().parents[1]


def _candidate(candidate_id: str, title: str, summary: str, company: str = "Acme Corp"):
    return {
        "candidate_id": candidate_id,
        "profile": {
            "headline": title,
            "summary": summary,
            "location": "Pune, Maharashtra",
            "country": "India",
            "years_of_experience": 7,
            "current_title": title,
            "current_company": company,
            "current_company_size": "201-500",
            "current_industry": "Software",
        },
        "career_history": [
            {
                "company": company,
                "title": title,
                "start_date": "2021-01-01",
                "end_date": None,
                "duration_months": 60,
                "is_current": True,
                "industry": "Software",
                "company_size": "201-500",
                "description": summary,
            }
        ],
        "education": [],
        "skills": [
            {"name": "Python", "proficiency": "expert", "endorsements": 40, "duration_months": 70},
            {"name": "Milvus", "proficiency": "advanced", "endorsements": 22, "duration_months": 36},
            {"name": "NLP", "proficiency": "advanced", "endorsements": 18, "duration_months": 48},
        ],
        "redrob_signals": {
            "profile_completeness_score": 91,
            "last_active_date": "2026-06-01",
            "open_to_work_flag": True,
            "recruiter_response_rate": 0.82,
            "avg_response_time_hours": 8,
            "notice_period_days": 30,
            "preferred_work_mode": "hybrid",
            "willing_to_relocate": True,
            "interview_completion_rate": 0.9,
            "verified_email": True,
            "verified_phone": True,
            "linkedin_connected": True,
            "skill_assessment_scores": {"Python": 88, "NLP": 84},
        },
    }


def test_job_docx_parses_required_signals():
    text = extract_docx_text(ROOT / "data" / "job_description.docx")
    analysis = analyze_job_text(text)
    assert "Senior AI Engineer" in analysis.title
    assert any("retrieval" in item for item in analysis.must_haves)
    assert any("consulting" in item for item in analysis.disqualifiers)


def test_strong_candidate_beats_keyword_stuffer():
    analysis = analyze_job_text("Senior AI Engineer retrieval ranking vector search evaluation Python")
    strong = _candidate(
        "CAND_0000001",
        "Senior AI Engineer",
        "Shipped production embedding retrieval and ranking systems with NDCG evaluation for SaaS users.",
    )
    stuffer = _candidate(
        "CAND_0000002",
        "Operations Manager",
        "Curious about AI. Lists LLM, LoRA, GANs, TTS, image classification, vector tools, and ChatGPT demos.",
        company="TCS",
    )
    stuffer["career_history"][0]["description"] = "Managed support operations and wrote AI productivity demos."
    strong_score = score_candidate(strong, analysis, ScoringWeights())
    stuffer_score = score_candidate(stuffer, analysis, ScoringWeights())
    assert strong_score.score > stuffer_score.score
    assert strong_score.evidence
    assert stuffer_score.risk_flags


def test_sample_ranking_returns_deterministic_top_rows():
    analysis = analyze_job_text("Senior AI Engineer retrieval ranking vector Python")
    results = rank_candidates(ROOT / "data" / "sample_candidates.json", analysis, top_n=10)
    assert len(results) == 10
    assert [row.rank for row in results] == list(range(1, 11))
    assert results == sorted(results, key=lambda row: (-row.score, row.candidate_id))
