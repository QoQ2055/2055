// Pure markdown -> structured Element[] parser for FR-8 screenplay export.
//
// State-machine spec (CA section 3.4.1, hardcoded recognition order):
//   1. scene_heading  -- heading line starting with # / ## / ###
//   2. transition     -- keyword line (cut to / fade out / 切至 / 淡出 etc.)
//   3. parenthetical  -- line wrapped in (...) when previous element is character/dialogue/parenthetical
//   4. character      -- short bold line **NAME** or short "NAME:" line (<= 16 chars, no sentence punctuation)
//   5. default        -- dialogue when previous element is character/parenthetical/dialogue, else action
//
// Invariants (CK section 1.4):
//   - I-1: zero Dexie writes (this module never imports db)
//   - I-2: no react / zustand / dexie imports (pure data transformation)
//   - I-3: no URL.createObjectURL (in-memory Element[] only)

export type ElementKind =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition';

export interface Element {
  kind: ElementKind;
  text: string;
}

// Recognition regexes -- order matters per state machine spec.
const SCENE_PREFIX = /^#{1,3}\s*(?:场景|内景|外景|INT|EXT|I\/E)/i;
const ANY_HEADING = /^#{1,3}\s+\S/;
const TRANSITION_KEYWORDS =
  /^\s*(?:切至|淡出|淡入|溶解|镜头切换|镜头切至|FADE\s*(?:OUT|IN|TO\s*BLACK)|CUT\s*TO|DISSOLVE\s*TO|MATCH\s*CUT)\s*[:：.]?\s*$/i;
const PAREN_LINE = /^\s*[\(（]\s*([^\)）]*?)\s*[\)）]\s*$/;
const BOLD_NAME = /^\s*\*\*\s*([^*\n]{1,16}?)\s*\*\*\s*[:：]?\s*$/;
const NAME_COLON = /^\s*([^：:\n#*]{1,16})\s*[:：]\s*$/;
const SENTENCE_PUNCT = /[。！？.!?,，；;]/;

function stripHeadingPrefix(s: string): string {
  return s.replace(/^#{1,3}\s*/, '').trim();
}

export function parseScreenplayMarkdown(md: string): Element[] {
  const out: Element[] = [];
  if (!md || typeof md !== 'string') return out;
  const lines = md.split(/\r?\n/);
  let prev: ElementKind | null = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      // Blank line -- reset dialogue chain to neutral.
      prev = null;
      continue;
    }

    // 1. scene heading
    if (SCENE_PREFIX.test(trimmed) || ANY_HEADING.test(trimmed)) {
      out.push({ kind: 'scene_heading', text: stripHeadingPrefix(trimmed) });
      prev = 'scene_heading';
      continue;
    }

    // 2. transition keyword
    if (TRANSITION_KEYWORDS.test(trimmed)) {
      out.push({ kind: 'transition', text: trimmed.replace(/[:：.]\s*$/, '').trim() });
      prev = 'transition';
      continue;
    }

    // 3. parenthetical (only valid in dialogue chain)
    const pm = trimmed.match(PAREN_LINE);
    if (
      pm &&
      (prev === 'character' || prev === 'dialogue' || prev === 'parenthetical')
    ) {
      out.push({ kind: 'parenthetical', text: pm[1].trim() });
      prev = 'parenthetical';
      continue;
    }

    // 4. character (bold-only line OR short colon-suffix line without sentence punctuation)
    const bm = trimmed.match(BOLD_NAME);
    if (bm) {
      out.push({ kind: 'character', text: bm[1].trim() });
      prev = 'character';
      continue;
    }
    const nm = trimmed.match(NAME_COLON);
    if (nm && !SENTENCE_PUNCT.test(nm[1])) {
      out.push({ kind: 'character', text: nm[1].trim() });
      prev = 'character';
      continue;
    }

    // 5. default: dialogue if in dialogue chain, else action
    if (prev === 'character' || prev === 'parenthetical' || prev === 'dialogue') {
      out.push({ kind: 'dialogue', text: trimmed });
      prev = 'dialogue';
    } else {
      out.push({ kind: 'action', text: trimmed });
      prev = 'action';
    }
  }

  return out;
}
