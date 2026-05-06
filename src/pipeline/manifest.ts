import type { Manifest, ManifestStep, RawPromptPayload, StageId } from './types';

// Resolve a path relative to the SPA base (works under hash router and any subdir deploy).
function resolveAsset(p: string): string {
  // Vite serves /public at root. Use leading "./" so it works under file:// too.
  return './' + p.replace(/^\.?\/?/, '');
}

let _manifestCache: Manifest | null = null;
let _payloadCache = new Map<string, RawPromptPayload>();

export async function loadManifest(): Promise<Manifest> {
  if (_manifestCache) return _manifestCache;
  const res = await fetch(resolveAsset('prompts/manifest.json'));
  if (!res.ok) throw new Error(`无法加载 manifest.json (HTTP ${res.status})。请先运行 npm run import:prompts`);
  _manifestCache = (await res.json()) as Manifest;
  return _manifestCache;
}

export async function loadPayload(step: ManifestStep): Promise<RawPromptPayload> {
  const cached = _payloadCache.get(step.prompt);
  if (cached) return cached;
  const res = await fetch(resolveAsset(step.prompt));
  if (!res.ok) throw new Error(`无法加载 prompt: ${step.prompt}`);
  const payload = (await res.json()) as RawPromptPayload;
  _payloadCache.set(step.prompt, payload);
  return payload;
}

export function listStage(m: Manifest, stageId: StageId): ManifestStep[] {
  return m.stages.find((s) => s.id === stageId)?.steps ?? [];
}
