import { EyeOff, FileWarning, RefreshCw, ScanText } from "lucide-react";

import type { ReviewPage } from "../../../domain/source/page-extraction";
import { AlertBanner, Badge, Button, Field, Textarea } from "../ui/primitives";

const methodLabel = {
  embedded_text: "Embedded text",
  gemma_ocr: "Gemma draft",
  manual_text: "Manual text",
} as const;

export function PageReviewCard(props: Readonly<{
  page: ReviewPage;
  onTextChange: (text: string) => void;
  onIncludedChange: (included: boolean) => void;
  onRetry: () => void;
}>) {
  const { page } = props;
  return (
    <article className={`page-review-card${page.included ? "" : " is-excluded"}`} data-page={page.pageNumber}>
      <header className="page-review-card__header">
        <div><span className="page-review-card__number">{String(page.pageNumber).padStart(2, "0")}</span><div><p className="eyebrow">Source page</p><h3>Page {page.pageNumber}</h3></div></div>
        <div className="page-review-card__controls">
          <Badge tone={page.method === "gemma_ocr" ? "sun" : "indigo"}><ScanText aria-hidden="true" size={14} />{methodLabel[page.method]}</Badge>
          <label className="include-control"><input checked={page.included} onChange={(event) => props.onIncludedChange(event.target.checked)} type="checkbox" /><span>{page.included ? "Included" : "Excluded"}</span></label>
        </div>
      </header>
      <div className="page-review-card__split">
        <section className="page-preview" aria-label={`Original preview for page ${String(page.pageNumber)}`}>
          {page.sourceKind === "sample" ? (
            <div className="page-preview__sample" lang="bn"><span>নমুনা পাঠ · পৃষ্ঠা {page.pageNumber}</span><p>{page.text}</p></div>
          ) : page.sourceKind === "pasted_text" ? (
            <div className="page-preview__missing"><EyeOff aria-hidden="true" /><strong>Pasted text has no page image</strong><p>The editable text beside this panel is the complete source draft.</p></div>
          ) : page.previewUrl === undefined ? (
            <div className="page-preview__missing"><EyeOff aria-hidden="true" /><strong>Preview unavailable after refresh</strong><p>Your extracted text and review choices are preserved. Re-select the source to restore the image.</p></div>
          ) : <img alt={`Original source page ${String(page.pageNumber)}`} src={page.previewUrl} />}
        </section>
        <section className="page-editor">
          <Field id={`page-text-${String(page.pageNumber)}`} label="Editable extraction" hint={page.method === "gemma_ocr" ? "Gemma transcription is a draft—correct it before confirmation." : "Check reading order, headings, and missing words."}>
            <Textarea id={`page-text-${String(page.pageNumber)}`} lang={/[\u0980-\u09FF]/u.test(page.text) ? "bn" : undefined} value={page.text} onChange={(event) => props.onTextChange(event.target.value)} />
          </Field>
          {page.status === "processing" ? <div className="page-inline-status" role="status"><RefreshCw aria-hidden="true" size={16} />Transcribing this page…</div> : null}
          {page.error === undefined ? null : <AlertBanner tone="danger" title="This page needs attention" role="alert">{page.error} Your other reviewed pages are preserved.</AlertBanner>}
          {page.uncertainSegments.length > 0 ? (
            <div className="uncertainty-panel"><strong><FileWarning aria-hidden="true" size={16} />Check uncertain text</strong><ul>{page.uncertainSegments.map((segment, index) => <li key={`${segment.text}-${String(index)}`}><q>{segment.text}</q><span>{segment.reason}</span></li>)}</ul></div>
          ) : null}
          {page.warnings.length > 0 ? <ul className="page-warnings">{page.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          {page.method === "gemma_ocr" && page.status !== "processing" ? <Button size="small" variant="quiet" disabled={page.transcriptionImage === undefined} onClick={props.onRetry}><RefreshCw aria-hidden="true" size={14} />Retry transcription</Button> : null}
        </section>
      </div>
    </article>
  );
}
