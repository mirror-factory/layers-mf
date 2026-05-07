#!/usr/bin/env node
/**
 * Convert all DOCX/XLSX documents to PDF for unified viewing.
 * Requires LibreOffice installed: brew install --cask libreoffice
 *
 * Usage: npx tsx scripts/convert-docs-to-pdf.ts
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const DOCS_DIR = path.join(process.cwd(), "public", "portal-docs", "bluewave");
const SOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice";

function convertToPdf(inputPath: string, outputDir: string): string | null {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== ".docx" && ext !== ".xlsx") return null;

  const baseName = path.basename(inputPath, ext);
  const pdfPath = path.join(outputDir, `${baseName}.pdf`);

  // Skip if PDF already exists and is newer than source
  if (fs.existsSync(pdfPath)) {
    const srcStat = fs.statSync(inputPath);
    const pdfStat = fs.statSync(pdfPath);
    if (pdfStat.mtimeMs > srcStat.mtimeMs) {
      console.log(`  ✓ ${baseName}.pdf (cached)`);
      return pdfPath;
    }
  }

  try {
    console.log(`  Converting ${path.basename(inputPath)}...`);
    execSync(`"${SOFFICE}" --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`, {
      timeout: 30000,
      stdio: "pipe",
    });

    if (fs.existsSync(pdfPath)) {
      console.log(`  ✓ ${baseName}.pdf`);
      return pdfPath;
    }
  } catch (err) {
    console.error(`  ✗ Failed: ${err instanceof Error ? err.message : err}`);
  }
  return null;
}

function main() {
  console.log("Converting documents to PDF...\n");

  if (!fs.existsSync(SOFFICE)) {
    console.error("LibreOffice not found. Install: brew install --cask libreoffice");
    process.exit(1);
  }

  // Find all DOCX/XLSX files recursively
  const findFiles = (dir: string): string[] => {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findFiles(fullPath));
      } else if (/\.(docx|xlsx)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  };

  const files = findFiles(DOCS_DIR);
  console.log(`Found ${files.length} files to convert:\n`);

  const converted: { original: string; pdf: string }[] = [];

  for (const file of files) {
    const outputDir = path.dirname(file);
    const pdf = convertToPdf(file, outputDir);
    if (pdf) {
      converted.push({
        original: path.relative(path.join(process.cwd(), "public"), file),
        pdf: path.relative(path.join(process.cwd(), "public"), pdf),
      });
    }
  }

  console.log(`\n✓ Converted ${converted.length} files`);

  // Output mapping for updating bluewave-docs.ts
  console.log("\nPDF mappings:");
  for (const { original, pdf } of converted) {
    console.log(`  ${original} → ${pdf}`);
  }
}

main();
