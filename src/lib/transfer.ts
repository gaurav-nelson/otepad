import { inflateSync, strFromU8, strToU8, zipSync } from "fflate";
import {
  TITLE_MAX_LENGTH,
  normalizePadColor,
  normalizeTitle,
  type Pad,
} from "./pads";

export const OTP_EXTENSION = ".otp";

const OTP_FORMAT = "otepad-backup";
const OTP_VERSION = 1;

const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TXT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2000;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_NOTE_TEXT_CHARS = 1_000_000;
const MAX_EOCD_COMMENT_BYTES = 65_535;

export class TransferError extends Error {}

export type ImportedNote = {
  title: string;
  content: string;
  contentFormat: "html" | "markdown";
  color?: string;
  updatedAt: number;
};

export type ImportFileResult = {
  notes: ImportedNote[];
  warnings: string[];
};

export type BatchImportResult = {
  notes: ImportedNote[];
  warnings: string[];
  errors: string[];
  totalFiles: number;
};

/* ------------------------------ export ------------------------------ */

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "BLOCKQUOTE",
  "DIV",
  "DL",
  "DD",
  "DT",
  "FIELDSET",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "OL",
  "P",
  "PRE",
  "TABLE",
  "TR",
  "UL",
]);

export function htmlToPlainText(html: string): string {
  if (typeof document !== "undefined") {
    const host = document.createElement("div");
    host.innerHTML = html || "";
    let out = "";
    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.nodeValue ?? "";
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      const tag = el.tagName;
      if (tag === "BR") {
        out += "\n";
        return;
      }
      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock && out && !out.endsWith("\n")) {
        out += "\n";
      }
      el.childNodes.forEach(visit);
      if (isBlock && out && !out.endsWith("\n")) {
        out += "\n";
      }
    };
    host.childNodes.forEach(visit);
    return out
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Fallback for non-DOM environments (e.g. tests, node, workers)
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function padIndex(i: number): string {
  return String(i + 1).padStart(5, "0");
}

export function otpFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `otepad-export-${now.getFullYear()}${p(now.getMonth() + 1)}${p(
    now.getDate(),
  )}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}${OTP_EXTENSION}`;
}

export function buildOtpBlob(pads: Pad[]): Blob {
  const files: Record<string, Uint8Array> = {};
  const manifestNotes = pads.map((pad, i) => {
    const name = `notes/${padIndex(i)}.txt`;
    files[name] = strToU8(
      pad.contentFormat === "markdown" ? pad.content : htmlToPlainText(pad.content),
    );
    return {
      file: name.slice("notes/".length),
      title: String(pad.title || "").slice(0, TITLE_MAX_LENGTH),
      contentFormat: pad.contentFormat === "markdown" ? "markdown" : "html",
      color: normalizePadColor(pad.color),
      updatedAt: Number.isFinite(pad.updatedAt) ? Math.floor(pad.updatedAt) : Date.now(),
    };
  });
  files["manifest.json"] = strToU8(
    JSON.stringify(
      {
        app: "otepad",
        format: OTP_FORMAT,
        version: OTP_VERSION,
        exportedAt: new Date().toISOString(),
        notes: manifestNotes,
      },
      null,
      2,
    ),
  );
  return new Blob([zipSync(files, { level: 6 }) as BlobPart], {
    type: "application/zip",
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/* ------------------------------ import ------------------------------ */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function textToEditorHtml(text: string): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n");
  return escapeHtml(normalized)
    .split("\n")
    .join("<br>");
}

export function titleFromFileBase(base: string): string {
  return normalizeTitle(base.replace(/\.txt$/i, "")) || "imported";
}

export function uniqueTitle(base: string, taken: Set<string>): string {
  const clean = normalizeTitle(base) || "untitled";
  const key = clean.toLowerCase();
  if (!taken.has(key)) {
    taken.add(key);
    return clean;
  }
  let n = 2;
  while (taken.has(`${key} ${n}`)) n += 1;
  const next = `${clean} ${n}`.slice(0, TITLE_MAX_LENGTH);
  taken.add(`${key} ${n}`);
  return next;
}

type ZipEntry = {
  name: string;
  method: number;
  flags: number;
  crc: number;
  compSize: number;
  uncompSize: number;
  headerOffset: number;
};

function findEocd(bytes: Uint8Array): number {
  const minPos = Math.max(0, bytes.length - 22 - MAX_EOCD_COMMENT_BYTES);
  for (let i = bytes.length - 22; i >= minPos; i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const commentLen = dv.getUint16(i + 20, true);
      if (i + 22 + commentLen === bytes.length) return i;
    }
  }
  throw new TransferError(
    "This file is not a valid otepad (.otp) backup. Please export your pads again or choose a valid .otp file.",
  );
}

function parseCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(bytes);
  const totalEntries = dv.getUint16(eocd + 10, true);
  if (totalEntries > MAX_ARCHIVE_ENTRIES) {
    throw new TransferError(
      `This backup contains ${totalEntries} entries, which exceeds the limit of ${MAX_ARCHIVE_ENTRIES}. Split it into smaller backups and import each one.`,
    );
  }
  let pos = dv.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < totalEntries; i += 1) {
    if (pos + 46 > bytes.length || dv.getUint32(pos, true) !== 0x02014b50) {
      throw new TransferError(
        "The backup archive is corrupted or has an invalid structure. Re-export your pads and try importing the new file.",
      );
    }
    const flags = dv.getUint16(pos + 8, true);
    const method = dv.getUint16(pos + 10, true);
    const crc = dv.getUint32(pos + 16, true);
    const compSize = dv.getUint32(pos + 20, true);
    const uncompSize = dv.getUint32(pos + 24, true);
    const nameLen = dv.getUint16(pos + 28, true);
    const extraLen = dv.getUint16(pos + 30, true);
    const commentLen = dv.getUint16(pos + 32, true);
    const headerOffset = dv.getUint32(pos + 42, true);
    const totalEntryLen = 46 + nameLen + extraLen + commentLen;
    if (pos + totalEntryLen > bytes.length) {
      throw new TransferError(
        "The backup archive is corrupted. Re-export your pads and try importing the new file.",
      );
    }
    entries.push({
      name: strFromU8(bytes.subarray(pos + 46, pos + 46 + nameLen)),
      method,
      flags,
      crc,
      compSize,
      uncompSize,
      headerOffset,
    });
    pos += totalEntryLen;
  }
  return entries;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Of(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function extractEntry(bytes: Uint8Array, entry: ZipEntry): Uint8Array | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const off = entry.headerOffset;
  if (
    off + 30 > bytes.length ||
    dv.getUint32(off, true) !== 0x04034b50 ||
    entry.compSize > bytes.length ||
    entry.uncompSize > MAX_ARCHIVE_UNCOMPRESSED_BYTES
  ) {
    return null;
  }
  const nameLen = dv.getUint16(off + 26, true);
  const extraLen = dv.getUint16(off + 28, true);
  const start = off + 30 + nameLen + extraLen;
  const end = start + entry.compSize;
  if (start > bytes.length || end > bytes.length) return null;

  let out: Uint8Array;
  if (entry.method === 0) {
    out = bytes.subarray(start, end);
  } else if (entry.method === 8) {
    try {
      out = inflateSync(bytes.subarray(start, end));
    } catch {
      return null;
    }
  } else {
    return null;
  }

  if (out.length !== entry.uncompSize) return null;
  if (entry.crc !== 0 && crc32Of(out) !== entry.crc) return null;
  return out;
}

function safeZipBasename(name: string): string | null {
  if (!name || name.includes("\u0000")) return null;
  if (/^(\/|[a-zA-Z]:)/.test(name) || name.includes("..")) return null;
  if (name.includes("__MACOSX") || name.includes(".DS_Store")) return null;
  const base = name.split(/[\\/]/).pop() ?? "";
  if (!base || base.startsWith(".")) return null;
  return base;
}

function noteTitleFor(
  fileName: string,
  manifestTitles: Map<
    string,
    { title: unknown; updatedAt: unknown; contentFormat: unknown; color: unknown }
  >,
): {
  title: string;
  updatedAt?: number;
  contentFormat: "html" | "markdown";
  color?: string;
} {
  const meta = manifestTitles.get(fileName.toLowerCase());
  const title =
    meta && typeof meta.title === "string"
      ? normalizeTitle(meta.title)
      : titleFromFileBase(fileName);
  const updatedAt =
    meta &&
    typeof meta.updatedAt === "number" &&
    Number.isFinite(meta.updatedAt) &&
    meta.updatedAt > 0
      ? Math.floor(meta.updatedAt)
      : undefined;
  return {
    title: title || titleFromFileBase(fileName),
    updatedAt,
    contentFormat: meta?.contentFormat === "markdown" ? "markdown" : "html",
    color: normalizePadColor(meta?.color),
  };
}

function notesFromOtpBytes(
  bytes: Uint8Array,
  sourceName: string,
): ImportFileResult {
  const entries = parseCentralDirectory(bytes);

  let totalUncompressed = 0;
  for (const entry of entries) {
    if ((entry.flags & 0x1) !== 0) {
      throw new TransferError(
        `"${sourceName}" is password-protected. Remove password protection from the archive, then import it again.`,
      );
    }
    totalUncompressed += entry.uncompSize;
  }
  if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
    throw new TransferError(
      `"${sourceName}" uncompresses to more than ${Math.round(
        MAX_ARCHIVE_UNCOMPRESSED_BYTES / 1024 / 1024,
      )} MB. Split your notes into smaller backups and import each one separately.`,
    );
  }

  const manifestEntry = entries.find((e) => e.name === "manifest.json");
  const manifestTitles = new Map<
    string,
    { title: unknown; updatedAt: unknown; contentFormat: unknown; color: unknown }
  >();
  if (manifestEntry) {
    const raw = extractEntry(bytes, manifestEntry);
    if (raw) {
      try {
        const parsed = JSON.parse(strFromU8(raw)) as {
          app?: unknown;
          format?: unknown;
          version?: unknown;
          notes?: unknown;
        };
        if (
          parsed &&
          parsed.format === OTP_FORMAT &&
          parsed.version === OTP_VERSION &&
          Array.isArray(parsed.notes)
        ) {
          for (const item of parsed.notes) {
            if (
              item &&
              typeof item === "object" &&
              typeof (item as { file?: unknown }).file === "string"
            ) {
              const rec = item as {
                file: string;
                title?: unknown;
                updatedAt?: unknown;
                contentFormat?: unknown;
                color?: unknown;
              };
              manifestTitles.set(String(rec.file).toLowerCase(), {
                title: rec.title,
                updatedAt: rec.updatedAt,
                contentFormat: rec.contentFormat,
                color: rec.color,
              });
            }
          }
        } else {
          return {
            notes: [],
            warnings: [
              `"${sourceName}" was created with an incompatible backup format. Re-export your pads using the latest version of otepad and try again.`,
            ],
          };
        }
      } catch {
        // Fall back to raw .txt entries when the manifest JSON cannot be parsed.
      }
    }
  }

  const warnings: string[] = [];
  const notes: ImportedNote[] = [];
  let corrupted = 0;
  let oversize = 0;

  for (const entry of entries) {
    if (entry.name === "manifest.json" || !entry.name.endsWith(".txt")) continue;
    const base = safeZipBasename(entry.name);
    if (!base) continue;

    const raw = extractEntry(bytes, entry);
    if (!raw) {
      corrupted += 1;
      continue;
    }
    if (raw.length > MAX_NOTE_TEXT_CHARS) {
      oversize += 1;
      continue;
    }
    const text = strFromU8(raw);
    const { title, updatedAt, contentFormat, color } = noteTitleFor(base, manifestTitles);
    notes.push({
      title,
      content: contentFormat === "markdown" ? text : textToEditorHtml(text),
      contentFormat,
      color,
      updatedAt: updatedAt ?? Date.now(),
    });
  }

  if (notes.length === 0 && corrupted === 0 && warnings.length === 0) {
    warnings.push(
      `"${sourceName}" does not contain any readable .txt notes. Make sure you selected the correct backup file.`,
    );
  }

  if (corrupted > 0) {
    warnings.push(
      `${corrupted} note${corrupted === 1 ? " was" : "s were"} skipped from "${sourceName}" because the archive data failed its integrity check. Try re-exporting the backup.`,
    );
  }
  if (oversize > 0) {
    warnings.push(
      `${oversize} note${oversize === 1 ? "" : "s"} over ${Math.round(
        MAX_NOTE_TEXT_CHARS / 1000,
      )}k characters were skipped from "${sourceName}". Split large notes before importing.`,
    );
  }
  return { notes, warnings };
}

async function notesFromTxtFile(file: File): Promise<ImportFileResult> {
  if (file.size > MAX_TXT_FILE_BYTES) {
    throw new TransferError(
      `"${file.name}" is larger than ${Math.round(
        MAX_TXT_FILE_BYTES / 1024 / 1024,
      )} MB. Split large text notes into smaller files before importing.`,
    );
  }
  const text = await file.text();
  if (text.includes("\u0000")) {
    return {
      notes: [],
      warnings: [
        `"${file.name}" appears to be a binary file, not plain text. Only plain text (.txt) files can be imported — convert or rename the file and try again.`,
      ],
    };
  }
  if (text.length > MAX_NOTE_TEXT_CHARS) {
    return {
      notes: [],
      warnings: [
        `"${file.name}" exceeds ${Math.round(
          MAX_NOTE_TEXT_CHARS / 1000,
        )}k characters and was skipped. Split it into smaller notes first.`,
      ],
    };
  }
  return {
    notes: [
      {
        title: titleFromFileBase(file.name),
        content: text.replace(/\r\n?/g, "\n").replace(/\u0000/g, ""),
        contentFormat: "markdown",
        updatedAt: Number.isFinite(file.lastModified) && file.lastModified > 0
          ? Math.floor(file.lastModified)
          : Date.now(),
      },
    ],
    warnings: [],
  };
}

export async function importNotesFromFile(
  file: File,
): Promise<ImportFileResult> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".otp")) {
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      throw new TransferError(
        `"${file.name}" is larger than ${Math.round(
          MAX_IMPORT_FILE_BYTES / 1024 / 1024,
        )} MB. Split your backup into smaller archives and import each one.`,
      );
    }
    if (file.size === 0) {
      throw new TransferError(
        `"${file.name}" is empty. Please pick a non-empty .otp backup file.`,
      );
    }
    return notesFromOtpBytes(new Uint8Array(await file.arrayBuffer()), file.name);
  }

  if (lowerName.endsWith(".txt")) {
    return notesFromTxtFile(file);
  }

  throw new TransferError(
    `"${file.name}" is not supported. Only .txt plain text files and otepad (.otp) backups can be imported.`,
  );
}

export async function importNotesFromFiles(
  files: FileList | File[],
): Promise<BatchImportResult> {
  const fileArray = Array.from(files);
  const allNotes: ImportedNote[] = [];
  const allWarnings: string[] = [];
  const allErrors: string[] = [];

  for (const file of fileArray) {
    try {
      const res = await importNotesFromFile(file);
      allNotes.push(...res.notes);
      allWarnings.push(...res.warnings);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Failed to import "${file.name}". Please ensure it is a valid .txt or .otp file.`;
      allErrors.push(msg);
    }
  }

  return {
    notes: allNotes,
    warnings: allWarnings,
    errors: allErrors,
    totalFiles: fileArray.length,
  };
}
