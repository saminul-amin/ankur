import { FileImage, FileText, LockKeyhole, Sparkles, Upload } from "lucide-react";

import { AlertBanner, Button, Field, SegmentedControl, Textarea } from "../ui/primitives";

export type SourceKind = "text" | "pdf" | "images";

interface SourceCanvasProps {
  readonly sourceKind: SourceKind;
  readonly draftText: string;
  readonly onSourceKindChange: (kind: SourceKind) => void;
  readonly onDraftChange: (text: string) => void;
  readonly onReviewText: () => void;
  readonly onPdf: (file: File | undefined) => void;
  readonly onImages: (files: readonly File[]) => void;
  readonly onSample: () => void;
  readonly onResumeReview: () => void;
  readonly hasReviewDraft: boolean;
  readonly disabled?: boolean;
}

export function SourceCanvas(props: Readonly<SourceCanvasProps>) {
  return (
    <div className="source-canvas">
      <div className="stage-heading">
        <span className="stage-heading__index">01</span>
        <div><p className="eyebrow">Plant the source</p><h2>What would you like to learn?</h2><p>Choose one trusted source. Every page stays editable until you explicitly confirm it.</p></div>
      </div>
      <SegmentedControl
        label="Source format"
        onChange={props.onSourceKindChange}
        options={[
          { value: "text", label: "Paste text", icon: <FileText aria-hidden="true" size={17} /> },
          { value: "pdf", label: "PDF", icon: <Upload aria-hidden="true" size={17} /> },
          { value: "images", label: "Page images", icon: <FileImage aria-hidden="true" size={17} /> },
        ]}
        value={props.sourceKind}
      />

      {props.sourceKind === "text" ? (
        <div className="source-canvas__form">
          <Field id="source-text" label="Learning material" hint="Bengali, English, or a natural mix of both · up to 25,000 characters">
            <Textarea
              id="source-text"
              maxLength={25_000}
              onChange={(event) => props.onDraftChange(event.target.value)}
              placeholder="Paste a lesson, passage, or study note…"
              value={props.draftText}
            />
          </Field>
          <div className="stage-actions"><Button disabled={props.disabled} onClick={props.onReviewText}>Review pasted text</Button></div>
        </div>
      ) : props.sourceKind === "pdf" ? (
        <div className="drop-card">
          <span className="drop-card__icon"><Upload aria-hidden="true" size={23} /></span>
          <div><h3>Choose one PDF</h3><p>Digital, scanned, and mixed pages are inspected independently in your browser.</p></div>
          <label className="ui-button ui-button--secondary ui-button--default" htmlFor="pdf-file">Choose PDF</label>
          <input className="visually-hidden" disabled={props.disabled} id="pdf-file" type="file" accept="application/pdf,.pdf" onChange={(event) => props.onPdf(event.target.files?.[0])} />
          <span className="drop-card__limit">PDF · up to 3 pages · 8 MB total</span>
        </div>
      ) : (
        <div className="drop-card">
          <span className="drop-card__icon"><FileImage aria-hidden="true" size={23} /></span>
          <div><h3>Choose page images</h3><p>Select one to three ordered JPG, PNG, or WebP pages for editable Gemma transcription.</p></div>
          <label className="ui-button ui-button--secondary ui-button--default" htmlFor="image-files">Choose images</label>
          <input className="visually-hidden" disabled={props.disabled} id="image-files" multiple type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => props.onImages(Array.from(event.target.files ?? []))} />
          <span className="drop-card__limit">1–3 images · 8 MB combined</span>
        </div>
      )}

      <AlertBanner tone="info" title="Private by design">
        <span><LockKeyhole aria-hidden="true" size={15} /> PDFs are parsed and rendered on this device. Only one compressed page image at a time is sent when transcription is needed.</span>
      </AlertBanner>

      {props.hasReviewDraft ? (
        <aside className="resume-review">
          <div><strong>Your current review is still here</strong><p>Return without re-selecting the original file. Saved text, warnings, edits, and page choices are preserved.</p></div>
          <Button variant="quiet" onClick={props.onResumeReview}>Return to page review</Button>
        </aside>
      ) : null}

      <aside className="sample-callout">
        <span><Sparkles aria-hidden="true" size={18} /></span>
        <div><strong>Explore mixed-page review without a provider call</strong><p>Use a fixed three-page Bengali sample with embedded and OCR-labelled pages.</p></div>
        <Button variant="secondary" onClick={props.onSample}>Try mixed-source sample</Button>
      </aside>
    </div>
  );
}
