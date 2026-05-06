// Register the novel stage in public/prompts/manifest.json (idempotent).
// Computes sysLen / usrLen from each step's prompt JSON.
// Run: node scripts/novel-manifest-register.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = resolve(__dirname, '..', 'public', 'prompts');
const manifestPath = resolve(promptsDir, 'manifest.json');

const NOVEL_STEPS = [
  { index: 1, file: '1.1.json', id: 'novel.1', title: '世界观文档' },
  { index: 2, file: '1.2.json', id: 'novel.2', title: '人物 Bible' },
  { index: 3, file: '2.1.json', id: 'novel.3', title: '全书分卷规划' },
  { index: 4, file: '2.2.json', id: 'novel.4', title: '单卷分章明细 (循环)' },
  { index: 5, file: '2.3.json', id: 'novel.5', title: '伏笔表' },
  { index: 6, file: '3.1.json', id: 'novel.6', title: '章节草稿 (循环, 墨刃)' },
  { index: 7, file: '3.2.json', id: 'novel.7', title: '章节润色 (循环, 三模式)' },
];

if (!existsSync(manifestPath)) {
  console.error('manifest.json not found at', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const novelStage = {
  id: 'novel',
  // 当前 runner 没有 novel 专用的循环调度器；多数节点为 serial 串跑。
  // 循环节点 (novel.4 / novel.6 / novel.7) 由前端工作台自行通过 userOverride
  // 整体替换 user 消息逐章 / 逐卷调用，与 manifest 的 mode 字段无关。
  nameZh: '小说',
  mode: 'serial',
  steps: NOVEL_STEPS.map((s) => {
    const promptPath = resolve(promptsDir, 'novel', s.file);
    const obj = JSON.parse(readFileSync(promptPath, 'utf8'));
    const sys = obj.messages.find((m) => m.role === 'system')?.content ?? '';
    const usr = obj.messages.find((m) => m.role === 'user')?.content ?? '';
    return {
      id: s.id,
      index: s.index,
      title: s.title,
      prompt: `prompts/novel/${s.file}`,
      outFormat: 'markdown',
      sysLen: sys.length,
      usrLen: usr.length,
    };
  }),
};

// Replace existing 'novel' stage if any; otherwise append.
const idx = manifest.stages.findIndex((st) => st.id === 'novel');
if (idx >= 0) {
  manifest.stages[idx] = novelStage;
  console.log('replaced existing novel stage');
} else {
  manifest.stages.push(novelStage);
  console.log('appended novel stage');
}
manifest.generated = new Date().toISOString();

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log('updated', manifestPath);
console.log('novel steps:');
for (const s of novelStage.steps) {
  console.log(`  ${s.id}  ${s.title.padEnd(28, ' ')}  sysLen=${s.sysLen}  usrLen=${s.usrLen}`);
}
