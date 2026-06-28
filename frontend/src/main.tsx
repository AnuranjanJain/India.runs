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
      const response = await fetch(`${API}/api/rank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, top_n: 100, weights })
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as RankResponse;
      setRankData(data);
      setSelected(data.results[0] ?? null);
      setActive("shortlist");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ranking failed");
    } finally {
      setLoading(false);
    }
  };

  const openCandidate = async (row: CandidateResult) => {
    setSelected(row);
    setCandidateDetail(null);
    const response = await fetch(`${API}/api/candidates/${row.candidate_id}`);
    if (response.ok) {
      setCandidateDetail((await response.json()) as Candidate);
    }
  };

  const runCompare = async () => {
    if (compareIds.length < 2) return;
    const response = await fetch(`${API}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_ids: compareIds })
    });
    if (response.ok) {
      const data = await response.json();
      setCompareRows(data.candidates);
    }
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
    const response = await fetch(`${API}/api/validate-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv })
    });
    const data = await response.json();
    setValidation(data.valid ? "Valid CSV structure." : data.errors.join(" "));
  };
  return (
    <section className="content-grid">
      <div className="main-panel">
        <PanelTitle icon={<Download />} title="Submission Export" />
        <p className="lead">Export the exact challenge columns. Full submissions should be generated by the offline CLI against `candidates.jsonl`.</p>
        <div className="button-row">
          <a className={runId ? "primary-button link-button" : "primary-button link-button disabled"} href={runId ? `/api/export/${runId}.csv` : "#"}>
            <Download size={17} /> Download CSV
          </a>
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

createRoot(document.getElementById("root")!).render(<App />);
