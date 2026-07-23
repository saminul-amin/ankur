"""Verify Task 06 closure exports with Python's standard library only."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPORTS = ROOT / "evaluation" / "exports"
PRIVATE = ROOT / "evaluation" / "annotations" / "completed-private" / "task06-final"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    metrics = load_json(EXPORTS / "task06-closure-metrics.json")
    questions = load_json(PRIVATE / "question-human-evidence.json")
    written = load_json(PRIVATE / "written-human-evidence.json")
    provider = load_json(ROOT / "evaluation" / "records" / "public" / "provider-operations.json")

    assert metrics["schemaVersion"] == "task06-closure-metrics.v1"
    assert metrics["humanEvidenceStatus"] == "complete"
    assert len(questions) == 60
    assert sum(row["pipeline"] == "ankur_structured" for row in questions) == 30
    assert sum(row["pipeline"] == "one_prompt_baseline" for row in questions) == 30
    assert len({row["record_id"] for row in questions}) == 60
    assert len(written) == 14
    assert all(row["eligibility"] == "exclude_invalid_rubric" for row in written)

    logical = [row for row in provider if ":attempt" not in row["operationId"]]
    assert len(provider) == 51
    assert len(logical) == 44
    assert sum(row["finalStatus"] == "valid" for row in logical) == 40

    ankur = metrics["questionQuality"]["pipelines"]["ankur_structured"]
    baseline = metrics["questionQuality"]["pipelines"]["one_prompt_baseline"]
    assert ankur["overall_accepted"] == {"count": 1, "denominator": 30, "percentage": 3.33}
    assert baseline["overall_accepted"] == {"count": 29, "denominator": 30, "percentage": 96.67}
    assert metrics["written"]["grading_accuracy"]["mean_absolute_error"] is None
    assert metrics["gate"] == {
        "task06EvidenceClosure": "passed",
        "productQualityGate": "failed",
        "task07Authorization": "blocked",
        "reasons": metrics["gate"]["reasons"],
    }

    with (EXPORTS / "question-pipeline-comparison.csv").open(encoding="utf-8-sig", newline="") as handle:
        comparison = list(csv.DictReader(handle))
    assert len(comparison) == 16

    with (EXPORTS / "reviewer-agreement.csv").open(encoding="utf-8-sig", newline="") as handle:
        agreement = list(csv.DictReader(handle))
    assert any(row["field"] == "overall_acceptance" and row["exact_percentage"] == "95.0" for row in agreement)

    manifest = []
    for path in sorted(EXPORTS.glob("*")):
        if path.is_file() and path.name != "task06-closure-manifest.json":
            manifest.append({
                "path": str(path.relative_to(ROOT)).replace("\\", "/"),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "sizeBytes": path.stat().st_size,
            })
    (EXPORTS / "task06-closure-manifest.json").write_text(
        json.dumps({"schemaVersion": "task06-closure-manifest.v1", "files": manifest}, indent=2) + "\n",
        encoding="utf-8",
    )
    print("Task 06 standard-library closure verification PASSED")


if __name__ == "__main__":
    main()
