// Imports `F:\下载文件\八步\` (or any folder) into `public/prompts/**/*.json`
// + generates manifest.json describing the pipeline.
// Usage:  node scripts/import-prompts.mjs [SOURCE_DIR]
//   default SOURCE_DIR = F:\下载文件\八步

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] || 'F:\\下载文件\\八步';
const OUT = path.join(ROOT, 'public', 'prompts');

const map = {
  '剧本':     { dir: 'screenplay', count: 8,
    titles: ['破题与核心动作','梗概草稿','人物深度与弧光','前史与世界观',
             '结构大纲','场次拆解','场景写作','剧本医生'] },
  '资产提取': { dir: 'assets',     count: 4,
    titles: ['资产扫描（完整性闸）','角色资产 V3.0','场景资产 V3.0','道具资产 V3.0'] },
  '分镜':     { dir: 'storyboard', count: 2,
    titles: ['Phase A-D 单元规划','Phase E-G 逐单元 Seedance prompt'] },
};

function readJsonLoose(file) {
  // some payloads may be slightly malformed near tail; try strict first.
  const raw = fs.readFileSync(file, 'utf8');
  try { return JSON.parse(raw); } catch {}

  // strategy 1: trim trailing garbage to last '}' or ']'
  const lastClose = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (lastClose > 0) {
    try { return JSON.parse(raw.slice(0, lastClose + 1)); } catch {}
  }

  // strategy 2: progressively truncate trailing chars and append matching closers
  // (handles cases like missing final `}` or `]}`)
  let body = raw.replace(/[\s,]+$/, '');
  for (let i = 0; i < 6; i++) {
    for (const suffix of ['', '}', ']}', '"}', '"]}', '"}}']) {
      try { return JSON.parse(body + suffix); } catch {}
    }
    body = body.slice(0, -1);
  }
  throw new Error('cannot recover JSON');
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`✘ source dir not found: ${SRC}`);
    process.exit(1);
  }
  ensureDir(OUT);

  const manifest = { version: '1.0', sourceDir: SRC, generated: new Date().toISOString(), stages: [] };

  for (const [zh, cfg] of Object.entries(map)) {
    const subSrc = path.join(SRC, zh);
    const subOut = path.join(OUT, cfg.dir);
    ensureDir(subOut);

    const steps = [];
    for (let i = 1; i <= cfg.count; i++) {
      const fSrc = path.join(subSrc, `${i}.txt`);
      if (!fs.existsSync(fSrc)) {
        console.warn(`  · skip missing ${fSrc}`);
        continue;
      }
      let payload;
      try {
        payload = readJsonLoose(fSrc);
      } catch (e) {
        console.error(`  ✘ parse failed ${fSrc}: ${e.message}`);
        continue;
      }
      const fOut = path.join(subOut, `${i}.json`);
      fs.writeFileSync(fOut, JSON.stringify(payload, null, 2), 'utf8');
      const sysLen = payload.messages?.[0]?.content?.length ?? 0;
      const usrLen = payload.messages?.[1]?.content?.length ?? 0;
      console.log(`  ✓ ${zh}/${i}.txt → ${path.relative(ROOT, fOut)}  (sys=${sysLen}, usr=${usrLen})`);
      steps.push({
        id: `${cfg.dir}.${i}`,
        index: i,
        title: cfg.titles[i - 1] ?? `${cfg.dir}-${i}`,
        prompt: `prompts/${cfg.dir}/${i}.json`,
        outFormat: cfg.dir === 'screenplay' && i === 8 ? 'json'
                 : cfg.dir === 'assets' && i >= 2 ? 'json'
                 : 'markdown',
        sysLen, usrLen,
      });
    }
    manifest.stages.push({
      id: cfg.dir,
      nameZh: zh,
      mode: cfg.dir === 'screenplay' ? 'serial'
          : cfg.dir === 'assets' ? 'gate-then-parallel'
          : 'plan-then-loop',
      steps,
    });
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'),
                   JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n✓ manifest.json → ${path.relative(ROOT, path.join(OUT, 'manifest.json'))}`);
  console.log(`\nDone. Total stages: ${manifest.stages.length}, total steps: ${manifest.stages.reduce((a,s)=>a+s.steps.length,0)}`);
}

main();
