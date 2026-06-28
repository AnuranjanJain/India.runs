from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .jd import JobAnalysis
from .ranker import CandidateScore


class Store:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.init()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def init(self) -> None:
        with self.connect() as db:
            db.executescript(
                """
                create table if not exists jobs (
                  id text primary key,
                  created_at text not null,
                  title text not null,
                  analysis_json text not null
                );
                create table if not exists rank_runs (
                  id text primary key,
                  job_id text not null,
                  created_at text not null,
                  mode text not null,
                  candidate_path text not null,
                  weights_json text not null,
                  results_json text not null,
                  foreign key(job_id) references jobs(id)
                );
                create table if not exists candidates (
                  candidate_id text primary key,
                  candidate_json text not null,
                  last_seen_at text not null
                );
                """
            )

    def save_job(self, analysis: JobAnalysis) -> str:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        with self.connect() as db:
            db.execute(
                "insert into jobs(id, created_at, title, analysis_json) values (?, ?, ?, ?)",
                (job_id, _now(), analysis.title, json.dumps(analysis.to_dict())),
            )
        return job_id

    def save_rank_run(
        self,
        *,
        job_id: str,
        mode: str,
        candidate_path: str,
        weights: dict[str, Any],
        results: list[CandidateScore],
    ) -> str:
        run_id = f"run_{uuid.uuid4().hex[:12]}"
        public_results = [result.to_public_dict(include_candidate=False) for result in results]
        with self.connect() as db:
            db.execute(
                """
                insert into rank_runs(id, job_id, created_at, mode, candidate_path, weights_json, results_json)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    job_id,
                    _now(),
                    mode,
                    candidate_path,
                    json.dumps(weights),
                    json.dumps(public_results),
                ),
            )
            for result in results:
                db.execute(
                    """
                    insert into candidates(candidate_id, candidate_json, last_seen_at)
                    values (?, ?, ?)
                    on conflict(candidate_id) do update set
                      candidate_json=excluded.candidate_json,
                      last_seen_at=excluded.last_seen_at
                    """,
                    (result.candidate_id, json.dumps(result.candidate), _now()),
                )
        return run_id

    def get_rank_run(self, run_id: str) -> dict[str, Any] | None:
        with self.connect() as db:
            row = db.execute("select * from rank_runs where id = ?", (run_id,)).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "job_id": row["job_id"],
            "created_at": row["created_at"],
            "mode": row["mode"],
            "candidate_path": row["candidate_path"],
            "weights": json.loads(row["weights_json"]),
            "results": json.loads(row["results_json"]),
        }

    def list_rank_runs(self, limit: int = 10) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute(
                "select id, job_id, created_at, mode, candidate_path, results_json from rank_runs order by created_at desc limit ?",
                (limit,),
            ).fetchall()
        runs = []
        for row in rows:
            results = json.loads(row["results_json"])
            runs.append(
                {
                    "id": row["id"],
                    "job_id": row["job_id"],
                    "created_at": row["created_at"],
                    "mode": row["mode"],
                    "candidate_path": row["candidate_path"],
                    "count": len(results),
                    "top_candidate": results[0] if results else None,
                }
            )
        return runs

    def get_candidate(self, candidate_id: str) -> dict[str, Any] | None:
        with self.connect() as db:
            row = db.execute(
                "select candidate_json from candidates where candidate_id = ?", (candidate_id,)
            ).fetchone()
        return json.loads(row["candidate_json"]) if row else None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
