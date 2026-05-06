// Convert a finished screenplay (markdown) into the paragraphIndex array
// expected by storyboard/1.json's user message.
// Each paragraph is keyed §1, §2, ... and groups ~120-300 chars of text
// while respecting scene boundaries.

export interface Paragraph {
  id: string;          // "§1"
  text: string;
}

const TARGET_CHARS = 220;
const MAX_CHARS = 380;
const SCENE_BREAK_RE = /^---$|^##\s/;

export function paragraphize(screenplay: string): Paragraph[] {
  const lines = screenplay.replace(/\r\n/g, '\n').split('\n');
  const paragraphs: Paragraph[] = [];
  let bucket: string[] = [];
  let bucketLen = 0;

  const flush = () => {
    const text = bucket.join('\n').trim();
    if (text) {
      paragraphs.push({ id: `§${paragraphs.length + 1}`, text });
    }
    bucket = [];
    bucketLen = 0;
  };

  for (const raw of lines) {
    const line = raw;
    const isHardBreak = SCENE_BREAK_RE.test(line.trim());
    const isBlank = line.trim() === '';

    if (isHardBreak) {
      flush();
      bucket.push(line);
      continue;
    }

    bucket.push(line);
    bucketLen += line.length + 1;

    // soft-break on blank line if bucket is large enough
    if (isBlank && bucketLen >= TARGET_CHARS) {
      flush();
    } else if (bucketLen >= MAX_CHARS) {
      flush();
    }
  }
  flush();
  return paragraphs;
}
