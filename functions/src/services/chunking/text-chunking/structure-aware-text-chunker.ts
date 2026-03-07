import {TextChunker} from "./text-chunker";

/**
 * A paragraph-aware text chunker designed for arbitrary PDF content such as
 * medical guidelines, clinical papers, and similar professional documents.
 *
 * Split hierarchy (highest to lowest priority):
 * 1. **Paragraphs** — double-newline boundaries (`\n\n`), the most
 *    reliable structural signal in extracted PDF text.
 * 2. **Sentences** — punctuation followed by whitespace, with guards
 *    against false positives on decimal numbers, abbreviations, and
 *    common medical/scientific notation (e.g. "3.5 mg", "Fig. 2",
 *    "et al.", "Dr.", "vs.").
 * 3. **Hard split** — character-level fallback for the rare case where a
 *    single sentence exceeds {@link maxLength}.
 *
 * The chunker greedily accumulates paragraphs up to {@link maxLength},
 * then falls back to sentence-level merging for oversized paragraphs.
 *
 * An optional {@link overlap} copies the tail of the previous chunk onto
 * the next one so embedding models retain cross-boundary context.
 */
export class StructureAwareTextChunker implements TextChunker {
  constructor(
    private readonly maxLength: number = 2200,
    private readonly overlap: number = 200,
  ) {
    if (maxLength <= overlap) {
      throw new Error("maxLength must be greater than overlap");
    }
  }

  chunk(text: string): string[] {
    const paragraphs = splitByParagraphs(text);
    const raw = this.mergeToMaxLength(paragraphs);
    return this.applyOverlap(raw);
  }

  // ── merge small segments, split oversized ones ──────────────────────

  private mergeToMaxLength(segments: string[]): string[] {
    const result: string[] = [];
    let buffer = "";

    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed) continue;

      if (trimmed.length > this.maxLength) {
        if (buffer.trim()) {
          result.push(buffer.trim());
          buffer = "";
        }
        result.push(...this.splitOversized(trimmed));
        continue;
      }

      const merged = buffer ? `${buffer}\n\n${trimmed}` : trimmed;
      if (merged.length <= this.maxLength) {
        buffer = merged;
      } else {
        if (buffer.trim()) result.push(buffer.trim());
        buffer = trimmed;
      }
    }

    if (buffer.trim()) result.push(buffer.trim());
    return result;
  }

  private splitOversized(text: string): string[] {
    if (text.length <= this.maxLength) return [text];

    // A long paragraph may still contain single newlines acting as
    // soft paragraph breaks in some PDF extractions.
    const subParagraphs = text.split(/\n{2,}/);
    if (subParagraphs.length > 1) {
      return this.mergeToMaxLength(subParagraphs);
    }

    const sentences = splitBySentences(text);
    if (sentences.length > 1) {
      return this.mergeToMaxLength(sentences);
    }

    return hardSplit(text, this.maxLength);
  }

  // ── overlap ─────────────────────────────────────────────────────────

  private applyOverlap(chunks: string[]): string[] {
    if (this.overlap <= 0 || chunks.length <= 1) return chunks;

    return chunks.map((chunk, i) => {
      if (i === 0) return chunk;
      const prev = chunks[i - 1];
      const suffix = prev.slice(-this.overlap).trimStart();
      return suffix ? `${suffix}\n\n${chunk}` : chunk;
    });
  }
}

// ── Paragraph splitting ───────────────────────────────────────────────────

function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Sentence splitting ────────────────────────────────────────────────────

function splitBySentences(text: string): string[] {
  // Step 1: protect known abbreviations by replacing their dots with a
  //         placeholder that won't match the split regex.
  const placeholder = "\u0000";
  let protected_ = text;
  for (const abbr of ABBREVIATIONS) {
    // Case-insensitive replacement, preserving original casing
    protected_ = protected_.replace(
      new RegExp(escapeRegExp(abbr), "gi"),
      (match) => match.slice(0, -1) + placeholder,
    );
  }

  // Step 2: split on sentence-ending punctuation.
  // - `!` and `?` always split.
  // - `.` only splits when NOT preceded by a digit (avoids "3.5 mg")
  //   and when followed by whitespace + an uppercase letter or end of text.
  const parts = protected_
    .split(/(?<=[!?])\s+|(?<=(?<!\d)\.)\s+(?=[A-Z])/)
    .map((s) => s.replace(new RegExp(escapeRegExp(placeholder), "g"), "."))
    .map((s) => s.trim())
    .filter(Boolean);

  return parts;
}

/** Abbreviations whose trailing dot should not trigger a sentence split. */
const ABBREVIATIONS = [
  // Academic / scientific
  "et al.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "approx.",
  "ca.",
  "no.",
  "vol.",
  "incl.",
  "excl.",
  // Figures / tables / references
  "Fig.",
  "Tab.",
  "Ref.",
  "Eq.",
  "Sec.",
  "Ch.",
  // Titles / honorifics
  "Dr.",
  "Prof.",
  "Mr.",
  "Mrs.",
  "Ms.",
  "Jr.",
  "Sr.",
  "St.",
  // Medical
  "mg.",
  "ml.",
  "kg.",
  "pt.",
  "approx.",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Hard split (last resort) ──────────────────────────────────────────────

function hardSplit(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.substring(i, i + maxLength).trim());
  }
  return chunks.filter(Boolean);
}
