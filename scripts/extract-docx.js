#!/usr/bin/env node
/**
 * Extract text from Word (.docx) and Excel (.xlsx) files in the bluewave portal docs.
 * Outputs a JSON manifest: public/portal-docs/bluewave/_manifest.json
 */
const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const XLSX = require("xlsx");

const BASE = path.resolve(__dirname, "../public/portal-docs/bluewave");

const DOCS = [
  // Root-level docs
  { file: "BlueWave_CallGuide_20260331.docx", title: "BlueWave Call Guide", category: "Planning" },
  { file: "Development Scope.docx", title: "Development Scope", category: "Core Documents" },
  { file: "Executive Summary.docx", title: "Executive Summary", category: "Core Documents" },
  { file: "Project_Intake_BlueWave_Aqueduct.docx", title: "Project Intake — Aqueduct", category: "Planning" },
  { file: "Proposal_BlueWave_Swell.docx", title: "Proposal — Swell", category: "Core Documents" },
  { file: "Bluewave_high_level_MVP_architecture.png", title: "High-Level MVP Architecture", category: "Architecture" },
  // Proposal Library
  { file: "proposal-library/Competitive Landscape.docx", title: "Competitive Landscape", category: "Proposal Library" },
  { file: "proposal-library/Cost Of Inaction.docx", title: "Cost of Inaction", category: "Proposal Library" },
  { file: "proposal-library/DayInTheLife_BlueWave_Swell.docx", title: "Day in the Life — Swell", category: "Proposal Library" },
  { file: "proposal-library/FAQ.docx", title: "FAQ", category: "Proposal Library" },
  { file: "proposal-library/Proposal.docx", title: "Full Proposal", category: "Proposal Library" },
  { file: "proposal-library/ROI_BlueWave_Swell.xlsx", title: "ROI Analysis — Swell", category: "Proposal Library" },
];

async function extractDocx(filepath) {
  try {
    const result = await mammoth.extractRawText({ path: filepath });
    return { text: result.value, html: null };
  } catch (err) {
    console.error(`  ✗ Failed to extract ${filepath}: ${err.message}`);
    return { text: "", html: null };
  }
}

async function extractDocxHtml(filepath) {
  try {
    const result = await mammoth.convertToHtml({ path: filepath });
    const textResult = await mammoth.extractRawText({ path: filepath });
    return { text: textResult.value, html: result.value };
  } catch (err) {
    console.error(`  ✗ Failed to extract ${filepath}: ${err.message}`);
    return { text: "", html: null };
  }
}

function extractXlsx(filepath) {
  try {
    const workbook = XLSX.readFile(filepath);
    const sheets = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      sheets.push({ name, csv, rows: json.length });
    }
    const text = sheets.map(s => `Sheet: ${s.name}\n${s.csv}`).join("\n\n");
    return { text, sheets };
  } catch (err) {
    console.error(`  ✗ Failed to extract ${filepath}: ${err.message}`);
    return { text: "", sheets: [] };
  }
}

function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx" || ext === ".doc") return "docx";
  if (ext === ".xlsx" || ext === ".xls") return "xlsx";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) return "image";
  return "other";
}

async function main() {
  console.log("Extracting text from bluewave documents...\n");
  
  const manifest = [];
  
  for (const doc of DOCS) {
    const filepath = path.join(BASE, doc.file);
    const type = getFileType(doc.file);
    const stat = fs.existsSync(filepath) ? fs.statSync(filepath) : null;
    
    if (!stat) {
      console.log(`  ⊘ Skipping ${doc.file} (not found)`);
      continue;
    }
    
    const entry = {
      id: doc.file.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase(),
      title: doc.title,
      filename: doc.file,
      type,
      category: doc.category,
      url: `/portal-docs/bluewave/${doc.file}`,
      sizeBytes: stat.size,
      sizeHuman: stat.size > 1024 * 1024
        ? `${(stat.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(stat.size / 1024)} KB`,
      extractedText: "",
      extractedHtml: null,
    };
    
    if (type === "docx") {
      console.log(`  → Extracting: ${doc.title} (.docx)`);
      const { text, html } = await extractDocxHtml(filepath);
      entry.extractedText = text;
      entry.extractedHtml = html;
    } else if (type === "xlsx") {
      console.log(`  → Extracting: ${doc.title} (.xlsx)`);
      const { text } = extractXlsx(filepath);
      entry.extractedText = text;
    } else if (type === "image") {
      console.log(`  → Image: ${doc.title}`);
      entry.extractedText = `[Image: ${doc.title}]`;
    }
    
    manifest.push(entry);
  }
  
  // Write manifest
  const manifestPath = path.join(BASE, "_manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ Manifest written to ${manifestPath}`);
  console.log(`  ${manifest.length} documents processed`);
  
  // Also write a text-only version for chat ingestion (smaller file)
  const textManifest = manifest.map(d => ({
    id: d.id,
    title: d.title,
    type: d.type,
    category: d.category,
    url: d.url,
    sizeHuman: d.sizeHuman,
    extractedText: d.extractedText,
  }));
  const textPath = path.join(BASE, "_text-manifest.json");
  fs.writeFileSync(textPath, JSON.stringify(textManifest, null, 2));
  console.log(`✓ Text manifest written to ${textPath}`);
}

main().catch(console.error);
