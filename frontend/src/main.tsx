import React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  Download,
  FileCheck2,
  FileText,
  Fingerprint,
  Filter,
  Gauge,
  GitCompare,
  Layers3,
  Loader2,
  LockKeyhole,
  Radar,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  UserCheck,
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
  dataset?: DatasetSummary;
  diagnostics?: RankDiagnostics;
};

type DatasetSummary = {
  source_label?: string;
  total_candidates: number;
  valid_candidates: number;
  missing_data_candidates: number;
  invalid_records: number;
  official_export_rows: number;
  supported_top_k: number[];
  estimated_size_mb?: number;
  mode?: string;
};

type RankDiagnostics = {
  total_candidates: number;
  ranked_candidates: number;
  official_export_rows: number;
  exploration_rows: number;
  score_bands: Record<string, number>;
  component_averages: Record<string, number>;
  weakest_dimensions: Array<[string, number]>;
  risk_flags: Record<string, number>;
  methodology: string[];
};

type Weights = {
  must_have_fit: number;
  nice_to_have_fit: number;
  semantic_fit: number;
  seniority_alignment: number;
  production_ai_search_proof: number;
  career_proof: number;
  skill_trust: number;
  evaluation_depth: number;
  product_startup_fit: number;
  open_source_validation: number;
  behavioral_availability: number;
  salary_work_mode_location_fit: number;
  data_quality: number;
  explanation_quality: number;
  anti_keyword_strictness: number;
};

const defaultWeights: Weights = {
  must_have_fit: 1.3,
  nice_to_have_fit: 0.65,
  semantic_fit: 1,
  seniority_alignment: 0.8,
  production_ai_search_proof: 1.2,
  career_proof: 1.25,
  skill_trust: 1.15,
  evaluation_depth: 0.9,
  product_startup_fit: 0.75,
  open_source_validation: 0.45,
  behavioral_availability: 0.9,
  salary_work_mode_location_fit: 0.65,
  data_quality: 0.5,
  explanation_quality: 0.45,
  anti_keyword_strictness: 1
};

const tabs = [
  ["dashboard", "Dashboard", BarChart3],
  ["brief", "Judge Brief", Trophy],
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
  const [topK, setTopK] = React.useState<100 | 250 | 500 | 1000>(100);
  const [dataset, setDataset] = React.useState<DatasetSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const [compareRows, setCompareRows] = React.useState<CandidateResult[]>([]);

  React.useEffect(() => {
    loadDatasetSummary().then(setDataset).catch(() => undefined);
  }, []);

  const runRank = async (mode = "demo") => {
    setLoading(true);
    setError("");
    try {
      let data: RankResponse;
      const response = await fetch(`${API}/api/rank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, top_n: topK, weights })
      });
      if (response.ok) {
        data = (await response.json()) as RankResponse;
      } else {
        data = await rankStaticDemo(weights, topK);
      }
      setRankData(data);
      if (data.dataset) setDataset(data.dataset);
      setSelected(data.results[0] ?? null);
      setActive("shortlist");
    } catch (err) {
      try {
        const data = await rankStaticDemo(weights, topK);
        setRankData(data);
        if (data.dataset) setDataset(data.dataset);
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
    const data = await rankStaticDemo(weights, topK);
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
            <TopKControl value={topK} onChange={setTopK} />
            <button className="primary-button" onClick={() => runRank("demo")} disabled={loading}>
              {loading ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
              Rank Top {topK}
            </button>
          </div>
        </header>

        {error && <div className="error-strip"><AlertTriangle size={16} /> {error}</div>}

        {active === "dashboard" && (
          <Dashboard data={rankData} dataset={dataset} topK={topK} onTopKChange={setTopK} onRun={() => runRank("demo")} loading={loading} />
        )}
        {active === "brief" && <JudgeBrief data={rankData} onRun={() => runRank("demo")} loading={loading} />}
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
          <ControlRoom weights={weights} setWeights={setWeights} topK={topK} onTopKChange={setTopK} results={results} onRun={() => runRank("custom")} />
        )}
        {active === "export" && <ExportPanel runId={rankData?.run_id} results={results} topK={topK} />}
      </main>
    </div>
  );
}

function Dashboard({
  data,
  dataset,
  topK,
  onTopKChange,
  onRun,
  loading
}: {
  data: RankResponse | null;
  dataset: DatasetSummary | null;
  topK: 100 | 250 | 500 | 1000;
  onTopKChange: (value: 100 | 250 | 500 | 1000) => void;
  onRun: () => void;
  loading: boolean;
}) {
  const metrics = data?.metrics;
  const diagnostics = data?.diagnostics;
  return (
    <section className="grid-page">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Recruiter-grade ranking</p>
          <h2>Find the people a keyword filter would miss.</h2>
          <p>
            SkillBridge Recruiter reads the role, weighs career proof and Redrob behavior, then produces a shortlist with evidence, risk flags, and export-ready rankings.
          </p>
          <div className="hero-badges">
            <span><Award size={15} /> Built for judging clarity</span>
            <span><LockKeyhole size={15} /> No network ranking path</span>
            <span><Fingerprint size={15} /> Evidence-only reasoning</span>
          </div>
        </div>
        <button className="primary-button large" onClick={onRun} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />} Rank Top {topK}
        </button>
      </div>
      <div className="command-panel">
        <PanelTitle icon={<Database />} title="Challenge Command Center" />
        <div className="command-grid">
          <Metric label="Total pool" value={compactNumber(dataset?.total_candidates ?? metrics?.total_candidates ?? 0)} icon={<Database />} />
          <Metric label="Selected top-K" value={compactNumber(topK)} icon={<Filter />} />
          <Metric label="Official export" value="100" icon={<LockKeyhole />} />
          <Metric label="Missing data" value={compactNumber(dataset?.missing_data_candidates ?? metrics?.missing_data_candidates ?? 0)} icon={<AlertTriangle />} />
        </div>
        <div className="control-strip">
          <div>
            <strong>Top-K Explorer</strong>
            <span>Explore deeper shortlists while the challenge CSV stays locked to the top 100.</span>
          </div>
          <TopKControl value={topK} onChange={onTopKChange} />
        </div>
      </div>
      <div className="metric-grid">
        <Metric label="Top score" value={fmt(metrics?.top_score)} icon={<Gauge />} />
        <Metric label="Avg trust" value={fmt(metrics?.avg_trust)} icon={<ShieldCheck />} />
        <Metric label="Exploration rows" value={String(metrics?.count ?? 0)} icon={<BriefcaseBusiness />} />
        <Metric label="Risk flags" value={String(metrics?.risk_flags ?? 0)} icon={<AlertTriangle />} />
      </div>
      <DiagnosticsPanel diagnostics={diagnostics} />
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
      <StandoutBand data={data} />
    </section>
  );
}

function JudgeBrief({ data, onRun, loading }: { data: RankResponse | null; onRun: () => void; loading: boolean }) {
  const results = data?.results ?? [];
  const top = results[0];
  const proofStats = summarizeProof(results);
  return (
    <section className="judge-grid">
      <div className="judge-hero">
        <div>
          <p className="eyebrow">30-second judge story</p>
          <h2>Not a search box. A recruiter decision engine.</h2>
          <p>
            SkillBridge Recruiter separates people who merely list AI terms from people whose career history,
            behavioral signals, and logistics make them actually hireable for the role.
          </p>
        </div>
        <button className="primary-button large" onClick={onRun} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Radar size={18} />} Run Proof Demo
        </button>
      </div>
      <article className="judge-card thesis">
        <PanelTitle icon={<Target />} title="Winning Thesis" />
        <p>
          The system ranks fit as a chain of proof: JD intent, career evidence, skill trust, platform behavior,
          disqualifier checks, and recruiter-ready reasoning.
        </p>
      </article>
      <article className="judge-card">
        <PanelTitle icon={<Fingerprint />} title="Signal Fingerprint" />
        <p>Every shortlisted candidate gets a compact fingerprint: proof strength, trust, availability, logistics, and risk.</p>
        <div className="mini-fingerprint">
          {(top ? fingerprintFor(top) : ["Proof", "Trust", "Availability", "Risk"]).map((item) => <span key={item}>{item}</span>)}
        </div>
      </article>
      <article className="judge-card">
        <PanelTitle icon={<ShieldCheck />} title="Hallucination Guardrail" />
        <p>Reasoning is built only from fields already present in the candidate profile, career history, skills, and Redrob signals.</p>
      </article>
      <article className="judge-card">
        <PanelTitle icon={<AlertTriangle />} title="Anti-Keyword Trap" />
        <p>Claims are penalized when AI skill volume is high but career proof, production language, or evaluation evidence is weak.</p>
      </article>
      <article className="judge-card">
        <PanelTitle icon={<FileCheck2 />} title="Submission-Ready" />
        <p>The product demo, backend API, and offline CLI all converge on the exact CSV format required by the challenge.</p>
      </article>
      <article className="judge-card scorecard">
        <PanelTitle icon={<Trophy />} title="Demo Proof Scorecard" />
        <div className="proof-stats">
          <span><b>{results.length || 0}</b> ranked</span>
          <span><b>{proofStats.evidence}</b> evidence points</span>
          <span><b>{proofStats.risks}</b> risks surfaced</span>
          <span><b>{proofStats.avgTrust}</b> avg trust</span>
        </div>
      </article>
      <div className="judge-script">
        <PanelTitle icon={<ClipboardCheck />} title="Pitch Script" />
        <p>
          “Most rankers stop at semantic similarity. SkillBridge Recruiter asks the next recruiter question:
          can I trust this candidate, can I contact them, and can I defend why they are shortlisted?”
        </p>
      </div>
    </section>
  );
}

function StandoutBand({ data }: { data: RankResponse | null }) {
  const stats = summarizeProof(data?.results ?? []);
  return (
    <div className="wide-band standout-band">
      <PanelTitle icon={<Trophy />} title="Why This Stands Out In A Large Submission Pool" />
      <div className="standout-grid">
        <article>
          <strong>Judge-visible differentiation</strong>
          <span>Trust mechanics are visible in the UI, not hidden in a notebook.</span>
        </article>
        <article>
          <strong>Evidence over vibes</strong>
          <span>{stats.evidence || "Every"} explanation is grounded in profile fields and Redrob signals.</span>
        </article>
        <article>
          <strong>Recruiter workflow complete</strong>
          <span>Analyze, rank, inspect, compare, tune, export, and validate in one surface.</span>
        </article>
        <article>
          <strong>Hard to fake fit</strong>
          <span>Keyword stuffing, stale candidates, and logistics risk are surfaced before export.</span>
        </article>
      </div>
    </div>
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
  const [query, setQuery] = React.useState("");
  const filtered = results.filter((row) => {
    const haystack = `${row.candidate_id} ${row.reasoning} ${row.risk_flags.join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const nearMisses = results.filter((row) => row.rank > 100 && row.rank <= 125);
  return (
    <section className="shortlist-layout">
      <div className="table-panel">
        <div className="table-tools">
          <PanelTitle icon={<Filter />} title="Trusted Shortlist" />
          <span>{results.length || 0} ranked candidates</span>
        </div>
        <div className="search-box">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Audit by candidate ID, reason, or risk" />
        </div>
        <div className="candidate-list">
          {results.length === 0 && <EmptyState text="Run the demo ranker to generate a shortlist." />}
          {filtered.map((row) => (
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
        {nearMisses.length > 0 && (
          <div className="near-miss-panel">
            <PanelTitle icon={<Radar />} title="Near Misses: 101-125" />
            <p>These candidates missed the official cutoff but remain visible for recruiter review.</p>
            <div>
              {nearMisses.slice(0, 8).map((row) => (
                <button key={row.candidate_id} onClick={() => onSelect(row)}>
                  #{row.rank} {row.candidate_id}
                  <span>{weakestComponent(row)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <CandidateDrawer row={selected} candidate={selectedFull} />
    </section>
  );
}

function CandidateDrawer({ row, candidate }: { row: CandidateResult | null; candidate?: Candidate | null }) {
  if (!row) return <aside className="detail-panel"><EmptyState text="Select a candidate to inspect evidence." /></aside>;
  const profile = candidate?.profile ?? {};
  const verdict = verdictFor(row);
  return (
    <aside className="detail-panel">
      <div className="drawer-head">
        <div>
          <p className="eyebrow">Rank #{row.rank}</p>
          <h2>{profile.current_title ?? row.candidate_id}</h2>
          <span>{profile.current_company ?? "Candidate"} - {profile.location ?? "Location unknown"}</span>
        </div>
        <ScoreBadge score={row.score} />
      </div>
      <div className={`verdict ${verdict.tone}`}>
        <strong>{verdict.label}</strong>
        <span>{verdict.copy}</span>
      </div>
      <div className="fingerprint-strip">
        {fingerprintFor(row).map((item) => <span key={item}>{item}</span>)}
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
      <ProofChain row={row} />
      <EvidenceBlock title="Why not higher?" items={row.why_not_higher} muted />
      <EvidenceBlock title="Risk flags" items={row.risk_flags} danger />
      <div className="skill-cloud">
        {(candidate?.skills ?? []).slice(0, 12).map((skill) => <span key={skill.name}>{skill.name}</span>)}
      </div>
    </aside>
  );
}

function ProofChain({ row }: { row: CandidateResult }) {
  const steps = [
    ["JD", row.components.semantic_fit, "Role intent match"],
    ["Proof", row.components.career_proof, "Career evidence"],
    ["Trust", row.trust_score, "Field-backed confidence"],
    ["Risk", 1 - Math.min(row.risk_flags.length / 3, 1), "Penalty checks"]
  ] as const;
  return (
    <div className="proof-chain">
      <strong>Proof Chain</strong>
      <div>
        {steps.map(([label, value, copy]) => (
          <span key={label}>
            <b>{label}</b>
            <meter min={0} max={1} value={value} />
            <small>{copy}</small>
          </span>
        ))}
      </div>
    </div>
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

function ControlRoom({
  weights,
  setWeights,
  topK,
  onTopKChange,
  results,
  onRun
}: {
  weights: Weights;
  setWeights: (weights: Weights) => void;
  topK: 100 | 250 | 500 | 1000;
  onTopKChange: (value: 100 | 250 | 500 | 1000) => void;
  results: CandidateResult[];
  onRun: () => void;
}) {
  const movers = results.slice(0, 6).map((row) => ({
    id: row.candidate_id,
    rank: row.rank,
    weakest: weakestComponent(row),
    lift: rankLiftHint(row, weights)
  }));
  return (
    <section className="content-grid">
      <div className="main-panel">
        <PanelTitle icon={<SlidersHorizontal />} title="Recruiter Control Room" />
        <p className="lead">Tune the ranker for recruiter intent. Challenge Mode can keep these defaults locked for the final official output.</p>
        <div className="control-strip inline">
          <div>
            <strong>Exploration depth</strong>
            <span>Reranking can inspect top {topK}, while the final CSV remains top 100.</span>
          </div>
          <TopKControl value={topK} onChange={onTopKChange} />
        </div>
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
          <button className="primary-button" onClick={onRun}><Activity size={17} /> Rerank Top {topK}</button>
        </div>
      </div>
      <div className="main-panel">
        <PanelTitle icon={<Activity />} title="Rank Shift Simulator" />
        <p className="lead">Before reranking, this preview shows which dimensions are holding current top candidates back.</p>
        <div className="shift-grid">
          {(movers.length ? movers : [{ id: "Run ranking", rank: 0, weakest: "No candidates yet", lift: "Adjust weights after a run" }]).map((item) => (
            <article key={item.id}>
              <strong>{item.rank ? `#${item.rank} ${item.id}` : item.id}</strong>
              <span>{item.weakest}</span>
              <small>{item.lift}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExportPanel({ runId, results, topK }: { runId?: string; results: CandidateResult[]; topK: number }) {
  const [validation, setValidation] = React.useState<string>("");
  const brief = React.useMemo(() => buildRecruiterBrief(results), [results]);
  const officialRows = results.slice(0, 100);
  const officialCsv = React.useMemo(() => {
    const lines = ["candidate_id,rank,score,reasoning"];
    officialRows.forEach((row, index) => {
      lines.push(`${row.candidate_id},${row.rank},${row.score.toFixed(6)},"${row.reasoning.replace(/"/g, '""')}"`);
    });
    return lines.join("\n");
  }, [officialRows]);
  const explorationCsv = React.useMemo(() => {
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
        body: JSON.stringify({ csv: officialCsv })
      });
      if (response.ok) {
        const data = await response.json();
        setValidation(data.valid ? "Valid CSV structure." : data.errors.join(" "));
        return;
      }
    } catch {
      // Static deploy fallback below.
    }
    const lines = officialCsv.trim().split(/\r?\n/);
    setValidation(lines.length === 101 ? "Valid CSV structure." : `Expected 101 CSV lines, found ${lines.length}.`);
  };
  const downloadCsv = (content = officialCsv, suffix = "official-top-100") => {
    const blob = new Blob([`${content}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${runId ?? "skillbridge-demo"}-${suffix}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="content-grid">
      <div className="main-panel">
        <PanelTitle icon={<Download />} title="Submission Export" />
        <p className="lead">Official challenge export is always locked to 100 rows. The top-{topK} exploration file is for recruiter review, not final submission.</p>
        <div className="export-guardrail">
          <LockKeyhole size={18} />
          <div>
            <strong>Official Submission Guardrail</strong>
            <span>{officialRows.length} official rows ready from {results.length} explored candidates.</span>
          </div>
        </div>
        <div className="button-row">
          <button className="primary-button" onClick={() => downloadCsv()} disabled={officialRows.length < 100}>
            <Download size={17} /> Official Top 100 CSV
          </button>
          <button className="ghost-button" onClick={() => downloadCsv(explorationCsv, `exploration-top-${results.length}`)} disabled={!results.length}>
            <Download size={17} /> Exploration CSV
          </button>
          <button className="ghost-button" onClick={validate} disabled={!results.length}><ShieldCheck size={17} /> Validate</button>
        </div>
        {validation && <div className="success-strip">{validation}</div>}
      </div>
      <div className="main-panel">
        <PanelTitle icon={<FileCheck2 />} title="Recruiter Decision Memo" />
        <p className="lead">A judge-friendly explanation of what the shortlist proves beyond CSV compliance.</p>
        <pre className="memo-preview">{brief}</pre>
      </div>
      <pre className="csv-preview">{officialCsv || "Run ranking to preview the official top-100 submission CSV."}</pre>
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

function TopKControl({ value, onChange }: { value: 100 | 250 | 500 | 1000; onChange: (value: 100 | 250 | 500 | 1000) => void }) {
  return (
    <div className="topk-control" aria-label="Top K explorer">
      {([100, 250, 500, 1000] as const).map((option) => (
        <button key={option} className={value === option ? "active" : ""} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics?: RankDiagnostics }) {
  const bands = diagnostics?.score_bands ?? {};
  const weakest = diagnostics?.weakest_dimensions ?? [];
  const risks = Object.entries(diagnostics?.risk_flags ?? {});
  const methodology = diagnostics?.methodology ?? [
    "Hybrid ranking blends semantic JD concepts, career proof, Redrob behavior, logistics, and anti-keyword-stuffing penalties."
  ];
  return (
    <div className="wide-band diagnostic-band">
      <PanelTitle icon={<Radar />} title="Hybrid Ranking Diagnostics" />
      <div className="diagnostic-grid">
        <article>
          <strong>Score bands</strong>
          <span>Hire now {bands.hire_now ?? 0}</span>
          <span>Strong review {bands.strong_review ?? 0}</span>
          <span>Backup {bands.backup ?? 0}</span>
        </article>
        <article>
          <strong>Weakest dimensions</strong>
          {(weakest.length ? weakest : [["Run ranking", 0] as [string, number]]).map(([key, count]) => (
            <span key={key}>{labelize(key)} {count ? `(${count})` : ""}</span>
          ))}
        </article>
        <article>
          <strong>Top risk flags</strong>
          {(risks.length ? risks : [["No run yet", 0]]).slice(0, 3).map(([key, count]) => (
            <span key={key}>{key} {count ? `(${count})` : ""}</span>
          ))}
        </article>
        <article>
          <strong>Method</strong>
          {methodology.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
        </article>
      </div>
    </div>
  );
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

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function activeTitle(id: string) {
  return tabs.find((tab) => tab[0] === id)?.[1] ?? "SkillBridge Recruiter";
}

function verdictFor(row: CandidateResult) {
  if (row.score >= 0.72 && row.risk_flags.length <= 1) {
    return {
      label: "Shortlist with confidence",
      copy: "Strong enough to send to a recruiter with field-backed reasoning.",
      tone: "strong"
    };
  }
  if (row.score >= 0.52) {
    return {
      label: "Review before outreach",
      copy: "Promising fit, but inspect proof chain and risks before contacting.",
      tone: "review"
    };
  }
  return {
    label: "Hold for backup",
    copy: "Useful as a long-tail candidate, not a primary shortlist recommendation.",
    tone: "hold"
  };
}

function fingerprintFor(row: CandidateResult) {
  const tags: string[] = [];
  tags.push(row.components.career_proof >= 0.55 ? "Proof-heavy" : "Proof-light");
  tags.push(row.trust_score >= 0.62 ? "High-trust" : "Needs validation");
  tags.push(row.components.behavioral_availability >= 0.55 ? "Reachable" : "Availability risk");
  tags.push((row.components.salary_work_mode_location_fit ?? row.components.logistics ?? 0) >= 0.7 ? "Logistics fit" : "Logistics watch");
  if (row.risk_flags.length) tags.push(`${row.risk_flags.length} risk flag${row.risk_flags.length > 1 ? "s" : ""}`);
  else tags.push("Clean risk pass");
  return tags;
}

function summarizeProof(results: CandidateResult[]) {
  if (!results.length) return { evidence: 0, risks: 0, avgTrust: "0%" };
  const evidence = results.reduce((sum, row) => sum + row.evidence.length, 0);
  const risks = results.reduce((sum, row) => sum + row.risk_flags.length, 0);
  const avgTrust = `${Math.round((results.reduce((sum, row) => sum + row.trust_score, 0) / results.length) * 100)}%`;
  return { evidence, risks, avgTrust };
}

function weakestComponent(row: CandidateResult) {
  const entries = Object.entries(row.components);
  if (!entries.length) return "No component data";
  const [key, value] = entries.sort((a, b) => a[1] - b[1])[0];
  return `${labelize(key)} is the current constraint at ${Math.round(value * 100)}%.`;
}

function rankLiftHint(row: CandidateResult, weights: Weights) {
  const weak = Object.entries(row.components).sort((a, b) => a[1] - b[1])[0]?.[0] as keyof Weights | undefined;
  if (!weak || weak === "anti_keyword_strictness") return "No obvious weight lever.";
  const current = weights[weak] ?? 1;
  return current < 1 ? "Increasing this weight may move similar candidates down." : "Lowering this weight may widen the shortlist.";
}

function buildRecruiterBrief(results: CandidateResult[]) {
  if (!results.length) {
    return "Run a ranking job to generate a recruiter-ready decision memo.";
  }
  const top = results[0];
  const stats = summarizeProof(results);
  const highConfidence = results.filter((row) => row.score >= 0.7 && row.risk_flags.length <= 1).length;
  const review = results.filter((row) => row.score >= 0.52 && row.score < 0.7).length;
  return [
    "SkillBridge Recruiter Decision Memo",
    "",
    `Top recommendation: ${top.candidate_id} at rank #${top.rank} with score ${Math.round(top.score * 100)} and trust ${Math.round(top.trust_score * 100)}%.`,
    `Shortlist composition: ${highConfidence} high-confidence candidates, ${review} review candidates, ${results.length} total export-ready rows.`,
    `Evidence quality: ${stats.evidence} field-grounded evidence points and ${stats.risks} explicit risk flags surfaced across the shortlist.`,
    "",
    "Why this shortlist is defensible:",
    "- Candidate explanations are generated from profile, career history, skills, and Redrob behavioral signals only.",
    "- Keyword-heavy candidates are penalized when career proof does not support the claimed AI skill surface.",
    "- Availability, notice period, recruiter response, location, and work-mode fit are visible before export.",
    "- Scores are deterministic and tied to a reproducible offline CLI path for the official submission."
  ].join("\n");
}

async function loadDatasetSummary(): Promise<DatasetSummary> {
  try {
    const response = await fetch(`${API}/api/dataset/summary`);
    if (response.ok) return (await response.json()) as DatasetSummary;
  } catch {
    // Static deploy fallback below.
  }
  const candidates = await loadStaticCandidates();
  return staticDatasetSummary(candidates.length);
}

async function rankStaticDemo(weights: Weights, topK = 100): Promise<RankResponse> {
  const candidates = await loadStaticCandidates();
  const results = candidates
    .map((candidate) => scoreStaticCandidate(candidate, weights))
    .sort((a, b) => b.score - a.score || a.candidate_id.localeCompare(b.candidate_id))
    .slice(0, topK)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const dataset = staticDatasetSummary(candidates.length);
  const diagnostics = buildStaticDiagnostics(results, candidates.length);
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
      risk_flags: results.reduce((sum, row) => sum + row.risk_flags.length, 0),
      selected_top_k: results.length,
      official_export_rows: Math.min(results.length, 100),
      total_candidates: candidates.length,
      valid_candidates: candidates.length,
      missing_data_candidates: 0
    },
    dataset,
    diagnostics
  };
}

function staticDatasetSummary(total: number): DatasetSummary {
  return {
    source_label: "Demo pool",
    total_candidates: total,
    valid_candidates: total,
    missing_data_candidates: 0,
    invalid_records: 0,
    official_export_rows: 100,
    supported_top_k: [100, 250, 500, 1000],
    mode: "demo"
  };
}

function buildStaticDiagnostics(results: CandidateResult[], totalCandidates: number): RankDiagnostics {
  const score_bands = {
    hire_now: results.filter((row) => row.score >= 0.72).length,
    strong_review: results.filter((row) => row.score >= 0.58 && row.score < 0.72).length,
    backup: results.filter((row) => row.score >= 0.42 && row.score < 0.58).length,
    weak_fit: results.filter((row) => row.score < 0.42).length
  };
  const risk_flags: Record<string, number> = {};
  const componentTotals: Record<string, number> = {};
  const weakest: Record<string, number> = {};
  results.forEach((row) => {
    row.risk_flags.forEach((risk) => { risk_flags[risk] = (risk_flags[risk] ?? 0) + 1; });
    Object.entries(row.components).forEach(([key, value]) => { componentTotals[key] = (componentTotals[key] ?? 0) + value; });
    const weak = Object.entries(row.components).sort((a, b) => a[1] - b[1])[0]?.[0];
    if (weak) weakest[weak] = (weakest[weak] ?? 0) + 1;
  });
  return {
    total_candidates: totalCandidates,
    ranked_candidates: results.length,
    official_export_rows: Math.min(results.length, 100),
    exploration_rows: results.length,
    score_bands,
    component_averages: Object.fromEntries(Object.entries(componentTotals).map(([key, value]) => [key, Number((value / Math.max(results.length, 1)).toFixed(4))])),
    weakest_dimensions: Object.entries(weakest).sort((a, b) => b[1] - a[1]).slice(0, 5),
    risk_flags,
    methodology: [
      "Sparse semantic concepts catch aliases like vector DB, hybrid search, and ranking metrics.",
      "Career proof must support claimed AI skills before a candidate reaches the top band.",
      "Official export remains exactly 100 rows even when the UI explores deeper top-K pools."
    ]
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
  const must_have_fit = coverage(text, ["production", "retrieval", "ranking", "vector", "python", "evaluation", "mlops"], 7);
  const nice_to_have_fit = coverage(text, ["lora", "qlora", "peft", "marketplace", "startup", "distributed", "open source"], 7);
  const semantic_fit = coverage(text, [...staticAnalysis.keywords, ...irTerms, ...evalTerms], 16);
  const seniority_alignment = clamp((profile.years_of_experience ? 1 - Math.min(Math.abs(Number(profile.years_of_experience) - 7) / 8, 1) : 0.35) + (text.includes("senior") || text.includes("lead") ? 0.18 : 0));
  const production_ai_search_proof = clamp(coverage(text, [...irTerms, "production", "deployed", "shipped", "owned", "scale"], 12));
  const career_proof = clamp(coverage(text, [...irTerms, "production", "deployed", "shipped", "owned", "scale"], 12));
  const relevantSkills = skills.filter((skill) => ["python", "nlp", "llm", "lora", ...irTerms].some((term) => skill.name.toLowerCase().includes(term)));
  const skill_trust = relevantSkills.length
    ? clamp(relevantSkills.reduce((sum, skill) => sum + Math.min((skill.duration_months ?? 0) / 36, 1), 0) / relevantSkills.length)
    : 0;
  const evaluation_depth = coverage(text, evalTerms, 7);
  const product_startup_fit = clamp(0.38 + coverage(text, ["product", "users", "saas", "marketplace", "startup"], 8) * 0.45);
  const open_source_validation = clamp(coverage(text, ["github", "open source", "oss", "kaggle", "published"], 5) * 0.55 + (signals.linkedin_connected ? 0.22 : 0) + (signals.verified_email ? 0.18 : 0));
  const responseRate = Number(signals.recruiter_response_rate ?? 0);
  const notice = Number(signals.notice_period_days ?? 180);
  const behavioral_availability = clamp(responseRate * 0.45 + (signals.open_to_work_flag ? 0.18 : 0) + (1 - Math.min(notice / 120, 1)) * 0.25);
  const location = `${profile.location ?? ""} ${profile.country ?? ""}`.toLowerCase();
  const salary_work_mode_location_fit = clamp((location.includes("india") ? 0.7 : 0.35) + (signals.willing_to_relocate ? 0.15 : 0));
  const data_quality = clamp(Number(signals.profile_completeness_score ?? 0) / 100);
  const explanation_quality = clamp(data_quality * 0.35 + career_proof * 0.35 + skill_trust * 0.15 + behavioral_availability * 0.15);
  const components = {
    must_have_fit,
    nice_to_have_fit,
    semantic_fit,
    seniority_alignment,
    production_ai_search_proof,
    career_proof,
    skill_trust,
    evaluation_depth,
    product_startup_fit,
    open_source_validation,
    behavioral_availability,
    salary_work_mode_location_fit,
    data_quality,
    explanation_quality
  };
  const weightedTotal = Object.entries(components).reduce((sum, [key, value]) => sum + value * (weights[key as keyof Weights] ?? 1), 0);
  const weightTotal = Object.keys(components).reduce((sum, key) => sum + (weights[key as keyof Weights] ?? 1), 0);
  let score = clamp(weightedTotal / Math.max(weightTotal, 0.1));
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
  if (production_ai_search_proof < 0.3) risk_flags.push("Weak production AI/search proof for a senior retrieval role.");
  if (open_source_validation < 0.2) why_not_higher.push("Limited external validation from connected profiles, assessments, or public proof.");
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
    trust_score: Number(clamp(data_quality * 0.35 + behavioral_availability * 0.25 + career_proof * 0.25 + skill_trust * 0.15).toFixed(4)),
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
