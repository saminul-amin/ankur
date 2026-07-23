import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { chromium } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { evaluationMaterialSchema } from "../../src/shared/evaluation/task06-schemas";
import {
  evaluationCorpus,
  goldenDemoMaterial,
  materialText,
  type EvaluationCorpusMaterial,
} from "./corpus";

const PUBLIC_ROOT = resolve("evaluation/corpus/public");
const FIXTURES_ROOT = resolve(PUBLIC_ROOT, "fixtures");

function sha256(value: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function renderPageImage(
  material: EvaluationCorpusMaterial,
  outputPath: string,
  pages = material.pages,
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
    const body = pages.map((item) =>
      `<section>${item.text
        .split(/\n\s*\n/u)
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("")}</section>`,
    ).join("");
    await page.setContent(`<!doctype html><html lang="${material.language === "bn" ? "bn" : "en"}"><head><meta charset="utf-8"><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; background: #ebe7da; color: #173c31; }
      body { min-height: 1754px; padding: 104px; font-family: "Noto Sans Bengali", "Nirmala UI", "Segoe UI", sans-serif; }
      section { min-height: 1546px; padding: 92px 88px; border: 2px solid #bad3bf; border-radius: 24px; background: #fffdf5; box-shadow: 0 18px 54px rgba(20,58,47,.12); }
      p { margin: 0 0 34px; font-size: 35px; line-height: 1.75; }
    </style></head><body>${body}</body></html>`);
    await page.screenshot({ path: resolve(outputPath), fullPage: true });
  } finally {
    await browser.close();
  }
}

function wrapText(value: string, maxCharacters = 82): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\n\s*\n/u)) {
    let line = "";
    for (const word of paragraph.split(/\s+/u)) {
      if (`${line} ${word}`.trim().length > maxCharacters) {
        if (line.length > 0) lines.push(line);
        line = word;
      } else {
        line = `${line} ${word}`.trim();
      }
    }
    if (line.length > 0) lines.push(line);
    lines.push("");
  }
  return lines;
}

async function addDigitalPage(document: PDFDocument, text: string) {
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([612, 792]);
  page.drawRectangle({ x: 36, y: 36, width: 540, height: 720, color: rgb(1, 0.995, 0.965), borderColor: rgb(0.72, 0.83, 0.75), borderWidth: 1 });
  let y = 700;
  for (const line of wrapText(text)) {
    if (line.length === 0) {
      y -= 12;
      continue;
    }
    page.drawText(line, { x: 58, y, size: 11.5, font, color: rgb(0.08, 0.16, 0.13) });
    y -= 21;
  }
}

async function writeDigitalPdf(material: EvaluationCorpusMaterial): Promise<void> {
  if (material.fixturePath === null) throw new Error("PDF_FIXTURE_PATH_REQUIRED");
  const document = await PDFDocument.create();
  for (const page of material.pages) await addDigitalPage(document, page.text);
  await writeFile(resolve(material.fixturePath), await document.save());
}

async function writeMixedPdf(material: EvaluationCorpusMaterial): Promise<void> {
  if (material.fixturePath === null) throw new Error("PDF_FIXTURE_PATH_REQUIRED");
  const scannedPage = material.pages.find((page) => page.route === "page_transcription");
  if (scannedPage === undefined) throw new Error("SCANNED_FIXTURE_REQUIRED");
  const scannedPagePath = resolve(FIXTURES_ROOT, `${material.id}-page-${String(scannedPage.pageNumber)}.png`);
  await renderPageImage(material, scannedPagePath, [scannedPage]);
  const document = await PDFDocument.create();
  for (const page of material.pages) {
    if (page.route === "page_transcription") {
      const bytes = new Uint8Array(await readFile(scannedPagePath));
      const image = await document.embedPng(bytes);
      const pdfPage = document.addPage([612, 792]);
      const scale = Math.min(536 / image.width, 700 / image.height);
      pdfPage.drawImage(image, {
        x: (612 - image.width * scale) / 2,
        y: (792 - image.height * scale) / 2,
        width: image.width * scale,
        height: image.height * scale,
      });
    } else {
      await addDigitalPage(document, page.text);
    }
  }
  await writeFile(resolve(material.fixturePath), await document.save());
}

async function writeMaterialText(material: EvaluationCorpusMaterial): Promise<void> {
  await writeFile(resolve(PUBLIC_ROOT, "texts", `${material.id}.txt`), `${materialText(material)}\n`, "utf8");
}

function manifestEntry(material: EvaluationCorpusMaterial) {
  return evaluationMaterialSchema.parse({
    schemaVersion: "evaluation-material.v1",
    materialId: material.id,
    title: material.title,
    domain: material.domain,
    language: material.language,
    inputType: material.inputType,
    pageCount: material.pages.length,
    fixturePath: material.fixturePath,
    licence: material.licence,
    provenance: material.provenance,
    sourceUrl: null,
    redistributionAllowed: true,
    publicSafe: material.publicSafe,
    contentHash: sha256(materialText(material).normalize("NFC")),
    learnerPriorityHash: sha256(material.learnerPriority.normalize("NFC")),
    manualVerificationStatus: "pending",
    reviewerNotes: "Team-authored reference prepared; independent human source-text verification is pending.",
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    pages: material.pages.map((page) => ({
      pageNumber: page.pageNumber,
      route: page.route,
      expectedText: page.text,
      confirmedText: page.text,
      expectedTextHash: sha256(page.text.normalize("NFC")),
      confirmedTextHash: sha256(page.text.normalize("NFC")),
    })),
  });
}

async function main(): Promise<void> {
  await Promise.all([
    mkdir(FIXTURES_ROOT, { recursive: true }),
    mkdir(resolve(PUBLIC_ROOT, "texts"), { recursive: true }),
  ]);

  for (const material of evaluationCorpus.filter((item) => item.inputType === "page_image")) {
    if (material.fixturePath === null) throw new Error("IMAGE_FIXTURE_PATH_REQUIRED");
    await renderPageImage(material, material.fixturePath);
  }
  for (const material of evaluationCorpus.filter((item) => item.inputType === "digital_pdf")) {
    await writeDigitalPdf(material);
  }
  for (const material of evaluationCorpus.filter((item) => item.inputType === "mixed_pdf")) {
    await writeMixedPdf(material);
  }
  await Promise.all([...evaluationCorpus, goldenDemoMaterial].map(writeMaterialText));

  const manifest = {
    schemaVersion: "evaluation-corpus.v1",
    licenceNotice: "All seven materials are original Team Hotasha text released for this evaluation under CC BY 4.0.",
    attribution: "Team Hotasha, Ankur Evaluation Corpus, 2026.",
    humanVerificationStatus: "pending",
    goldenDemoExpectedOutputPath: "evaluation/corpus/public/golden-demo.expected.json",
    materials: evaluationCorpus.map(manifestEntry),
    goldenDemo: manifestEntry(goldenDemoMaterial),
  };
  const manifestPath = resolve(PUBLIC_ROOT, "manifest.json");
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(resolve(PUBLIC_ROOT, "golden-demo.expected.json"), `${JSON.stringify({
    schemaVersion: "golden-demo-expected.v1",
    materialId: goldenDemoMaterial.id,
    humanVerificationStatus: "pending",
    expectedConcepts: [
      "source selection reduces initial contamination risk",
      "treatment and safe storage are separate barriers",
      "covered storage and low-contact dispensing reduce recontamination",
    ],
    requiredSourceClaims: [
      { pageNumber: 1, claim: "Boiling can reduce germs." },
      { pageNumber: 1, claim: "Treated water can be recontaminated in a dirty container." },
      { pageNumber: 1, claim: "Treatment and safe storage are both required in the household safety chain." },
    ],
    assessmentComposition: [
      { type: "single_mcq", marks: 1 },
      { type: "short_written", marks: 5 },
    ],
    groundingRule: "Every generated concept, question, rubric criterion, and revision item must cite a confirmed immutable segment from this material.",
  }, null, 2)}\n`, "utf8");
  process.stdout.write(`Generated ${String(evaluationCorpus.length)} corpus fixtures plus one golden-demo source.\n`);
}

void main().catch((error: unknown) => {
  const code = error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
    ? error.message
    : "CORPUS_GENERATION_FAILED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
