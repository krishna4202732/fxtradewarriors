// Journal export helpers: CSV (dependency-free) and PDF (jsPDF + autotable via CDN,
// with a styled print-window fallback when the CDN is unavailable).

import { INSTRUMENTS } from "./config.js";
import {
  formatCurrency,
  formatLot,
  formatPrice,
  formatRatio,
} from "./calculator.js";
import { formatDuration } from "./sessions.js";

const BRAND = "FX Trade Warriors";

function getInstrument(symbol) {
  return INSTRUMENTS[symbol] || null;
}

function getDirection(entry) {
  if (!Number.isFinite(Number(entry.entryPrice)) || !Number.isFinite(Number(entry.stopLoss))) {
    return "--";
  }

  return Number(entry.stopLoss) < Number(entry.entryPrice) ? "Long" : "Short";
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTradeDate(entry) {
  const source = entry.entryTime || entry.createdAt;

  if (!source) {
    return "--";
  }

  const date = new Date(source);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function signedCurrency(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "--";
  }

  if (number > 0) {
    return `+${formatCurrency(number)}`;
  }

  if (number < 0) {
    return `-${formatCurrency(Math.abs(number))}`;
  }

  return formatCurrency(0);
}

// Net trade result = PnL - commission - swap. Uses the stored value when present,
// otherwise derives it so older entries (no stored field) still export correctly.
function netTradeResult(entry) {
  if (Number.isFinite(Number(entry.netTradeResult))) {
    return Number(entry.netTradeResult);
  }

  return (
    (Number(entry.finalTradePnL) || 0) -
    (Number(entry.commissionPaid) || 0) -
    (Number(entry.swapPaid) || 0)
  );
}

function combineNotes(entry) {
  return [
    entry.entryLogic ? `Entry: ${entry.entryLogic}` : "",
    entry.exitLogic ? `Exit: ${entry.exitLogic}` : "",
    entry.mistakes ? `Mistakes: ${entry.mistakes}` : "",
    entry.lessonsLearned ? `Lessons: ${entry.lessonsLearned}` : "",
    entry.notes ? `Notes: ${entry.notes}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function priceOrDash(value, instrument) {
  return Number.isFinite(Number(value)) ? formatPrice(Number(value), instrument || INSTRUMENTS.EURUSD) : "--";
}

// --- Date range + rule reports --------------------------------------------

// YYYY-MM-DD key for an entry, from its entry time (falls back to createdAt).
function entryDateKey(entry) {
  return String(entry.entryTime || entry.createdAt || "").slice(0, 10);
}

// Filters entries to an inclusive [fromDate, toDate] range (either bound optional;
// both are YYYY-MM-DD). Entries without a usable date are kept only when no range
// is set, so an unfiltered export still includes everything it did before.
function filterEntriesByRange(entries, fromDate, toDate) {
  if (!fromDate && !toDate) {
    return entries;
  }

  return entries.filter((entry) => {
    const key = entryDateKey(entry);

    if (!key) {
      return false;
    }

    if (fromDate && key < fromDate) {
      return false;
    }

    if (toDate && key > toDate) {
      return false;
    }

    return true;
  });
}

function ruleResultMark(result) {
  if (!result || result.passed === null || result.passed === undefined) {
    return "-";
  }

  return result.passed ? "Pass" : "Fail";
}

function customRulesSummary(report) {
  const list = Array.isArray(report.customRules) ? report.customRules : [];

  if (list.length === 0) {
    return "No custom rules";
  }

  return list
    .map((rule) => `${rule.title}: ${rule.status ? "Pass" : "Fail"}`)
    .join("; ");
}

function overallScoreLabel(report) {
  if (!report.totalRules) {
    return "-";
  }

  return `${report.passedRules}/${report.totalRules} (${report.overallScorePercent}%)`;
}

// The labelled rows that make up a per-day Rule Summary block, shared by CSV/PDF.
function ruleSummaryRows(report) {
  return [
    ["Date", report.reportDate || "--"],
    ["Account", report.accountName || "--"],
    ["Daily Risk Cap", ruleResultMark(report.dailyRisk)],
    ["Max Risk Per Trade", ruleResultMark(report.riskPerTrade)],
    ["Max Trades Per Day", ruleResultMark(report.tradesPerDay)],
    ["Custom Rules", customRulesSummary(report)],
    ["Overall Score", overallScoreLabel(report)],
  ];
}

// Groups reports by their date key for "append at end of each day" output.
function groupReportsByDate(reports) {
  const map = new Map();

  (reports || []).forEach((report) => {
    const key = report.reportDate || "";
    const bucket = map.get(key) || [];
    bucket.push(report);
    map.set(key, bucket);
  });

  return map;
}

// Sorted unique day keys present across the entries.
function entryDayKeys(entries) {
  const keys = new Set();
  entries.forEach((entry) => {
    const key = entryDateKey(entry);
    if (key) {
      keys.add(key);
    }
  });
  return [...keys].sort();
}

function timestamp() {
  return new Date()
    .toISOString()
    .slice(0, 16)
    .replace("T", "_")
    .replace(/:/g, "-");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// --- CSV ------------------------------------------------------------------------

const CSV_COLUMNS = [
  ["Trade Date", (entry) => formatTradeDate(entry)],
  ["Account", (entry) => entry.accountName || ""],
  ["Symbol", (entry) => entry.market || ""],
  ["Direction", (entry) => getDirection(entry)],
  ["Entry Time", (entry) => formatDateTime(entry.entryTime)],
  ["Exit Time", (entry) => formatDateTime(entry.exitTime)],
  ["Entry Session", (entry) => entry.entrySessionLabel || "--"],
  ["Exit Session", (entry) => entry.exitSessionLabel || "--"],
  ["Duration", (entry) => formatDuration(entry.durationMinutes)],
  ["Entry Price", (entry) => priceOrDash(entry.entryPrice, getInstrument(entry.market))],
  ["Stop Loss", (entry) => priceOrDash(entry.stopLoss, getInstrument(entry.market))],
  ["Take Profit", (entry) => priceOrDash(entry.takeProfit, getInstrument(entry.market))],
  ["Exit Price", (entry) => priceOrDash(entry.exitPrice, getInstrument(entry.market))],
  ["Lot Size", (entry) => formatLot(Number(entry.lotSize))],
  ["Outcome", (entry) => entry.outcome || ""],
  ["Risk (Potential Loss)", (entry) => formatCurrency(Number(entry.potentialLoss) || 0)],
  ["Potential Profit", (entry) => formatCurrency(Number(entry.potentialProfit) || 0)],
  ["Risk Reward", (entry) => formatRatio(Number(entry.riskReward) || 0)],
  ["Final PnL", (entry) => signedCurrency(entry.finalTradePnL)],
  ["Commission Paid", (entry) => formatCurrency(Number(entry.commissionPaid) || 0)],
  ["Swap Paid", (entry) => signedCurrency(entry.swapPaid)],
  ["Net Trade Result", (entry) => signedCurrency(netTradeResult(entry))],
  ["Balance Before", (entry) => formatCurrency(Number(entry.accountBalanceBefore) || 0)],
  ["Balance After", (entry) => formatCurrency(Number(entry.accountBalanceAfter) || 0)],
  ["Entry Logic", (entry) => entry.entryLogic || ""],
  ["Exit Logic", (entry) => entry.exitLogic || ""],
  ["Mistakes", (entry) => entry.mistakes || ""],
  ["Lessons Learned", (entry) => entry.lessonsLearned || ""],
  ["Additional Notes", (entry) => entry.notes || ""],
];

function escapeCsvField(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function exportJournalCsv(entries, user, options = {}) {
  const { fromDate = "", toDate = "", includeRuleReports = false, ruleReports = [] } = options;
  const scopedEntries = filterEntriesByRange(entries, fromDate, toDate);
  const headerRow = CSV_COLUMNS.map(([label]) => escapeCsvField(label)).join(",");
  const lines = [headerRow];

  if (includeRuleReports) {
    // Append each day's trades followed by that day's Rule Summary block(s).
    const reportsByDate = groupReportsByDate(ruleReports);

    entryDayKeys(scopedEntries).forEach((dayKey) => {
      scopedEntries
        .filter((entry) => entryDateKey(entry) === dayKey)
        .forEach((entry) => {
          lines.push(CSV_COLUMNS.map(([, accessor]) => escapeCsvField(accessor(entry))).join(","));
        });

      (reportsByDate.get(dayKey) || []).forEach((report) => {
        lines.push("");
        lines.push(escapeCsvField("Rule Summary"));
        ruleSummaryRows(report).forEach(([label, value]) => {
          lines.push(`${escapeCsvField(label)},${escapeCsvField(value)}`);
        });
      });
    });
  } else {
    scopedEntries.forEach((entry) => {
      lines.push(CSV_COLUMNS.map(([, accessor]) => escapeCsvField(accessor(entry))).join(","));
    });
  }

  // Prepend BOM so Excel reads UTF-8 correctly.
  const csv = `﻿${lines.join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const owner = user && user.username ? `_${user.username}` : "";

  triggerDownload(blob, `fx-trade-warriors-journal${owner}_${timestamp()}.csv`);
}

// --- PDF ------------------------------------------------------------------------

// Compact datetime to keep the wide table readable, e.g. "14 Jun, 06:00 PM".
function formatDateTimeCompact(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Single source of truth: [header, accessor]. Both the table headers and each
// row are derived from this, so they can never drift out of alignment.
const PDF_FIELDS = [
  ["Trade Date", (entry) => formatTradeDate(entry)],
  ["Account", (entry) => entry.accountName || "--"],
  ["Symbol", (entry) => entry.market || "--"],
  ["Direction", (entry) => getDirection(entry)],
  ["Outcome", (entry) => entry.outcome || "--"],
  ["Entry Time", (entry) => formatDateTimeCompact(entry.entryTime)],
  ["Exit Time", (entry) => formatDateTimeCompact(entry.exitTime)],
  ["Entry Session", (entry) => entry.entrySessionLabel || "--"],
  ["Exit Session", (entry) => entry.exitSessionLabel || "--"],
  ["Duration", (entry) => formatDuration(entry.durationMinutes)],
  ["Entry Price", (entry) => priceOrDash(entry.entryPrice, getInstrument(entry.market))],
  ["Stop Loss", (entry) => priceOrDash(entry.stopLoss, getInstrument(entry.market))],
  ["Take Profit", (entry) => priceOrDash(entry.takeProfit, getInstrument(entry.market))],
  ["Lot Size", (entry) => formatLot(Number(entry.lotSize))],
  ["Risk", (entry) => formatCurrency(Number(entry.potentialLoss) || 0)],
  ["Potential Profit", (entry) => formatCurrency(Number(entry.potentialProfit) || 0)],
  ["Risk Reward", (entry) => formatRatio(Number(entry.riskReward) || 0)],
  ["Profit/Loss", (entry) => signedCurrency(entry.finalTradePnL)],
  ["Commission", (entry) => formatCurrency(Number(entry.commissionPaid) || 0)],
  ["Swap", (entry) => signedCurrency(entry.swapPaid)],
  ["Net Result", (entry) => signedCurrency(netTradeResult(entry))],
  ["Balance Before", (entry) => formatCurrency(Number(entry.accountBalanceBefore) || 0)],
  ["Balance After", (entry) => formatCurrency(Number(entry.accountBalanceAfter) || 0)],
  ["Notes", (entry) => combineNotes(entry) || "--"],
];

const PDF_COLUMNS = PDF_FIELDS.map(([label]) => label);
const PDF_NOTES_INDEX = PDF_COLUMNS.indexOf("Notes");

function buildPdfRow(entry) {
  return PDF_FIELDS.map(([, accessor]) => accessor(entry));
}

function getJsPdf() {
  const namespace = window.jspdf || window.jsPDF;

  if (namespace && namespace.jsPDF) {
    return namespace.jsPDF;
  }

  if (typeof window.jsPDF === "function") {
    return window.jsPDF;
  }

  return null;
}

// Builds the autotable body. Without rule reports it's one row per entry. With
// them, each day's rows are followed by full-width Rule Summary rows (a heading
// row + one row per summary field), using `colSpan` so they read like a block.
function buildPdfBody(entries, includeRuleReports, ruleReports) {
  const colCount = PDF_COLUMNS.length;

  if (!includeRuleReports) {
    return entries.map(buildPdfRow);
  }

  const reportsByDate = groupReportsByDate(ruleReports);
  const body = [];

  entryDayKeys(entries).forEach((dayKey) => {
    entries
      .filter((entry) => entryDateKey(entry) === dayKey)
      .forEach((entry) => body.push(buildPdfRow(entry)));

    (reportsByDate.get(dayKey) || []).forEach((report) => {
      body.push([
        {
          content: "Rule Summary",
          colSpan: colCount,
          styles: { fontStyle: "bold", fillColor: [13, 26, 51], textColor: [255, 255, 255] },
        },
      ]);

      ruleSummaryRows(report).forEach(([label, value]) => {
        body.push([
          { content: `${label}: ${value}`, colSpan: colCount, styles: { fillColor: [235, 240, 248] } },
        ]);
      });
    });
  });

  return body;
}

export function exportJournalPdf(entries, user, options = {}) {
  const { fromDate = "", toDate = "", includeRuleReports = false, ruleReports = [] } = options;
  const scopedEntries = filterEntriesByRange(entries, fromDate, toDate);
  const JsPdf = getJsPdf();

  if (!JsPdf) {
    return exportJournalPdfFallback(scopedEntries, user, options);
  }

  const doc = new JsPdf({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedOn = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const ownerLine = user && user.displayName ? `Trader: ${user.displayName}` : "";

  doc.autoTable({
    head: [PDF_COLUMNS],
    body: buildPdfBody(scopedEntries, includeRuleReports, ruleReports),
    startY: 86,
    margin: { top: 86, left: 18, right: 18, bottom: 32 },
    tableWidth: "auto",
    styles: { fontSize: 6, cellPadding: 2.5, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [13, 26, 51], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6 },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    columnStyles: { [PDF_NOTES_INDEX]: { cellWidth: 120 } },
    didDrawPage: (data) => {
      doc.setFontSize(16);
      doc.setTextColor(13, 26, 51);
      doc.text(BRAND, data.settings.margin.left, 40);
      doc.setFontSize(10);
      doc.setTextColor(90, 100, 120);
      doc.text("Trading Journal Export", data.settings.margin.left, 58);

      const metaParts = [ownerLine, `Generated: ${generatedOn}`, `Trades: ${scopedEntries.length}`].filter(Boolean);
      doc.text(metaParts.join("   |   "), data.settings.margin.left, 72);

      const pageNumber = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140, 150, 170);
      doc.text(
        `Page ${pageNumber}`,
        pageWidth - data.settings.margin.right,
        doc.internal.pageSize.getHeight() - 18,
        { align: "right" },
      );
    },
  });

  const owner = user && user.username ? `_${user.username}` : "";
  doc.save(`fx-trade-warriors-journal${owner}_${timestamp()}.pdf`);
}

// Print-window fallback used when the jsPDF CDN failed to load (e.g. offline).
// `entries` is already range-filtered by the caller; options carries the rule
// reports + include flag.
function exportJournalPdfFallback(entries, user, options = {}) {
  const { includeRuleReports = false, ruleReports = [] } = options;
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    window.alert("Allow pop-ups to export the journal as PDF, or use CSV export.");
    return;
  }

  const generatedOn = new Date().toLocaleString();
  const ownerLine = user && user.displayName ? `Trader: ${user.displayName}` : "";
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const colCount = PDF_COLUMNS.length;
  const entryRow = (entry) =>
    `<tr>${buildPdfRow(entry)
      .map((cell) => `<td>${escapeHtml(cell)}</td>`)
      .join("")}</tr>`;

  let rows;

  if (includeRuleReports) {
    const reportsByDate = groupReportsByDate(ruleReports);
    rows = entryDayKeys(entries)
      .map((dayKey) => {
        const dayRows = entries
          .filter((entry) => entryDateKey(entry) === dayKey)
          .map(entryRow)
          .join("");

        const summaryRows = (reportsByDate.get(dayKey) || [])
          .map((report) => {
            const head = `<tr><td colspan="${colCount}" style="background:#0d1a33;color:#fff;font-weight:bold;">Rule Summary</td></tr>`;
            const body = ruleSummaryRows(report)
              .map(
                ([label, value]) =>
                  `<tr><td colspan="${colCount}" style="background:#ebf0f8;">${escapeHtml(label)}: ${escapeHtml(value)}</td></tr>`,
              )
              .join("");
            return head + body;
          })
          .join("");

        return dayRows + summaryRows;
      })
      .join("");
  } else {
    rows = entries.map(entryRow).join("");
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${BRAND} - Trading Journal</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0d1a33; margin: 24px; }
          header { border-bottom: 3px solid #0d1a33; padding-bottom: 12px; margin-bottom: 18px; }
          h1 { margin: 0; font-size: 22px; }
          .sub { color: #5a647a; font-size: 12px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { background: #0d1a33; color: #fff; text-align: left; padding: 6px; }
          td { border: 1px solid #d6dce8; padding: 6px; vertical-align: top; }
          tbody tr:nth-child(even) td { background: #f4f7fc; }
          @media print { body { margin: 12mm; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <header>
          <h1>${BRAND}</h1>
          <div class="sub">Trading Journal Export &middot; ${ownerLine ? `${ownerLine} &middot; ` : ""}Generated: ${generatedOn} &middot; Trades: ${entries.length}</div>
        </header>
        <table>
          <thead><tr>${PDF_COLUMNS.map((label) => `<th>${label}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload = function () { window.print(); };<\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
