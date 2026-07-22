import { CircleHelp, Leaf } from "lucide-react";

import type { SingleMcqQuestion } from "../../../domain/assessments/mcq";
import type { SourceLanguage } from "../../../domain/source/confirmed-source";
import { Badge, Button } from "../ui/primitives";

export function PracticeCard({
  question,
  language,
  selectedOptionId,
  onSelect,
  onSubmit,
}: Readonly<{
  question: SingleMcqQuestion;
  language: SourceLanguage;
  selectedOptionId: string;
  onSelect: (optionId: string) => void;
  onSubmit: () => void;
}>) {
  return (
    <div className="practice-stage">
      <div className="stage-heading">
        <span className="stage-heading__index">04</span>
        <div><p className="eyebrow">Practice in bloom</p><h2>One focused question</h2><p>Evidence stays folded until you answer, so recall comes first.</p></div>
      </div>
      <article className="practice-card">
        <div className="practice-card__meta"><Badge tone="indigo"><CircleHelp aria-hidden="true" size={14} />Single choice</Badge><Badge>{question.difficulty}</Badge><span>1 mark</span></div>
        <h3 lang={language === "bn" ? "bn" : undefined}>{question.prompt}</h3>
        <fieldset className="practice-options">
          <legend className="visually-hidden">Choose one answer</legend>
          {question.options.map((option) => (
            <label key={option.id}>
              <input aria-label={`${option.id}. ${option.text}`} checked={selectedOptionId === option.id} name="answer" onChange={() => onSelect(option.id)} type="radio" value={option.id} />
              <span className="practice-options__letter">{option.id}.</span>
              <span lang={language === "bn" ? "bn" : undefined}>{option.text}</span>
            </label>
          ))}
        </fieldset>
        <div className="practice-card__footer"><span><Leaf aria-hidden="true" size={16} />Grounded in your confirmed source</span><Button disabled={selectedOptionId === ""} onClick={onSubmit}>Submit answer</Button></div>
      </article>
    </div>
  );
}
