"""Execute the public Task 06 notebook with Python's standard library only."""

from __future__ import annotations

import contextlib
import html
import io
import json
import sys
from pathlib import Path


TASK06C_R2E = "--task06c-r2e" in sys.argv
TASK06C_R2 = "--task06c-r2" in sys.argv and not TASK06C_R2E
TASK06C_R1 = "--task06c-r1" in sys.argv and not TASK06C_R2 and not TASK06C_R2E
TASK06C = "--task06c" in sys.argv and not TASK06C_R1 and not TASK06C_R2 and not TASK06C_R2E
NOTEBOOK = Path(
    "evaluation/task06c-r2e/notebook/ankur_task06c_r2e_evaluation.ipynb"
    if TASK06C_R2E
    else "evaluation/task06c-r2/notebook/ankur_task06c_r2_evaluation.ipynb" if TASK06C_R2
    else "evaluation/task06c-r1/notebook/ankur_task06c_r1_evaluation.ipynb" if TASK06C_R1
    else "evaluation/task06c/notebook/ankur_task06c_evaluation.ipynb" if TASK06C
    else "evaluation/notebook/ankur_task06_evaluation.ipynb"
)
HTML = Path(
    "evaluation/task06c-r2e/notebook/ankur_task06c_r2e_evaluation.html"
    if TASK06C_R2E
    else "evaluation/task06c-r2/notebook/ankur_task06c_r2_evaluation.html" if TASK06C_R2
    else "evaluation/task06c-r1/notebook/ankur_task06c_r1_evaluation.html" if TASK06C_R1
    else "evaluation/task06c/notebook/ankur_task06c_evaluation.html" if TASK06C
    else "evaluation/notebook/ankur_task06_evaluation.html"
)


def render_markdown(value: str) -> str:
    lines = []
    for raw in value.splitlines():
        escaped = html.escape(raw)
        if raw.startswith("### "):
            lines.append(f"<h3>{html.escape(raw[4:])}</h3>")
        elif raw.startswith("## "):
            lines.append(f"<h2>{html.escape(raw[3:])}</h2>")
        elif raw.startswith("# "):
            lines.append(f"<h1>{html.escape(raw[2:])}</h1>")
        elif raw.startswith("- "):
            lines.append(f"<li>{html.escape(raw[2:])}</li>")
        elif raw.strip() == "":
            lines.append("")
        else:
            lines.append(f"<p>{escaped}</p>")
    return "\n".join(lines)


def main() -> None:
    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    namespace: dict[str, object] = {"__name__": "__ankur_notebook__"}
    html_parts = [
        f"<!doctype html><html><head><meta charset='utf-8'><title>Ankur {'Task 06C-R2E' if TASK06C_R2E else 'Task 06C-R2' if TASK06C_R2 else 'Task 06C-R1' if TASK06C_R1 else 'Task 06C' if TASK06C else 'Task 06'} Evaluation</title>",
        "<style>body{max-width:1080px;margin:40px auto;padding:0 24px;font:16px/1.55 system-ui;color:#173c31}"
        "h1,h2,h3{color:#0d5d43}pre{white-space:pre-wrap;background:#f5f2e8;padding:18px;border-radius:12px}"
        "code{font-family:ui-monospace,monospace}.cell{margin:32px 0}.output{border-left:4px solid #d8a640}</style></head><body>",
    ]
    execution_count = 0
    for index, cell in enumerate(notebook.get("cells", []), start=1):
        source = "".join(cell.get("source", []))
        if cell.get("cell_type") == "markdown":
            html_parts.append(f"<section class='cell'>{render_markdown(source)}</section>")
            continue
        if cell.get("cell_type") != "code":
            continue
        execution_count += 1
        stdout = io.StringIO()
        try:
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stdout):
                exec(compile(source, f"{NOTEBOOK.name}:cell-{index}", "exec"), namespace)
        except Exception as error:
            output = stdout.getvalue()
            raise RuntimeError(f"Notebook cell {index} failed after output: {output}") from error
        output = stdout.getvalue()
        cell["execution_count"] = execution_count
        cell["outputs"] = [{
            "name": "stdout",
            "output_type": "stream",
            "text": output.splitlines(keepends=True),
        }]
        html_parts.append(
            "<section class='cell'><pre><code>" + html.escape(source) +
            "</code></pre><pre class='output'>" + html.escape(output) + "</pre></section>"
        )
    html_parts.append("</body></html>")
    NOTEBOOK.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    HTML.write_text("\n".join(html_parts), encoding="utf-8")
    print(f"Notebook restart-and-run-all PASSED: {execution_count} code cells; HTML: {HTML}")


if __name__ == "__main__":
    main()
