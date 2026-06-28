from __future__ import annotations

import csv
import heapq
import json
import math
import re
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable

from .jd import JobAnalysis, analyze_job_text


CONSULTING_COMPANIES = {
    "tcs",
    "infosys",
    "wipro",
    "accenture",
    "cognizant",
    "capgemini",
    "mindtree",
    "lti",
    "ltimindtree",
    "tech mahindra",
    "hcl",
}
PRODUCTISH_COMPANIES = {"acme corp", "stark industries", "wayne enterprises", "initech"}
AI_CORE_SKILLS = {
    "python",
    "nlp",
    "llm",
    "fine-tuning llms",
    "lora",
    "qlora",
    "peft",
    "embeddings",
    "sentence-transformers",
    "vector search",
    "retrieval",
    "ranking",
    "recommendation systems",
    "faiss",
    "milvus",
    "qdrant",
    "pinecone",
    "weaviate",
    "opensearch",
    "elasticsearch",
    "machine learning",
    "feature engineering",
    "xgboost",
    "mlops",
    "bentoml",
    "weights & biases",
}
IR_TERMS = {
    "embedding",
    "embeddings",
    "retrieval",
    "ranking",
    "ranker",
    "search",
    "recommendation",
    "recommender",
    "vector",
    "semantic",
    "faiss",
    "milvus",
    "qdrant",
    "weaviate",
    "pinecone",
    "opensearch",
    "elasticsearch",
}
EVAL_TERMS = {"ndcg", "mrr", "map", "a/b", "ab test", "offline benchmark", "evaluation", "metrics"}
SHIP_TERMS = {"production", "deployed", "shipped", "launched", "owned", "on-call", "scale", "users"}
CV_SPEECH_TERMS = {"image classification", "computer vision", "speech recognition", "tts", "gan", "robotics"}


@dataclass(slots=True)
class ScoringWeights:
    semantic_fit: float = 1.0
    career_proof: float = 1.25
    skill_trust: float = 1.15
    evaluation_depth: float = 0.9
    product_startup_fit: float = 0.75
    behavioral_availability: float = 0.9
    logistics: float = 0.65
    data_quality: float = 0.5
    anti_keyword_strictness: float = 1.0

    @classmethod
    def from_mapping(cls, value: dict[str, Any] | None) -> "ScoringWeights":
        base = cls()
        if not value:
            return base
        allowed = set(base.__dataclass_fields__)
        data = {key: float(val) for key, val in value.items() if key in allowed}
        return cls(**{**asdict(base), **data})


@dataclass(slots=True)
class CandidateScore:
    candidate_id: str
    score: float
    rank: int = 0
    trust_score: float = 0
    reasoning: str = ""
    evidence: list[dict[str, str]] = field(default_factory=list)
    risk_flags: list[str] = field(default_factory=list)
    why_not_higher: list[str] = field(default_factory=list)
    components: dict[str, float] = field(default_factory=dict)
    candidate: dict[str, Any] = field(default_factory=dict)

    def to_public_dict(self, include_candidate: bool = True) -> dict[str, Any]:
        data = {
            "candidate_id": self.candidate_id,
            "rank": self.rank,
            "score": round(self.score, 6),
            "trust_score": round(self.trust_score, 4),
            "reasoning": self.reasoning,
            "evidence": self.evidence,
            "risk_flags": self.risk_flags,
            "why_not_higher": self.why_not_higher,
            "components": {k: round(v, 4) for k, v in self.components.items()},
        }
        if include_candidate:
            data["candidate"] = self.candidate
        return data


def iter_candidates(path: str | Path) -> Iterable[dict[str, Any]]:
    candidate_path = Path(path)
    if candidate_path.suffix.lower() == ".json":
        with candidate_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            yield from data
            return
        raise ValueError("JSON candidate input must be a list of candidate objects.")
    with candidate_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def rank_candidates(
    candidates_path: str | Path,
    job_analysis: JobAnalysis | None = None,
    *,
    job_text: str | None = None,
    top_n: int = 100,
    weights: ScoringWeights | dict[str, Any] | None = None,
) -> list[CandidateScore]:
    if job_analysis is None:
        job_analysis = analyze_job_text(job_text or "")
    scoring_weights = weights if isinstance(weights, ScoringWeights) else ScoringWeights.from_mapping(weights)
    heap: list[tuple[float, int, CandidateScore]] = []
    for candidate in iter_candidates(candidates_path):
        result = score_candidate(candidate, job_analysis, scoring_weights)
        tie = -_candidate_number(result.candidate_id)
        item = (result.score, tie, result)
        if len(heap) < top_n:
            heapq.heappush(heap, item)
        elif item > heap[0]:
            heapq.heapreplace(heap, item)
    results = [item[2] for item in heap]
    results.sort(key=lambda row: (-row.score, row.candidate_id))
    for index, result in enumerate(results, start=1):
        result.rank = index
    return results


def score_candidate(
    candidate: dict[str, Any], job_analysis: JobAnalysis, weights: ScoringWeights
) -> CandidateScore:
    cid = str(candidate.get("candidate_id", "UNKNOWN"))
    profile = candidate.get("profile") or {}
    signals = candidate.get("redrob_signals") or {}
    career = candidate.get("career_history") or []
    skills = candidate.get("skills") or []
    education = candidate.get("education") or []
    text = _candidate_text(candidate)
    lower_text = text.lower()
    skill_names = [str(skill.get("name", "")) for skill in skills]
    skill_lower = {name.lower() for name in skill_names}

    semantic = _term_coverage(lower_text, job_analysis.keywords + list(IR_TERMS) + list(EVAL_TERMS))
    career_proof = _career_proof(career, lower_text)
    skill_trust = _skill_trust(skills, signals)
    eval_depth = _term_coverage(lower_text, list(EVAL_TERMS))
    product_fit = _product_startup_fit(profile, career, lower_text)
    behavioral = _behavioral_availability(signals)
    logistics = _logistics_fit(profile, signals)
    data_quality = _data_quality(profile, career, skills, signals, education)

    claimed_ai = sum(1 for skill in skill_lower if skill in AI_CORE_SKILLS or any(t in skill for t in IR_TERMS))
    proof_terms = sum(1 for term in IR_TERMS | EVAL_TERMS | SHIP_TERMS if term in lower_text)
    anti_keyword_penalty = 0.0
    if claimed_ai >= 7 and proof_terms < 4:
        anti_keyword_penalty = 0.12 * weights.anti_keyword_strictness
    if claimed_ai >= 5 and career_proof < 0.25:
        anti_keyword_penalty += 0.08 * weights.anti_keyword_strictness

    disqualifier_penalty = _disqualifier_penalty(profile, career, lower_text)
    cv_speech_bias = sum(1 for skill in skill_lower if any(term in skill for term in CV_SPEECH_TERMS))
    if cv_speech_bias >= 3 and not any(term in lower_text for term in ("nlp", "retrieval", "ranking", "search")):
        disqualifier_penalty += 0.08

    components = {
        "semantic_fit": semantic,
        "career_proof": career_proof,
        "skill_trust": skill_trust,
        "evaluation_depth": eval_depth,
        "product_startup_fit": product_fit,
        "behavioral_availability": behavioral,
        "logistics": logistics,
        "data_quality": data_quality,
    }
    weighted_sum = sum(components[key] * getattr(weights, key) for key in components)
    weight_total = sum(getattr(weights, key) for key in components)
    raw_score = weighted_sum / max(weight_total, 0.001)
    final_score = _clamp(raw_score - anti_keyword_penalty - disqualifier_penalty)
    evidence, risks, why_not = _explain(candidate, components, anti_keyword_penalty, disqualifier_penalty)
    trust_score = _clamp((data_quality * 0.35) + (behavioral * 0.25) + (career_proof * 0.25) + (skill_trust * 0.15))
    return CandidateScore(
        candidate_id=cid,
        score=final_score,
        trust_score=trust_score,
        reasoning=_reasoning(candidate, evidence, risks),
        evidence=evidence,
        risk_flags=risks,
        why_not_higher=why_not,
        components=components,
        candidate=candidate,
    )


def write_submission_csv(results: list[CandidateScore], out_path: str | Path) -> None:
    with Path(out_path).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["candidate_id", "rank", "score", "reasoning"])
        writer.writeheader()
        for result in results[:100]:
            writer.writerow(
                {
                    "candidate_id": result.candidate_id,
                    "rank": result.rank,
                    "score": f"{result.score:.6f}",
                    "reasoning": result.reasoning,
                }
            )


def _candidate_text(candidate: dict[str, Any]) -> str:
    profile = candidate.get("profile") or {}
    career = candidate.get("career_history") or []
    skills = candidate.get("skills") or []
    education = candidate.get("education") or []
    parts = [
        profile.get("headline", ""),
        profile.get("summary", ""),
        profile.get("current_title", ""),
        profile.get("current_industry", ""),
        " ".join(str(skill.get("name", "")) for skill in skills),
        " ".join(str(skill.get("proficiency", "")) for skill in skills),
        " ".join(str(job.get("title", "")) + " " + str(job.get("description", "")) for job in career),
        " ".join(str(item.get("field_of_study", "")) for item in education),
    ]
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


def _term_coverage(text: str, terms: list[str]) -> float:
    if not terms:
        return 0.0
    normalized = text.lower()
    matched = 0
    for term in terms:
        probe = term.lower().replace("-", " ")
        if probe in normalized.replace("-", " "):
            matched += 1
    return _clamp(matched / min(len(terms), 14))


def _career_proof(career: list[dict[str, Any]], lower_text: str) -> float:
    if not career:
        return 0.0
    ir = sum(1 for term in IR_TERMS if term in lower_text)
    shipping = sum(1 for term in SHIP_TERMS if term in lower_text)
    current_ai_title = any(
        title in str(job.get("title", "")).lower()
        for job in career
        for title in ("ai engineer", "ml engineer", "machine learning", "search engineer", "data scientist")
    )
    months = sum(int(job.get("duration_months") or 0) for job in career if _job_has_ir(job))
    return _clamp((ir / 10) * 0.45 + (shipping / 6) * 0.25 + min(months / 60, 1) * 0.2 + (0.1 if current_ai_title else 0))


def _job_has_ir(job: dict[str, Any]) -> bool:
    blob = f"{job.get('title', '')} {job.get('description', '')}".lower()
    return any(term in blob for term in IR_TERMS | {"ml", "machine learning", "ai"})


def _skill_trust(skills: list[dict[str, Any]], signals: dict[str, Any]) -> float:
    if not skills:
        return 0.0
    total = 0.0
    relevant = 0
    assessments = signals.get("skill_assessment_scores") or {}
    for skill in skills:
        name = str(skill.get("name", "")).lower()
        if name not in AI_CORE_SKILLS and not any(term in name for term in IR_TERMS | EVAL_TERMS):
            continue
        relevant += 1
        prof = {"beginner": 0.35, "intermediate": 0.55, "advanced": 0.78, "expert": 0.95}.get(
            str(skill.get("proficiency", "")).lower(),
            0.4,
        )
        duration = min(float(skill.get("duration_months") or 0) / 36, 1)
        endorsements = min(math.log1p(float(skill.get("endorsements") or 0)) / math.log(60), 1)
        assessment = 0.0
        for assess_name, score in assessments.items():
            if assess_name.lower() == name:
                assessment = _clamp(float(score) / 100)
                break
        total += prof * 0.45 + duration * 0.25 + endorsements * 0.15 + assessment * 0.15
    return _clamp(total / max(relevant, 1))


def _product_startup_fit(profile: dict[str, Any], career: list[dict[str, Any]], lower_text: str) -> float:
    companies = [str(profile.get("current_company", "")), *[str(job.get("company", "")) for job in career]]
    normalized = [company.lower() for company in companies if company]
    consulting_count = sum(1 for company in normalized if company in CONSULTING_COMPANIES)
    product_count = sum(1 for company in normalized if company in PRODUCTISH_COMPANIES)
    product_words = sum(1 for term in ("product", "users", "saas", "marketplace", "startup", "series a") if term in lower_text)
    score = 0.35 + min(product_count * 0.2, 0.35) + min(product_words * 0.08, 0.35)
    if normalized and consulting_count == len(normalized):
        score -= 0.35
    return _clamp(score)


def _behavioral_availability(signals: dict[str, Any]) -> float:
    if not signals:
        return 0.0
    response_rate = float(signals.get("recruiter_response_rate") or 0)
    response_time = float(signals.get("avg_response_time_hours") or 999)
    active_days = _days_since(signals.get("last_active_date"))
    recent_active = 1 - min(active_days / 180, 1)
    notice = float(signals.get("notice_period_days") or 180)
    notice_score = 1 - min(notice / 120, 1)
    open_to_work = 1 if signals.get("open_to_work_flag") else 0
    interview = float(signals.get("interview_completion_rate") or 0)
    return _clamp(
        response_rate * 0.26
        + (1 - min(response_time / 168, 1)) * 0.16
        + recent_active * 0.2
        + notice_score * 0.18
        + open_to_work * 0.12
        + interview * 0.08
    )


def _logistics_fit(profile: dict[str, Any], signals: dict[str, Any]) -> float:
    location = f"{profile.get('location', '')} {profile.get('country', '')}".lower()
    target_cities = ("pune", "noida", "delhi", "gurgaon", "ncr", "mumbai", "hyderabad", "bengaluru", "bangalore")
    location_score = 1.0 if any(city in location for city in target_cities) else 0.35
    if profile.get("country", "").lower() == "india":
        location_score = max(location_score, 0.7)
    if signals.get("willing_to_relocate"):
        location_score = max(location_score, 0.75)
    work_mode = str(signals.get("preferred_work_mode", "")).lower()
    mode_score = 1.0 if work_mode in {"hybrid", "onsite", "flexible"} else 0.65
    years = float(profile.get("years_of_experience") or 0)
    exp_score = 1 - min(abs(years - 7) / 8, 1)
    return _clamp(location_score * 0.45 + mode_score * 0.2 + exp_score * 0.35)


def _data_quality(
    profile: dict[str, Any],
    career: list[dict[str, Any]],
    skills: list[dict[str, Any]],
    signals: dict[str, Any],
    education: list[dict[str, Any]],
) -> float:
    completeness = float(signals.get("profile_completeness_score") or 0) / 100
    verified = sum(bool(signals.get(key)) for key in ("verified_email", "verified_phone", "linkedin_connected")) / 3
    density = _clamp((len(career) / 3) * 0.35 + (len(skills) / 12) * 0.45 + (len(education) / 2) * 0.2)
    profile_fields = sum(bool(profile.get(key)) for key in ("summary", "headline", "current_title", "location")) / 4
    return _clamp(completeness * 0.35 + verified * 0.25 + density * 0.25 + profile_fields * 0.15)


def _disqualifier_penalty(profile: dict[str, Any], career: list[dict[str, Any]], lower_text: str) -> float:
    penalty = 0.0
    companies = [str(profile.get("current_company", "")), *[str(job.get("company", "")) for job in career]]
    normalized = [company.lower() for company in companies if company]
    if normalized and all(company in CONSULTING_COMPANIES for company in normalized):
        penalty += 0.13
    if "research" in lower_text and not any(term in lower_text for term in SHIP_TERMS):
        penalty += 0.08
    if "langchain" in lower_text and not any(term in lower_text for term in ("retrieval", "ranking", "production")):
        penalty += 0.07
    years = float(profile.get("years_of_experience") or 0)
    if years < 3 or years > 14:
        penalty += 0.05
    return penalty


def _explain(
    candidate: dict[str, Any],
    components: dict[str, float],
    anti_keyword_penalty: float,
    disqualifier_penalty: float,
) -> tuple[list[dict[str, str]], list[str], list[str]]:
    profile = candidate.get("profile") or {}
    signals = candidate.get("redrob_signals") or {}
    skills = candidate.get("skills") or []
    career = candidate.get("career_history") or []
    top_skills = [
        str(skill.get("name"))
        for skill in sorted(skills, key=lambda item: int(item.get("duration_months") or 0), reverse=True)[:4]
    ]
    current = str(profile.get("current_title", "Candidate"))
    years = profile.get("years_of_experience", "?")
    evidence = [
        {"source": "career_history", "text": f"{current} with {years} years of experience."},
        {"source": "skills", "text": f"Relevant skills include {', '.join(top_skills[:4]) or 'limited listed skills'}."},
    ]
    if career:
        evidence.append(
            {
                "source": "career_history",
                "text": str(career[0].get("description", ""))[:180].strip(),
            }
        )
    evidence.append(
        {
            "source": "redrob_signals",
            "text": (
                f"Response rate {float(signals.get('recruiter_response_rate') or 0):.2f}, "
                f"notice {signals.get('notice_period_days', 'unknown')} days, "
                f"profile completeness {float(signals.get('profile_completeness_score') or 0):.1f}%."
            ),
        }
    )
    risks: list[str] = []
    why_not: list[str] = []
    if anti_keyword_penalty:
        risks.append("Possible keyword stuffing: many claimed AI skills with weaker career proof.")
        why_not.append("Skill claims need stronger production evidence.")
    if disqualifier_penalty:
        risks.append("JD disqualifier risk detected from career pattern or role context.")
        why_not.append("Disqualifier penalty reduced final rank.")
    if components["behavioral_availability"] < 0.45:
        risks.append("Availability risk from activity, response, or notice-period signals.")
        why_not.append("Lower behavioral availability score.")
    if components["evaluation_depth"] < 0.25:
        why_not.append("Limited explicit ranking-evaluation evidence.")
    if components["career_proof"] < 0.35:
        why_not.append("Career history has limited production retrieval/ranking proof.")
    if components["logistics"] < 0.45:
        why_not.append("Location or work-mode fit is weaker for Pune/Noida hybrid expectations.")
    return evidence, risks[:5], why_not[:5]


def _reasoning(candidate: dict[str, Any], evidence: list[dict[str, str]], risks: list[str]) -> str:
    profile = candidate.get("profile") or {}
    current = profile.get("current_title", "Candidate")
    years = profile.get("years_of_experience", "?")
    strong = evidence[1]["text"] if len(evidence) > 1 else "relevant profile evidence found"
    concern = f" Concern: {risks[0]}" if risks else ""
    return f"{current} with {years} yrs; {strong}.{concern}"[:450]


def _days_since(value: Any) -> float:
    if not value:
        return 365
    try:
        parsed = datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        return 365
    return max((date(2026, 6, 28) - parsed).days, 0)


def _candidate_number(candidate_id: str) -> int:
    match = re.search(r"(\d+)$", candidate_id)
    return int(match.group(1)) if match else 0


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))
