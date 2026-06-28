import React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Filter,
  Gauge,
  GitCompare,
  Layers3,
  Loader2,
  MapPin,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  X
} from "lucide-react";
import "./styles.css";

const API = "";
const STATIC_DATA_URL = `${import.meta.env.BASE_URL}data/demo_candidates.json`;

type JobAnalysis = {
  title: string;
  role_intent: string;
  must_haves: string[];
  nice_to_haves: string[];
  disqualifiers: string[];
  logistics: string[];
  culture_signals: string[];
  keywords: string[];
};

type CandidateResult = {
  candidate_id: string;
  rank: number;
  score: number;
  trust_score: number;
  reasoning: string;
  evidence: Array<{ source: string; text: string }>;
  risk_flags: string[];
  why_not_higher: string[];
  components: Record<string, number>;
  candidate?: Candidate;
};

type Candidate = {
  candidate_id: string;
  profile: {
    anonymized_name?: string;
    headline?: string;
    summary?: string;
    location?: string;
    country?: string;
    years_of_experience?: number;
    current_title?: string;
    current_company?: string;
  };
  career_history?: Array<{ company: string; title: string; duration_months: number; description: string }>;
  skills?: Array<{ name: string; proficiency: string; endorsements: number; duration_months: number }>;
  redrob_signals?: Record<string, unknown>;
};

type RankResponse = {
  run_id: string;
  job_id: string;
  analysis: JobAnalysis;
  results: CandidateResult[];
  metrics: Record<string, number>;
};

type Weights = {
  semantic_fit: number;
  career_proof: number;
  skill_trust: number;
  evaluation_depth: number;
  product_startup_fit: number;
  behavioral_availability: number;
  logistics: number;
  data_quality: number;
  anti_keyword_strictness: number;
};

const defaultWeights: Weights = {
  semantic_fit: 1,
  career_proof: 1.25,
  skill_trust: 1.15,
  evaluation_depth: 0.9,
  product_startup_fit: 0.75,
  behavioral_availability: 0.9,
  logistics: 0.65,
  data_quality: 0.5,
  anti_keyword_strictness: 1
};

const tabs = [
  ["dashboard", "Dashboard", BarChart3],
  ["jd", "JD Intelligence", BrainCircuit],
  ["shortlist", "Shortlist", UserCheck],
  ["compare", "Compare", GitCompare],
  ["control", "Control Room", SlidersHorizontal],
  ["export", "Export", Download]
] as const;

function App() {
  const [active, setActive] = React.useState<(typeof tabs)[number][0]>("dashboard");
  const [rankData, setRankData] = React.useState<RankResponse | null>(null);
  const [selected, setSelected] = React.useState<CandidateResult | null>(null);
  const [candidateDetail, setCandidateDetail] = React.useState<Candidate | null>(null);
  const [weights, setWeights] = React.useState<Weights>(defaultWeights);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const [compareRows, setCompareRows] = React.useState<CandidateResult[]>([]);

  const runRank = async (mode = "demo") => {
    setLoading(true);
    setError("");
    try {
      let data: RankResponse;
      const response = await fetch(`${API}/api/rank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, top_n: 100, weights })
      });
      if (response.ok) {
        data = (await response.json()) as RankResponse;
      } else {
        data = await rankStaticDemo(weights);
      }
      setRankData(data);
      setSelected(data.results[0] ?? null);
      setActive("shortlist");
    } catch (err) {
      try {
        const data = await rankStaticDemo(weights);
        setRankData(data);
        setSelected(data.results[0] ?? null);
        setActive("shortlist");
      } catch {
        setError(err instanceof Error ? err.message : "Ranking failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const openCandidate = async (row: CandidateResult) => {
    setSelected(row);
    setCandidateDetail(null);
    try {
      const response = await fetch(`${API}/api/candidates/${row.candidate_id}`);
      if (response.ok) {
        setCandidateDetail((await response.json()) as Candidate);
        return;
      }
    } catch {
      // Static deploy fallback below.
    }
    setCandidateDetail(await findStaticCandidate(row.candidate_id));
  };

  const runCompare = async () => {
    if (compareIds.length < 2) return;
    try {
      const response = await fetch(`${API}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_ids: compareIds })
      });
      if (response.ok) {
        const data = await response.json();
        setCompareRows(data.candidates);
        return;
      }
    } catch {
      // Static deploy fallback below.
    }
    const data = await rankStaticDemo(weights);
    setCompareRows(
      data.results
        .filter((row) => compareIds.includes(row.candidate_id))
        .sort((a, b) => b.score - a.score || a.candidate_id.localeCompare(b.candidate_id))
    );
  };

  const analysis = rankData?.analysis;
  const results = rankData?.results ?? [];
  const selectedFull = candidateDetail ?? selected?.candidate;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Layers3 size={20} /></div>
          <div>
            <strong>SkillBridge</strong>
            <span>Recruiter OS</span>
          </div>
        </div>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => setActive(id)}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="status-box">
          <ShieldCheck size={18} />
          <div>
            <strong>Challenge-safe</strong>
            <span>Offline CPU ranker, evidence-only reasoning.</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Redrob Candidate Discovery</p>
            <h1>{activeTitle(active)}</h1>
          </div>
          <div className="actions">
            <button className="ghost-button" onClick={() => setActive("control")} title="Open Control Room">
              <Settings2 size={17} /> Settings
            </button>
            <button className="primary-button" onClick={() => runRank("demo")} disabled={loading}>
              {loading ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
              Rank Demo Pool
            </button>
          </div>
        </header>

        {error && <div className="error-strip"><AlertTriangle size={16} /> {error}</div>}

        {active === "dashboard" && (
          <Dashboard data={rankData} onRun={() => runRank("demo")} loading={loading} />
        )}
        {active === "jd" && <JDIntelligence analysis={analysis} />}
        {active === "shortlist" && (
          <Shortlist results={results} selected={selected} onSelect={openCandidate} selectedFull={selectedFull} />
        )}
        {active === "compare" && (
          <Compare
            results={results}
            compareIds={compareIds}
            setCompareIds={setCompareIds}
            rows={compareRows}
            onCompare={runCompare}
          />
        )}
        {active === "control" && (
          <ControlRoom weights={weights} setWeights={setWeights} onRun={() => runRank("custom")} />
        )}
        {active === "export" && <ExportPanel runId={rankData?.run_id} results={results} />}
      </main>
    </div>
  );
}

function Dashboard({ data, onRun, loading }: { data: RankResponse | null; onRun: () => void; loading: boolean }) {
  const metrics = data?.metrics;
  return (
    <section className="grid-page">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Recruiter-grade ranking</p>
          <h2>Find the people a keyword filter would miss.</h2>
          <p>
            SkillBridge Recruiter reads the role, weighs career proof and Redrob behavior, then produces a shortlist with evidence, risk flags, and export-ready rankings.
          </p>
        </div>
        <button className="primary-button large" onClick={onRun} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />} Start Ranking
        </button>
      </div>
      <div className="metric-grid">
        <Metric label="Top score" value={fmt(metrics?.top_score)} icon={<Gauge />} />
        <Metric label="Avg trust" value={fmt(metrics?.avg_trust)} icon={<ShieldCheck />} />
        <Metric label="Candidates" value={String(metrics?.count ?? 0)} icon={<BriefcaseBusiness />} />
        <Metric label="Risk flags" value={String(metrics?.risk_flags ?? 0)} icon={<AlertTriangle />} />
      </div>
      <div className="wide-band">
        <PanelTitle icon={<ClipboardCheck />} title="What the system evaluates" />
        <div className="signal-grid">
          {[
            "JD intent and hidden disqualifiers",
            "Career-history proof, not claim volume",
            "Skill trust from duration, proficiency, assessments",
            "Behavioral availability and recruiter response",
            "Location, notice, work-mode, salary fit",
            "Anti-keyword-stuffing and profile-quality checks"
          ].map((item) => <span key={item}><CheckCircle2 size={15} />{item}</span>)}
        </div>
      </div>
    </section>
  );
}

function JDIntelligence({ analysis }: { analysis?: JobAnalysis }) {
  const fallback = "Run the demo ranker to analyze the provided Senior AI Engineer job description.";
  return (
    <section className="content-grid">
      <div className="main-panel">
        <PanelTitle icon={<BrainCircuit />} title={analysis?.title ?? "JD Intelligence"} />
        <p className="lead">{analysis?.role_intent ?? fallback}</p>
        <div className="chips">{(analysis?.keywords ?? []).slice(0, 18).map((k) => <span key={k}>{k}</span>)}</div>
      </div>
      <InsightList title="Must-haves" items={analysis?.must_haves} tone="green" />
      <InsightList title="Nice-to-haves" items={analysis?.nice_to_haves} tone="blue" />
      <InsightList title="Disqualifiers" items={analysis?.disqualifiers} tone="red" />
      <InsightList title="Logistics" items={analysis?.logistics} tone="amber" />
      <InsightList title="Culture Signals" items={analysis?.culture_signals} tone="slate" />
    </section>
  );
}

function Shortlist({
  results,
  selected,
  onSelect,
  selectedFull
}: {
  results: CandidateResult[];
  selected: CandidateResult | null;
  onSelect: (row: CandidateResult) => void;
  selectedFull?: Candidate | null;
}) {
  return (
    <section className="shortlist-layout">
      <div className="table-panel">
        <div className="table-tools">
          <PanelTitle icon={<Filter />} title="Trusted Shortlist" />
          <span>{results.length || 0} ranked candidates</span>
        </div>
        <div className="candidate-list">
          {results.length === 0 && <EmptyState text="Run the demo ranker to generate a shortlist." />}
          {results.map((row) => (
            <button
              key={row.candidate_id}
              className={selected?.candidate_id === row.candidate_id ? "candidate-row selected" : "candidate-row"}
              onClick={() => onSelect(row)}
            >
              <strong>#{row.rank}</strong>
              <div>
                <span>{row.candidate_id}</span>
                <small>{row.reasoning}</small>
              </div>
              <ScoreBadge score={row.score} />
            </button>
          ))}
        </div>
      </div>
      <CandidateDrawer row={selected} candidate={selectedFull} />
    </section>
  );
}

function CandidateDrawer({ row, candidate }: { row: CandidateResult | null; candidate?: Candidate | null }) {
  if (!row) return <aside className="detail-panel"><EmptyState text="Select a candidate to inspect evidence." /></aside>;
  const profile = candidate?.profile ?? {};
  return (
    <aside className="detail-panel">
      <div className="drawer-head">
        <div>
          <p className="eyebrow">Rank #{row.rank}</p>
          <h2>{profile.current_title ?? row.candidate_id}</h2>
          <span>{profile.current_company ?? "Candidate"} · {profile.location ?? "Location unknown"}</span>
        </div>
        <ScoreBadge score={row.score} />
      </div>
      <div className="component-bars">
        {Object.entries(row.components).map(([key, value]) => (
          <div key={key}>
            <label>{labelize(key)}<span>{Math.round(value * 100)}%</span></label>
            <meter min={0} max={1} value={value} />
          </div>
        ))}
      </div>
      <EvidenceBlock title="Evidence Mode" items={row.evidence.map((e) => `${labelize(e.source)}: ${e.text}`)} />
      <EvidenceBlock title="Why not higher?" items={row.why_not_higher} muted />
      <EvidenceBlock title="Risk flags" items={row.risk_flags} danger />
      <div className="skill-cloud">
        {(candidate?.skills ?? []).slice(0, 12).map((skill) => <span key={skill.name}>{skill.name}</span>)}
      </div>
    </aside>
  );
}

function Compare({
  results,
  compareIds,
  setCompareIds,
  rows,
  onCompare
}: {
  results: CandidateResult[];
  compareIds: string[];
  setCompareIds: (ids: string[]) => void;
  rows: CandidateResult[];
  onCompare: () => void;
}) {
  const toggle = (id: string) => {
    if (compareIds.includes(id)) setCompareIds(compareIds.filter((item) => item !== id));
    else if (compareIds.length < 5) setCompareIds([...compareIds, id]);
  };
  return (
    <section className="content-grid">
      <div className="main-panel">
        <PanelTitle icon={<GitCompare />} title="Candidate Comparison" />
        <p className="lead">Select 2-5 candidates and compare fit, trust, evidence, and risks side by side.</p>
        <div className="compare-picks">
          {results.slice(0, 20).map((row) => (
            <button key={row.candidate_id} className={compareIds.includes(row.candidate_id) ? "pick active" : "pick"} onClick={() => toggle(row.candidate_id)}>
              #{row.rank} {row.candidate_id}
            </button>
          ))}
        </div>
        <button className="primary-button" onClick={onCompare} disabled={compareIds.length < 2}>Compare Selected</button>
      </div>
      <div className="compare-grid">
        {rows.map((row) => (
          <article className="compare-card" key={row.candidate_id}>
            <strong>#{row.rank} {row.candidate_id}</strong>
            <ScoreBadge score={row.score} />
            <p>{row.reasoning}</p>
            <EvidenceBlock title="Risks" items={row.risk_flags} danger />
          </article>
        ))}
      </div>
    </section>
  );
}

function ControlRoom({ weights, setWeights, onRun }: { weights: Weights; setWeights: (weights: Weights) => void; onRun: () => void }) {
  return (
    <section className="content-grid">
      <div className="main-panel">
        <PanelTitle icon={<SlidersHorizontal />} title="Recruiter Control Room" />
        <p className="lead">Tune the ranker for recruiter intent. Challenge Mode can keep these defaults locked for the final official output.</p>
      </div>
      <div className="slider-panel">
        {(Object.keys(weights) as Array<keyof Weights>).map((key) => (
          <label className="slider-row" key={key}>
            <span>{labelize(key)}<b>{weights[key].toFixed(2)}</b></span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={weights[key]}
              onChange={(event) => setWeights({ ...weights, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
        <div className="button-row">
          <button className="ghost-button" onClick={() => setWeights(defaultWeights)}>Reset</button>
          <button className="primary-button" onClick={onRun}><Activity size={17} /> Rerank</button>
        </div>
      </div>
    </section>
  );
}

function ExportPanel({ runId, results }: { runId?: string; results: CandidateResult[] }) {
  const [validation, setValidation] = React.useState<string>("");
  const csv = React.useMemo(() => {
    const lines = ["candidate_id,rank,score,reasoning"];
    results.forEach((row) => {
      lines.push(`${row.candidate_id},${row.rank},${row.score.toFixed(6)},"${row.reasoning.replace(/"/g, '""')}"`);
    });
    return lines.join("\n");
  }, [results]);
  const validate = async () => {
    try {
      const response = await fetch(`${API}/api/validate-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv })
      });
      if (response.ok) {
        const data = await response.json();
        setValidation(data.valid ? "Valid CSV structure." : data.errors.join(" "));
        return;
      }
    } catch {
      // Static deploy fallback below.
    }
    const lines = csv.trim().split(/\r?\n/);
    setValidation(lines.length === 101 ? "Valid CSV structure." : `Expected 101 CSV lines, found ${lines.length}.`);
  };
  const downloadCsv = () => {
    const blob = new Blob([`${csv}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${runId ?? "skillbridge-demo"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="content-grid">
      <div className="main-panel">
        <PanelTitle icon={<Download />} title="Submission Export" />
        <p className="lead">Export the exact challenge columns. Full submissions should be generated by the offline CLI against `candidates.jsonl`.</p>
        <div className="button-row">
          <button className="primary-button" onClick={downloadCsv} disabled={!results.length}>
            <Download size={17} /> Download CSV
          </button>
          <button className="ghost-button" onClick={validate} disabled={!results.length}><ShieldCheck size={17} /> Validate</button>
        </div>
        {validation && <div className="success-strip">{validation}</div>}
      </div>
      <pre className="csv-preview">{csv || "Run ranking to preview the submission CSV."}</pre>
    </section>
  );
}

function InsightList({ title, items, tone }: { title: string; items?: string[]; tone: string }) {
  return (
    <article className={`insight ${tone}`}>
      <h3>{title}</h3>
      {(items?.length ? items : ["Run ranking to populate this section."]).map((item) => (
        <p key={item}><ChevronRight size={15} /> {item}</p>
      ))}
    </article>
  );
}

function EvidenceBlock({ title, items, muted = false, danger = false }: { title: string; items?: string[]; muted?: boolean; danger?: boolean }) {
  if (!items?.length) return null;
  return (
    <div className={danger ? "evidence danger" : muted ? "evidence muted" : "evidence"}>
      <strong>{title}</strong>
      {items.map((item) => <p key={item}>{item}</p>)}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <article className="metric"><span>{icon}</span><small>{label}</small><strong>{value}</strong></article>;
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="panel-title"><span>{icon}</span><h2>{title}</h2></div>;
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score > 0.7 ? "high" : score > 0.45 ? "mid" : "low";
  return <span className={`score ${tone}`}>{Math.round(score * 100)}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty"><FileText size={26} /><p>{text}</p></div>;
}

function fmt(value?: number) {
  return typeof value === "number" ? String(Math.round(value * 100)) : "0";
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function activeTitle(id: string) {
  return tabs.find((tab) => tab[0] === id)?.[1] ?? "SkillBridge Recruiter";
}

async function rankStaticDemo(weights: Weights): Promise<RankResponse> {
  const candidates = await loadStaticCandidates();
  const results = candidates
    .map((candidate) => scoreStaticCandidate(candidate, weights))
    .sort((a, b) => b.score - a.score || a.candidate_id.localeCompare(b.candidate_id))
    .slice(0, 100)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return {
    run_id: "run_static_demo",
    job_id: "job_static_demo",
    analysis: staticAnalysis,
    results,
    metrics: {
      count: results.length,
      top_score: Math.max(...results.map((row) => row.score)),
      avg_score: results.reduce((sum, row) => sum + row.score, 0) / results.length,
      avg_trust: results.reduce((sum, row) => sum + row.trust_score, 0) / results.length,
      risk_flags: results.reduce((sum, row) => sum + row.risk_flags.length, 0)
    }
  };
}

async function findStaticCandidate(candidateId: string): Promise<Candidate | null> {
  const candidates = await loadStaticCandidates();
  return candidates.find((candidate) => candidate.candidate_id === candidateId) ?? null;
}

let staticCandidateCache: Candidate[] | null = null;

async function loadStaticCandidates(): Promise<Candidate[]> {
  if (staticCandidateCache) return staticCandidateCache;
  const response = await fetch(STATIC_DATA_URL);
  if (!response.ok) throw new Error("Static demo data is unavailable.");
  staticCandidateCache = (await response.json()) as Candidate[];
  return staticCandidateCache;
}

const staticAnalysis: JobAnalysis = {
  title: "Senior AI Engineer - Founding Team",
  role_intent:
    "Find a senior AI engineer who has shipped production retrieval/ranking systems, can write strong Python, understands evaluation, and has product judgment for recruiter-facing matching.",
  must_haves: [
    "production embeddings-based retrieval",
    "vector database or hybrid search infrastructure",
    "strong Python",
    "ranking evaluation frameworks",
    "modern ML systems"
  ],
  nice_to_haves: ["LLM fine-tuning", "LoRA/QLoRA/PEFT", "learning-to-rank", "HR-tech or marketplace exposure", "distributed systems"],
  disqualifiers: ["pure research without production deployment", "recent-only wrapper experience", "consulting-only career history"],
  logistics: ["Pune or Noida preferred", "hybrid flexible cadence", "sub-30-day notice preferred", "5-9 years ideal range"],
  culture_signals: ["scrappy product-engineering attitude", "ships quickly", "async-first written communication", "startup ambiguity"],
  keywords: ["python", "embedding", "retrieval", "ranking", "search", "vector", "llm", "evaluation", "nlp", "milvus", "qdrant"]
};

function scoreStaticCandidate(candidate: Candidate, weights: Weights): CandidateResult {
  const profile = candidate.profile ?? {};
  const skills = candidate.skills ?? [];
  const signals = candidate.redrob_signals ?? {};
  const career = candidate.career_history ?? [];
  const text = `${profile.headline ?? ""} ${profile.summary ?? ""} ${profile.current_title ?? ""} ${skills.map((s) => s.name).join(" ")} ${career.map((job) => `${job.title} ${job.description}`).join(" ")}`.toLowerCase();
  const irTerms = ["embedding", "retrieval", "ranking", "ranker", "search", "recommendation", "vector", "semantic", "faiss", "milvus", "qdrant", "weaviate", "pinecone"];
  const evalTerms = ["ndcg", "mrr", "map", "a/b", "evaluation", "benchmark", "metrics"];
  const semantic_fit = coverage(text, [...staticAnalysis.keywords, ...irTerms, ...evalTerms], 16);
  const career_proof = clamp(coverage(text, [...irTerms, "production", "deployed", "shipped", "owned", "scale"], 12));
  const relevantSkills = skills.filter((skill) => ["python", "nlp", "llm", "lora", ...irTerms].some((term) => skill.name.toLowerCase().includes(term)));
  const skill_trust = relevantSkills.length
    ? clamp(relevantSkills.reduce((sum, skill) => sum + Math.min((skill.duration_months ?? 0) / 36, 1), 0) / relevantSkills.length)
    : 0;
  const evaluation_depth = coverage(text, evalTerms, 7);
  const product_startup_fit = clamp(0.38 + coverage(text, ["product", "users", "saas", "marketplace", "startup"], 8) * 0.45);
  const responseRate = Number(signals.recruiter_response_rate ?? 0);
  const notice = Number(signals.notice_period_days ?? 180);
  const behavioral_availability = clamp(responseRate * 0.45 + (signals.open_to_work_flag ? 0.18 : 0) + (1 - Math.min(notice / 120, 1)) * 0.25);
  const location = `${profile.location ?? ""} ${profile.country ?? ""}`.toLowerCase();
  const logistics = clamp((location.includes("india") ? 0.7 : 0.35) + (signals.willing_to_relocate ? 0.15 : 0));
  const data_quality = clamp(Number(signals.profile_completeness_score ?? 0) / 100);
  const components = { semantic_fit, career_proof, skill_trust, evaluation_depth, product_startup_fit, behavioral_availability, logistics, data_quality };
  let score = clamp(
    (semantic_fit * weights.semantic_fit +
      career_proof * weights.career_proof +
      skill_trust * weights.skill_trust +
      evaluation_depth * weights.evaluation_depth +
      product_startup_fit * weights.product_startup_fit +
      behavioral_availability * weights.behavioral_availability +
      logistics * weights.logistics +
      data_quality * weights.data_quality) /
      Math.max(weights.semantic_fit + weights.career_proof + weights.skill_trust + weights.evaluation_depth + weights.product_startup_fit + weights.behavioral_availability + weights.logistics + weights.data_quality, 0.1)
  );
  const risk_flags: string[] = [];
  const why_not_higher: string[] = [];
  if (skill_trust > 0.55 && career_proof < 0.25) {
    score = clamp(score - 0.12 * weights.anti_keyword_strictness);
    risk_flags.push("Possible keyword stuffing: many claimed AI skills with weaker career proof.");
    why_not_higher.push("Skill claims need stronger production evidence.");
  }
  if (behavioral_availability < 0.45) {
    risk_flags.push("Availability risk from activity, response, or notice-period signals.");
    why_not_higher.push("Lower behavioral availability score.");
  }
  if (evaluation_depth < 0.25) why_not_higher.push("Limited explicit ranking-evaluation evidence.");
  if (career_proof < 0.35) why_not_higher.push("Career history has limited production retrieval/ranking proof.");
  const topSkills = skills.slice(0, 4).map((skill) => skill.name);
  const evidence = [
    { source: "career_history", text: `${profile.current_title ?? "Candidate"} with ${profile.years_of_experience ?? "?"} years of experience.` },
    { source: "skills", text: `Relevant skills include ${topSkills.join(", ") || "limited listed skills"}.` },
    { source: "redrob_signals", text: `Response rate ${responseRate.toFixed(2)}, notice ${notice} days, profile completeness ${Number(signals.profile_completeness_score ?? 0).toFixed(1)}%.` }
  ];
  return {
    candidate_id: candidate.candidate_id,
    rank: 0,
    score: Number(score.toFixed(6)),
    trust_score: Number(clamp(data_quality * 0.4 + behavioral_availability * 0.3 + career_proof * 0.3).toFixed(4)),
    reasoning: `${profile.current_title ?? "Candidate"} with ${profile.years_of_experience ?? "?"} yrs; ${evidence[1].text}.${risk_flags[0] ? ` Concern: ${risk_flags[0]}` : ""}`,
    evidence,
    risk_flags,
    why_not_higher,
    components,
    candidate
  };
}

function coverage(text: string, terms: string[], denominator: number) {
  return clamp(terms.filter((term) => text.includes(term.toLowerCase())).length / denominator);
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

createRoot(document.getElementById("root")!).render(<App />);
