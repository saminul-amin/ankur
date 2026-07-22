import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUTPUT = resolve("evaluation/ingestion/fixtures");
const BENGALI_PAGE = resolve("evaluation/provider-spike/fixtures/bengali-page.png");

function digitalCopy(pageNumber: number): string {
  return `Ankur team-authored digital fixture page ${String(pageNumber)}. Plants use light energy, water, and carbon dioxide to make food. This sentence is intentionally long enough for the page classifier to recognize reliable embedded text.`;
}

async function addDigitalPage(document: PDFDocument, pageNumber: number) {
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([612, 792]);
  page.drawText(`ANKUR INGESTION FIXTURE · PAGE ${String(pageNumber)}`, { x: 54, y: 730, size: 12, font, color: rgb(0.12, 0.32, 0.25) });
  const words = digitalCopy(pageNumber).split(" ");
  let line = "";
  let y = 680;
  for (const word of words) {
    if (`${line} ${word}`.length > 72) {
      page.drawText(line, { x: 54, y, size: 13, font });
      line = word; y -= 24;
    } else line = `${line} ${word}`.trim();
  }
  page.drawText(line, { x: 54, y, size: 13, font });
}

async function addScannedPage(document: PDFDocument, pngBytes: Uint8Array) {
  const image = await document.embedPng(pngBytes);
  const page = document.addPage([612, 792]);
  const scale = Math.min(520 / image.width, 680 / image.height);
  page.drawImage(image, {
    x: (612 - image.width * scale) / 2,
    y: (792 - image.height * scale) / 2,
    width: image.width * scale,
    height: image.height * scale,
  });
}

async function saveDigital() {
  const document = await PDFDocument.create();
  for (let page = 1; page <= 3; page += 1) await addDigitalPage(document, page);
  await writeFile(resolve(OUTPUT, "three-page-digital.pdf"), await document.save());
}

async function saveScanned(pngBytes: Uint8Array) {
  const document = await PDFDocument.create();
  for (let page = 1; page <= 3; page += 1) await addScannedPage(document, pngBytes);
  await writeFile(resolve(OUTPUT, "three-page-scanned.pdf"), await document.save());
}

async function saveMixed(pngBytes: Uint8Array) {
  const document = await PDFDocument.create();
  await addDigitalPage(document, 1);
  await addScannedPage(document, pngBytes);
  await addDigitalPage(document, 3);
  await writeFile(resolve(OUTPUT, "three-page-mixed.pdf"), await document.save());
}

await mkdir(OUTPUT, { recursive: true });
const pngBytes = new Uint8Array(await readFile(BENGALI_PAGE));
await Promise.all([saveDigital(), saveScanned(pngBytes), saveMixed(pngBytes)]);
process.stdout.write(`Generated ingestion fixtures in ${OUTPUT}\n`);
