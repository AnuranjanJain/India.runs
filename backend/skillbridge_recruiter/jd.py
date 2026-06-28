from __future__ import annotations

import re
from dataclasses import asdict, dataclass

from .document import normalize_text


@dataclass(slots=True)
class JobAnalysis:
    title: str
    role_intent: str
    must_haves: list[str]
    nice_to_haves: list[str]
    disqualifiers: list[str]
    logistics: list[str]
    culture_signals: list[str]
    keywords: list[str]
    raw_text: str

    def to_dict(self) -> dict:
        return asdict(self)


MUST_HAVE_TERMS = [
    "production embeddings-based retrieval",
    "vector database or hybrid search infrastructure",
    "strong python",
    "ranking evaluation frameworks",
    "modern ML systems",
    "retrieval and ranking before LLM hype",
    "production code in the last 18 months",
]

NICE_TO_HAVE_TERMS = [
    "LLM fine-tuning",
    "LoRA or QLoRA or PEFT",
    "learning-to-rank",
    "HR-tech or recruiting marketplace exposure",
    "distributed systems",
    "open-source AI/ML contributions",
]

DISQUALIFIERS = [
    "pure research without production deployment",
    "recent-only LangChain/OpenAI wrapper experience",
    "architecture-only senior engineer not coding recently",
    "consulting-only career history",
    "primary CV/speech/robotics expertise without NLP or IR",
    "closed-source-only work without external validation",
    "title-chasing frequent switches",
]

CULTURE_SIGNALS = [
    "scrappy product-engineering attitude",
    "ships working rankers quickly",
    "async-first written communication",
    "open disagreement and quick decisions",
    "comfortable with startup ambiguity",
]

LOGISTICS = [
    "Pune or Noida preferred",
    "hybrid flexible cadence",
    "open to relocation from tier-1 Indian cities",
    "sub-30-day notice preferred",
    "full-time role",
    "5-9 years ideal range",
]


def analyze_job_text(text: str) -> JobAnalysis:
    cleaned = normalize_text(text)
    lower = cleaned.lower()
    title = _extract_title(cleaned)
    keywords = _dedupe(
        [
            "python",
            "embedding",
            "retrieval",
            "ranking",
            "search",
            "vector",
            "llm",
            "fine-tuning",
            "evaluation",
            "ndcg",
            "mrr",
            "map",
            "a/b testing",
            "nlp",
            "faiss",
            "milvus",
            "qdrant",
            "weaviate",
            "pinecone",
            "opensearch",
            "elasticsearch",
            "product company",
            "startup",
        ]
    )
    role_intent = (
        "Find a senior AI engineer who has shipped production retrieval/ranking systems, "
        "can write strong Python, understands evaluation, and has the product judgment to "
        "improve recruiter-facing matching in a fast-moving startup."
    )
    return JobAnalysis(
        title=title,
        role_intent=role_intent,
        must_haves=_present_or_default(lower, MUST_HAVE_TERMS),
        nice_to_haves=_present_or_default(lower, NICE_TO_HAVE_TERMS),
        disqualifiers=_present_or_default(lower, DISQUALIFIERS),
        logistics=_present_or_default(lower, LOGISTICS),
        culture_signals=_present_or_default(lower, CULTURE_SIGNALS),
        keywords=keywords,
        raw_text=cleaned,
    )


def _extract_title(text: str) -> str:
    match = re.search(r"Job Description:\s*([^\n-]+(?:-[^\n]+)?)", text, flags=re.I)
    if match:
        return match.group(1).strip()
    return "Senior AI Engineer"


def _present_or_default(lower_text: str, items: list[str]) -> list[str]:
    present = []
    for item in items:
        probes = [part.strip().lower() for part in re.split(r"\bor\b|/|,", item) if part.strip()]
        tokens = [token for token in re.findall(r"[a-z0-9]+", item.lower()) if len(token) > 4]
        if any(probe and probe in lower_text for probe in probes) or any(token in lower_text for token in tokens):
            present.append(item)
    return present or items


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out
