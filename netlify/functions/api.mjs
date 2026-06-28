import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CANDIDATE_PATHS = [
  path.join(ROOT, "data", "demo_candidates.json"),
  path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../data/demo_candidates.json"),
];

const analysis = {
  title: "Senior AI Engineer - Founding Team",
  role_intent:
    "Find a senior AI engineer who has shipped production retrieval/ranking systems, can write strong Python, understands evaluation, and has product judgment for recruiter-facing matching.",
  must_haves: [
    "production embeddings-based retrieval",
    "vector database or hybrid search infrastructure",
    "strong Python",
    "ranking evaluation frameworks",
    "modern ML systems",
    "production code in the last 18 months",
  ],
  nice_to_haves: [
    "LLM fine-tuning",
    "LoRA or QLoRA or PEFT",
    "learning-to-rank",
    "HR-tech or marketplace exposure",
    "distributed systems",
    "open-source AI/ML contributions",
  ],
  disqualifiers: [
    "pure research without production deployment",
    "recent-only LangChain/OpenAI wrapper experience",
    "architecture-only senior engineer not coding recently",
    "consulting-only career history",
    "primary CV/speech/robotics expertise without NLP or IR",
  ],
  logistics: [
    "Pune or Noida preferred",
    "hybrid flexible cadence",
    "open to relocation from tier-1 Indian cities",
    "sub-30-day notice preferred",
    "5-9 years ideal range",
  ],
  culture_signals: [
    "scrappy product-engineering attitude",
    "ships working rankers quickly",
    "async-first written communication",
    "comfortable with startup ambiguity",
  ],
  keywords: [
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
    "nlp",
    "faiss",
    "milvus",
    "qdrant",
    "weaviate",
    "pinecone",
  ],
};

const consultingCompanies = new Set([
  "tcs",
  "infosys",
  "wipro",
  "accenture",
  "cognizant",
  "capgemini",
  "mindtree",
  "ltimindtree",
  "tech mahindra",
  "hcl",
]);
const irTerms = [
  "embedding",
  "retrieval",
  "ranking",
  "ranker",
  "search",
  "recommendation",
  "vector",
  "semantic",
  "faiss",
  "milvus",
  "qdrant",
  "weaviate",
  "pinecone",
  "opensearch",
  "elasticsearch",
];
const evalTerms = ["ndcg", "mrr", "map", "a/b", "evaluation", "benchmark", "metrics"];
const shipTerms = ["production", "deployed", "shipped", "launched", "owned", "scale", "users"];

let candidatesCache;

export async function handler(event) {
  const route = cleanRoute(event.path);
  const method = event.httpMethod;

  if (method === "OPTIONS") return response(204, "");
  if (method === "GET" && route === "health") {
    return json({ ok: true, product: "SkillBridge Recruiter", sample_candidates: true, job_description: true });
  }
  if (method === "POST" && route === "jobs/analyze") {
    return json({ job_id: "job_netlify_demo", analysis });
  }
  if (method === "POST" && route === "rank") {
    const payload = parseBody(event);
    const results = rankCandidates(Number(payload.top_n || 100));
    return json({
      run_id: "run_netlify_demo",
      job_id: "job_netlify_demo",
      analysis,
      results,
      metrics: metrics(results),
    });
  }
  if (method === "GET" && route === "rank-runs") {
    return json({ runs: [] });
  }
  if (method === "GET" && route.startsWith("rank-runs/")) {
    return json({ id: route.split("/")[1], job_id: "job_netlify_demo", mode: "demo", results: rankCandidates(100) });
  }
  if (method === "GET" && route.startsWith("candidates/") && route.endsWith("/explain")) {
    const id = route.split("/")[1];
    const candidate = findCandidate(id);
    if (!candidate) return json({ detail: "Candidate not found" }, 404);
    return json(scoreCandidate(candidate, 1, true));
  }
  if (method === "GET" && route.startsWith("candidates/")) {
    const id = route.split("/")[1];
    const candidate = findCandidate(id);
    if (!candidate) return json({ detail: "Candidate not found" }, 404);
    return json(candidate);
  }
  if (method === "POST" && route === "compare") {
    const payload = parseBody(event);
    const rows = (payload.candidate_ids || [])
      .map((id) => findCandidate(id))
      .filter(Boolean)
      .map((candidate, index) => scoreCandidate(candidate, index + 1, true))
      .sort((a, b) => b.score - a.score || a.candidate_id.localeCompare(b.candidate_id));
    return json({ candidates: rows });
  }
  if (method === "GET" && route.startsWith("export/")) {
    const csv = toCsv(rankCandidates(100));
    return {
      statusCode: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"skillbridge-demo.csv\"",
      },
      body: csv,
    };
  }
  if (method === "POST" && route === "validate-submission") {
    const payload = parseBody(event);
    const errors = validateCsv(String(payload.csv || ""));
    return json({ valid: errors.length === 0, errors });
  }

  return json({ detail: `Route not found: ${route}` }, 404);
}

function cleanRoute(rawPath) {
  return rawPath
    .replace(/^\/\.netlify\/functions\/api\/?/, "")
    .replace(/^\/api\/?/, "")
    .replace(/^\/+/, "");
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return {};
  }
}

function loadCandidates() {
  if (candidatesCache) return candidatesCache;
  const filePath = CANDIDATE_PATHS.find((candidatePath) => fs.existsSync(candidatePath));
  if (!filePath) throw new Error("Demo candidates file missing");
  candidatesCache = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return candidatesCache;
}

function findCandidate(id) {
  return loadCandidates().find((candidate) => candidate.candidate_id === id);
}

function rankCandidates(topN) {
  const rows = loadCandidates()
    .map((candidate, index) => scoreCandidate(candidate, index + 1, false))
    .sort((a, b) => b.score - a.score || a.candidate_id.localeCompare(b.candidate_id))
    .slice(0, Math.min(Math.max(topN, 1), 100));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function scoreCandidate(candidate, rank, includeCandidate) {
  const profile = candidate.profile || {};
  const signals = candidate.redrob_signals || {};
  const skills = candidate.skills || [];
  const career = candidate.career_history || [];
  const text = candidateText(candidate);
  const semantic_fit = coverage(text, [...analysis.keywords, ...irTerms, ...evalTerms], 16);
  const career_proof = clamp(
    coverage(text, [...irTerms, ...shipTerms], 12) * 0.7 +
      Math.min(career.filter((job) => hasAny(`${job.title} ${job.description}`, irTerms)).length / 2, 1) * 0.3,
  );
  const skill_trust = skillTrust(skills, signals);
  const evaluation_depth = coverage(text, evalTerms, 7);
  const product_startup_fit = productFit(profile, career, text);
  const behavioral_availability = behavioral(signals);
  const logistics = logisticsFit(profile, signals);
  const data_quality = dataQuality(profile, career, skills, signals);
  const components = {
    semantic_fit,
    career_proof,
    skill_trust,
    evaluation_depth,
    product_startup_fit,
    behavioral_availability,
    logistics,
    data_quality,
  };
  let score =
    semantic_fit * 0.14 +
    career_proof * 0.2 +
    skill_trust * 0.18 +
    evaluation_depth * 0.12 +
    product_startup_fit * 0.1 +
    behavioral_availability * 0.12 +
    logistics * 0.08 +
    data_quality * 0.06;
  const risks = [];
  const why = [];
  if (skill_trust > 0.55 && career_proof < 0.25) {
    score -= 0.12;
    risks.push("Possible keyword stuffing: many claimed AI skills with weaker career proof.");
    why.push("Skill claims need stronger production evidence.");
  }
  if (consultingOnly(profile, career)) {
    score -= 0.12;
    risks.push("Consulting-only career history conflicts with the JD preference.");
    why.push("Consulting-only disqualifier risk reduced final rank.");
  }
  if (behavioral_availability < 0.45) {
    risks.push("Availability risk from activity, response, or notice-period signals.");
    why.push("Lower behavioral availability score.");
  }
  if (evaluation_depth < 0.25) why.push("Limited explicit ranking-evaluation evidence.");
  if (career_proof < 0.35) why.push("Career history has limited production retrieval/ranking proof.");

  const topSkills = skills
    .slice()
    .sort((a, b) => Number(b.duration_months || 0) - Number(a.duration_months || 0))
    .slice(0, 4)
    .map((skill) => skill.name);
  const evidence = [
    {
      source: "career_history",
      text: `${profile.current_title || "Candidate"} with ${profile.years_of_experience ?? "?"} years of experience.`,
    },
    {
      source: "skills",
      text: `Relevant skills include ${topSkills.join(", ") || "limited listed skills"}.`,
    },
    {
      source: "redrob_signals",
      text: `Response rate ${Number(signals.recruiter_response_rate || 0).toFixed(2)}, notice ${
        signals.notice_period_days ?? "unknown"
      } days, profile completeness ${Number(signals.profile_completeness_score || 0).toFixed(1)}%.`,
    },
  ];
  const reasoning = `${profile.current_title || "Candidate"} with ${
    profile.years_of_experience ?? "?"
  } yrs; ${evidence[1].text}.${risks[0] ? ` Concern: ${risks[0]}` : ""}`.slice(0, 450);
  const publicRow = {
    candidate_id: candidate.candidate_id,
    rank,
    score: Number(clamp(score).toFixed(6)),
    trust_score: Number(clamp(data_quality * 0.35 + behavioral_availability * 0.25 + career_proof * 0.25 + skill_trust * 0.15).toFixed(4)),
    reasoning,
    evidence,
    risk_flags: risks,
    why_not_higher: why,
    components,
  };
  if (includeCandidate) publicRow.candidate = candidate;
  return publicRow;
}

function candidateText(candidate) {
  const profile = candidate.profile || {};
  const skills = candidate.skills || [];
  const career = candidate.career_history || [];
  return [
    profile.headline,
    profile.summary,
    profile.current_title,
    profile.current_industry,
    skills.map((skill) => skill.name).join(" "),
    career.map((job) => `${job.title} ${job.description}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function coverage(text, terms, denominator) {
  const hits = terms.filter((term) => text.includes(term.toLowerCase())).length;
  return clamp(hits / denominator);
}

function hasAny(text, terms) {
  const value = String(text || "").toLowerCase();
  return terms.some((term) => value.includes(term));
}

function skillTrust(skills, signals) {
  const assessments = signals.skill_assessment_scores || {};
  const relevant = skills.filter((skill) => hasAny(skill.name, [...irTerms, "python", "nlp", "llm", "lora", "mlops"]));
  if (!relevant.length) return 0;
  const total = relevant.reduce((sum, skill) => {
    const proficiency = { beginner: 0.35, intermediate: 0.55, advanced: 0.78, expert: 0.95 }[skill.proficiency] || 0.4;
    const duration = Math.min(Number(skill.duration_months || 0) / 36, 1);
    const endorsements = Math.min(Math.log1p(Number(skill.endorsements || 0)) / Math.log(60), 1);
    const assessment = Number(assessments[skill.name] || 0) / 100;
    return sum + proficiency * 0.45 + duration * 0.25 + endorsements * 0.15 + assessment * 0.15;
  }, 0);
  return clamp(total / relevant.length);
}

function productFit(profile, career, text) {
  const companies = [profile.current_company, ...career.map((job) => job.company)].filter(Boolean).map((company) => company.toLowerCase());
  const consultingCount = companies.filter((company) => consultingCompanies.has(company)).length;
  let score = 0.38 + coverage(text, ["product", "users", "saas", "marketplace", "startup", "series a"], 8) * 0.45;
  if (companies.length && consultingCount === companies.length) score -= 0.35;
  return clamp(score);
}

function behavioral(signals) {
  const activeDays = daysSince(signals.last_active_date);
  return clamp(
    Number(signals.recruiter_response_rate || 0) * 0.28 +
      (1 - Math.min(Number(signals.avg_response_time_hours || 999) / 168, 1)) * 0.17 +
      (1 - Math.min(activeDays / 180, 1)) * 0.2 +
      (1 - Math.min(Number(signals.notice_period_days || 180) / 120, 1)) * 0.17 +
      (signals.open_to_work_flag ? 0.1 : 0) +
      Number(signals.interview_completion_rate || 0) * 0.08,
  );
}

function logisticsFit(profile, signals) {
  const location = `${profile.location || ""} ${profile.country || ""}`.toLowerCase();
  const target = ["pune", "noida", "delhi", "gurgaon", "ncr", "mumbai", "hyderabad", "bengaluru", "bangalore"];
  let locationScore = target.some((city) => location.includes(city)) ? 1 : 0.35;
  if ((profile.country || "").toLowerCase() === "india") locationScore = Math.max(locationScore, 0.7);
  if (signals.willing_to_relocate) locationScore = Math.max(locationScore, 0.75);
  const modeScore = ["hybrid", "onsite", "flexible"].includes(String(signals.preferred_work_mode || "").toLowerCase()) ? 1 : 0.65;
  const expScore = 1 - Math.min(Math.abs(Number(profile.years_of_experience || 0) - 7) / 8, 1);
  return clamp(locationScore * 0.45 + modeScore * 0.2 + expScore * 0.35);
}

function dataQuality(profile, career, skills, signals) {
  const completeness = Number(signals.profile_completeness_score || 0) / 100;
  const verified = ["verified_email", "verified_phone", "linkedin_connected"].filter((key) => signals[key]).length / 3;
  const density = clamp((career.length / 3) * 0.35 + (skills.length / 12) * 0.45);
  const fields = ["summary", "headline", "current_title", "location"].filter((key) => profile[key]).length / 4;
  return clamp(completeness * 0.35 + verified * 0.25 + density * 0.25 + fields * 0.15);
}

function consultingOnly(profile, career) {
  const companies = [profile.current_company, ...career.map((job) => job.company)].filter(Boolean).map((company) => company.toLowerCase());
  return companies.length > 0 && companies.every((company) => consultingCompanies.has(company));
}

function daysSince(value) {
  if (!value) return 365;
  const then = new Date(`${value}T00:00:00Z`);
  const now = new Date("2026-06-28T00:00:00Z");
  return Math.max((now - then) / 86400000, 0);
}

function metrics(results) {
  if (!results.length) return { count: 0 };
  return {
    count: results.length,
    top_score: Math.max(...results.map((row) => row.score)),
    avg_score: Number((results.reduce((sum, row) => sum + row.score, 0) / results.length).toFixed(4)),
    avg_trust: Number((results.reduce((sum, row) => sum + row.trust_score, 0) / results.length).toFixed(4)),
    risk_flags: results.reduce((sum, row) => sum + row.risk_flags.length, 0),
  };
}

function toCsv(results) {
  const rows = ["candidate_id,rank,score,reasoning"];
  for (const row of results) {
    rows.push(`${row.candidate_id},${row.rank},${row.score.toFixed(6)},"${String(row.reasoning).replace(/"/g, '""')}"`);
  }
  return `${rows.join("\n")}\n`;
}

function validateCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  const errors = [];
  if (lines[0] !== "candidate_id,rank,score,reasoning") errors.push("Header must be exactly candidate_id,rank,score,reasoning");
  if (lines.length !== 101) errors.push(`Expected 100 data rows, found ${Math.max(lines.length - 1, 0)}.`);
  return errors;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function json(body, statusCode = 200) {
  return response(statusCode, JSON.stringify(body), "application/json; charset=utf-8");
}

function response(statusCode, body, contentType = "text/plain; charset=utf-8") {
  return {
    statusCode,
    headers: {
      "content-type": contentType,
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
    body,
  };
}
