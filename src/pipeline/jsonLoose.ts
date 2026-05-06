// Loose JSON parsing for LLM outputs that may include ```json fences,
// trailing commas, or be cut off mid-array.

export function parseLooseJson(input: string): any {
  let s = input.trim();
  // strip ```json … ``` fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

  try { return JSON.parse(s); } catch {}

  // remove trailing commas inside arrays/objects
  const noTrailingCommas = s.replace(/,(\s*[\]}])/g, '$1');
  try { return JSON.parse(noTrailingCommas); } catch {}

  // try to recover an array by finding outermost [ ... ] and balancing
  const arrStart = s.indexOf('[');
  if (arrStart >= 0) {
    let depth = 0, inStr = false, esc = false;
    for (let i = arrStart; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') {
        depth--;
        if (depth === 0 && ch === ']') {
          const candidate = s.slice(arrStart, i + 1).replace(/,(\s*[\]}])/g, '$1');
          try { return JSON.parse(candidate); } catch { break; }
        }
      }
    }
    // truncated: extract complete top-level objects up to the cut
    return extractCompleteObjects(s.slice(arrStart + 1));
  }

  throw new Error('parse failed');
}

function extractCompleteObjects(body: string): any[] {
  const out: any[] = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) i++;
    if (body[i] !== '{') break;
    let depth = 0, inStr = false, esc = false, start = i;
    for (; i < body.length; i++) {
      const ch = body[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const obj = body.slice(start, i + 1).replace(/,(\s*[\]}])/g, '$1');
          try { out.push(JSON.parse(obj)); } catch {}
          i++;
          break;
        }
      }
    }
    if (depth !== 0) break; // truncated mid-object; stop
  }
  return out;
}

// Convenience: parse and ensure array.
export function parseLooseArray(input: string): any[] {
  try {
    const v = parseLooseJson(input);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
