// CharacterRelationGraph.tsx · gap-b PR-4
// 单角色关系网（圆心 = 选中角色 · 周围放射 = 关系对象 · 边色 = 关系类型）。
//
// CK invariant I-3：纯 props 视图，0 zustand reads。
// 渲染策略：手撸 SVG 极坐标（CA §0.3 · 0 图论库依赖）。
//
// 数据来源：取该角色**最近一条**有快照的记录的 relations 字段（可后续扩为时间合并）。

import type { CharacterRelation, CharacterStateRecord, RelationType } from '../../store/characterStates';

export interface CharacterRelationGraphProps {
  characterName: string;
  /** 该角色全部记录（按 chapterIndex 升序）。组件内取最新有 snapshot 的一条。 */
  records: CharacterStateRecord[];
}

const RELATION_COLORS: Record<RelationType, string> = {
  friend: '#10b981',   // emerald-500
  enemy: '#ef4444',    // red-500
  neutral: '#6b7280',  // gray-500
  lover: '#ec4899',    // pink-500
  family: '#f59e0b',   // amber-500
  mentor: '#8b5cf6',   // violet-500
  rival: '#f97316',    // orange-500
  unknown: '#9ca3af',  // gray-400
};

const SIZE = 360;
const CENTER = SIZE / 2;
const NODE_R = 28;
const ORBIT_R = 130;

export function CharacterRelationGraph(props: CharacterRelationGraphProps): JSX.Element {
  const { characterName, records } = props;

  // 取最新有 snapshot 的记录
  const latest = [...records].reverse().find((r) => r.snapshot !== null);
  const relations = latest?.snapshot?.relations ?? {};
  const targets: Array<[string, CharacterRelation]> = Object.entries(relations);

  if (targets.length === 0) {
    return (
      <div className="text-sm text-gray-500 px-3 py-6 text-center">
        暂无关系数据 · 跑过 N3.2 润色（开启提取）后才会有
      </div>
    );
  }

  return (
    <svg width={SIZE} height={SIZE} role="img" aria-label={`${characterName} 关系网`}>
      {/* 边：先画线再画节点 */}
      {targets.map(([name, rel], i) => {
        const angle = (i / targets.length) * 2 * Math.PI - Math.PI / 2;
        const x = CENTER + Math.cos(angle) * ORBIT_R;
        const y = CENTER + Math.sin(angle) * ORBIT_R;
        const color = RELATION_COLORS[rel.type] ?? RELATION_COLORS.unknown;
        return (
          <line
            key={`edge-${name}`}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke={color}
            strokeWidth={2}
            opacity={0.6}
          />
        );
      })}

      {/* 中心节点 */}
      <g aria-label={characterName}>
        <circle cx={CENTER} cy={CENTER} r={NODE_R + 4} fill="#1f2937" />
        <text
          x={CENTER}
          y={CENTER + 5}
          textAnchor="middle"
          fontSize={13}
          fill="#fff"
          fontWeight={600}
        >
          {characterName.slice(0, 4)}
        </text>
      </g>

      {/* 周边节点 + 边标签 */}
      {targets.map(([name, rel], i) => {
        const angle = (i / targets.length) * 2 * Math.PI - Math.PI / 2;
        const x = CENTER + Math.cos(angle) * ORBIT_R;
        const y = CENTER + Math.sin(angle) * ORBIT_R;
        const midX = (CENTER + x) / 2;
        const midY = (CENTER + y) / 2;
        const color = RELATION_COLORS[rel.type] ?? RELATION_COLORS.unknown;
        const tooltip = `${characterName} → ${name}：${rel.type}${rel.note ? ` · ${rel.note}` : ''}`;
        return (
          <g key={`node-${name}`} aria-label={tooltip}>
            <title>{tooltip}</title>
            <text
              x={midX}
              y={midY - 4}
              textAnchor="middle"
              fontSize={10}
              fill={color}
              fontWeight={600}
            >
              {rel.type}
            </text>
            <circle cx={x} cy={y} r={NODE_R} fill="#f3f4f6" stroke={color} strokeWidth={2} />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={12} fill="#111827">
              {name.slice(0, 4)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
