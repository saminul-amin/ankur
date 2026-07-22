import { Check, Layers3, SlidersHorizontal } from "lucide-react";

import type { AssessmentDifficulty } from "../../../domain/assessments/mcq";
import type { PreparationMap } from "../../../domain/preparation/preparation-map";
import { Badge, Button, Field, SegmentedControl, TextInput } from "../ui/primitives";

export function AssessmentBuilder({ map, title, difficulty, selectedConceptIds, disabled, onTitleChange, onDifficultyChange, onConceptToggle, onGenerate }: Readonly<{
  map: PreparationMap;
  title: string;
  difficulty: AssessmentDifficulty;
  selectedConceptIds: readonly string[];
  disabled: boolean;
  onTitleChange: (title: string) => void;
  onDifficultyChange: (difficulty: AssessmentDifficulty) => void;
  onConceptToggle: (conceptId: string) => void;
  onGenerate: () => void;
}>) {
  return (
    <section className="assessment-builder" aria-labelledby="assessment-builder-title">
      <header>
        <div><p className="eyebrow">Focused P0 assessment</p><h3 id="assessment-builder-title">Shape a small, revealing check.</h3><p>Composition is fixed for this P0 journey, so the score stays transparent and comparable.</p></div>
        <Badge tone="indigo"><SlidersHorizontal aria-hidden="true" size={14} />End-of-assessment feedback</Badge>
      </header>
      <div className="assessment-builder__grid">
        <Field id="assessment-title" label="Assessment title" hint={`${String(title.length)}/160`}>
          <TextInput id="assessment-title" maxLength={160} value={title} onChange={(event) => onTitleChange(event.target.value)} />
        </Field>
        <div className="ui-field"><span className="assessment-builder__label">Difficulty</span><SegmentedControl label="Assessment difficulty" value={difficulty} onChange={onDifficultyChange} options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} /></div>
      </div>
      <fieldset className="concept-selector">
        <legend>Concepts to assess</legend>
        <p>Select at least one confirmed concept. Changing this selection invalidates any prior assessment.</p>
        <div>{map.concepts.map((concept) => {
          const selected = selectedConceptIds.includes(concept.id);
          return <label key={concept.id}><input checked={selected} onChange={() => onConceptToggle(concept.id)} type="checkbox" /><span aria-hidden="true"><Check size={14} /></span><strong lang={map.language === "bn" ? "bn" : undefined}>{concept.name}</strong><small>{concept.priority} priority</small></label>;
        })}</div>
      </fieldset>
      <div className="assessment-composition">
        <span><Layers3 aria-hidden="true" size={18} /></span>
        <div><strong>Fixed composition · 6 marks</strong><p>Question 1: one single-answer MCQ (1 mark). Question 2: one short written response with a 2–4 criterion rubric (5 marks). Untimed, no negative marking.</p></div>
      </div>
      <div className="assessment-builder__action"><Button disabled={disabled || title.trim().length === 0 || selectedConceptIds.length === 0} onClick={onGenerate}>Generate mixed assessment</Button></div>
    </section>
  );
}
