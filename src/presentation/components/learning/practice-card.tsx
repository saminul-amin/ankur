"use client";

import { ArrowLeft, ArrowRight, CircleHelp, FilePenLine, Leaf } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";

import type { ActivitySet } from "../../../domain/assessments/mcq";
import type { SourceLanguage } from "../../../domain/source/confirmed-source";
import { Badge, Button, Field, Textarea } from "../ui/primitives";

export function PracticeCard({ activitySet, language, currentQuestionIndex, selectedOptionId, writtenAnswer, submitting, confirming, onSelect, onWrittenChange, onPrevious, onNext, onRequestSubmit, onCancelSubmit, onConfirmSubmit }: Readonly<{
  activitySet: ActivitySet;
  language: SourceLanguage;
  currentQuestionIndex: 0 | 1;
  selectedOptionId: string;
  writtenAnswer: string;
  submitting: boolean;
  confirming: boolean;
  onSelect: (optionId: string) => void;
  onWrittenChange: (answer: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onRequestSubmit: () => void;
  onCancelSubmit: () => void;
  onConfirmSubmit: () => void;
}>) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!confirming) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const firstControl = dialog?.querySelector<HTMLElement>("button:not([disabled])");
    firstControl?.focus();
    return () => previousFocusRef.current?.focus();
  }, [confirming]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancelSubmit();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
    const first = controls[0];
    const last = controls.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const question = activitySet.questions[currentQuestionIndex];
  const isMcq = question.type === "single_mcq";
  return (
    <div className="practice-stage">
      <div className="stage-heading">
        <span className="stage-heading__index">04</span>
        <div><p className="eyebrow">Practice in bloom</p><h2>{activitySet.title}</h2><p>Feedback and evidence stay folded until both questions are submitted.</p></div>
      </div>
      <div className="question-progress" aria-label={`Question ${String(currentQuestionIndex + 1)} of 2`}><span>Question {currentQuestionIndex + 1} of 2</span><div aria-hidden="true"><i className="is-complete" /><i className={currentQuestionIndex === 1 ? "is-complete" : undefined} /></div></div>
      <article className="practice-card">
        <div className="practice-card__meta"><Badge tone="indigo">{isMcq ? <CircleHelp aria-hidden="true" size={14} /> : <FilePenLine aria-hidden="true" size={14} />}{isMcq ? "Single choice" : "Short written"}</Badge><Badge>{question.difficulty}</Badge><span>{question.marks} {question.marks === 1 ? "mark" : "marks"}</span></div>
        <h3 lang={language === "bn" ? "bn" : undefined}>{question.prompt}</h3>
        {isMcq ? (
          <fieldset className="practice-options"><legend className="visually-hidden">Choose one answer</legend>{question.options.map((option) => (
            <label key={option.id}><input aria-label={`${option.id}. ${option.text}`} checked={selectedOptionId === option.id} name="answer" onChange={() => onSelect(option.id)} type="radio" value={option.id} /><span className="practice-options__letter">{option.id}.</span><span lang={language === "bn" ? "bn" : undefined}>{option.text}</span></label>
          ))}</fieldset>
        ) : (
          <Field id="written-answer" label="Your short answer" hint={`${question.expectedLength === "one_sentence" ? "Aim for one clear sentence" : "Aim for one short paragraph"} · ${String(writtenAnswer.length)}/3,000`}>
            <Textarea aria-describedby="written-answer-hint" className="written-answer" id="written-answer" lang={language === "bn" ? "bn" : undefined} maxLength={3_000} placeholder={language === "bn" ? "নিশ্চিত উৎসের ভিত্তিতে উত্তর লিখুন…" : "Answer from the confirmed source…"} value={writtenAnswer} onChange={(event) => onWrittenChange(event.target.value)} />
          </Field>
        )}
        <div className="practice-card__footer"><span><Leaf aria-hidden="true" size={16} />Grounded in your confirmed source</span><div>{currentQuestionIndex === 1 ? <Button variant="quiet" onClick={onPrevious}><ArrowLeft aria-hidden="true" size={16} />Previous</Button> : null}{currentQuestionIndex === 0 ? <Button onClick={onNext}>Next question <ArrowRight aria-hidden="true" size={16} /></Button> : <Button disabled={submitting} onClick={onRequestSubmit}>Review and submit</Button>}</div></div>
      </article>
      {confirming ? <div className="submission-backdrop"><section aria-describedby="submit-description" aria-labelledby="submit-title" aria-modal="true" className="submission-dialog" onKeyDown={handleDialogKeyDown} ref={dialogRef} role="dialog"><p className="eyebrow">Final submission</p><h3 id="submit-title">Submit both answers?</h3><p id="submit-description">Feedback appears only after the full assessment. {selectedOptionId === "" || writtenAnswer.trim() === "" ? "One or more answers are blank and will receive zero marks." : "Both answers are ready for grading."}</p><dl><div><dt>MCQ</dt><dd>{selectedOptionId === "" ? "Unanswered" : "Answered"}</dd></div><div><dt>Written</dt><dd>{writtenAnswer.trim() === "" ? "Unanswered" : "Answered"}</dd></div></dl><div><Button variant="quiet" onClick={onCancelSubmit}>Keep editing</Button><Button disabled={submitting} onClick={onConfirmSubmit}>{submitting ? "Submitting…" : "Confirm submission"}</Button></div></section></div> : null}
    </div>
  );
}
