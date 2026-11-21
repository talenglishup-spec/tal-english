/**
 * 콘텐츠 현황 집계 — 어드민 "콘텐츠 현황" 탭이 쓴다.
 *
 * 레벨 → 표현 → 장면(영상) 3단을 한 번에 세어 준다. 묶는 기준은 전부
 * lib/levels의 함수를 그대로 쓴다 — 어드민 화면의 숫자가 학생이 보는 피드와
 * 어긋나면 안 되기 때문이다(같은 표현을 다르게 세면 "표현 19개"가 화면마다
 * 달라진다).
 */

import {
  getLevels, levelLabel, clipsOfLevel, expressionsOfLevel, stageKeyOf, expressionKeyOf,
  type LevelClip,
  // 확장자를 붙여야 node --test(네이티브 TS 실행)에서도 해석된다.
  // tsconfig의 allowImportingTsExtensions가 켜져 있어 빌드에도 문제없다.
} from './levels.ts';
import { splitCaption } from './caption.ts';

export type OverviewClip = LevelClip & {
  target_phrase?: string;
  translation?: string;
  model_audio_us?: string;
  model_audio_uk?: string;
  youtube_url?: string;
  category?: string;
  speak_mode?: boolean;
};

export type ExpressionRow = {
  key: string;
  phrase: string;
  translation: string;
  category: string;
  /** 이 표현에 달린 장면들의 level_order — 작은 번호가 먼저 나온다 */
  orders: number[];
  clipCount: number;
  /** 미국·영국 양쪽 음성이 다 있는 장면 수 */
  audioReady: number;
  missingAudio: boolean;
  missingTranslation: boolean;
  /** 장면이 하나뿐 — 같은 영상만 반복해서 보게 된다 */
  singleScene: boolean;
};

export type LevelRow = {
  level: string;
  label: string;
  stage: string | null;
  expressions: ExpressionRow[];
  expressionCount: number;
  clipCount: number;
};

export type Overview = {
  levels: LevelRow[];
  totalLevels: number;
  totalExpressions: number;
  totalClips: number;
  /** 한 장면이라도 음성이 빠진 표현 수 */
  missingAudio: number;
  missingTranslation: number;
  singleScene: number;
  /** 가장 두꺼운 레벨의 영상 수 — 막대 길이 기준 */
  maxClipCount: number;
};

const txt = (v: unknown) => String(v ?? '').trim();

export function buildOverview(clips: OverviewClip[]): Overview {
  const levels: LevelRow[] = getLevels(clips).map(level => {
    const groups = expressionsOfLevel(clips, level);

    const expressions: ExpressionRow[] = groups.map(g => {
      const audioReady = g.clips.filter(
        c => txt((c as OverviewClip).model_audio_us) && txt((c as OverviewClip).model_audio_uk)
      ).length;
      const head = g.clip as OverviewClip;
      return {
        key: g.key,
        phrase: txt(head.target_phrase) || head.clip_id,
        translation: txt(head.translation),
        category: txt(head.category),
        orders: g.clips.map(c => c.level_order || 0).sort((a, b) => a - b),
        clipCount: g.clips.length,
        audioReady,
        missingAudio: audioReady < g.clips.length,
        missingTranslation: !txt(head.translation),
        singleScene: g.clips.length === 1,
      };
    });

    return {
      level,
      label: levelLabel(level, clips),
      stage: stageKeyOf(level),
      expressions,
      expressionCount: expressions.length,
      clipCount: clipsOfLevel(clips, level).length,
    };
  });

  const all = levels.flatMap(l => l.expressions);
  return {
    levels,
    totalLevels: levels.length,
    totalExpressions: all.length,
    totalClips: levels.reduce((n, l) => n + l.clipCount, 0),
    missingAudio: all.filter(e => e.missingAudio).length,
    missingTranslation: all.filter(e => e.missingTranslation).length,
    singleScene: all.filter(e => e.singleScene).length,
    maxClipCount: levels.reduce((mx, l) => Math.max(mx, l.clipCount), 0),
  };
}

/**
 * 콘텐츠 점검 — 어드민 화면에서 바로 보는 문제 목록.
 *
 * 터미널의 `npm run content` 와 같은 눈으로 본다. 다만 유튜브 임베드 가능
 * 여부처럼 외부 조회가 필요한 검사는 여기서 하지 않는다(브라우저에서는
 * 유튜브가 막는다) — 그건 배포 전에 터미널 점검으로 거른다.
 */
export type Issue = {
  rank: 'fatal' | 'warn' | 'info';
  text: string;
  /** 어느 줄을 고쳐야 하는지 — 시트에서 찾을 수 있게 */
  where?: string;
};

const LEVEL_OK = /^(\d+-\d+0|WARM-\d+|ENC|REF)$/i;
const words = (s?: string) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;

export function findIssues(clips: OverviewClip[]): Issue[] {
  const out: Issue[] = [];
  const id = (c: OverviewClip) => c.clip_id || '(id 없음)';

  // clip_id — 진행 기록의 열쇠라 비거나 겹치면 기록이 섞인다
  const byId = new Map<string, OverviewClip[]>();
  for (const c of clips) {
    if (!c.clip_id) { out.push({ rank: 'fatal', text: 'clip_id 가 비어 있습니다 — 진행 기록이 저장되지 않습니다', where: txt(c.target_phrase) }); continue; }
    const list = byId.get(c.clip_id) || [];
    list.push(c); byId.set(c.clip_id, list);
  }
  for (const [key, list] of byId) {
    if (list.length > 1) out.push({ rank: 'fatal', text: `clip_id 가 겹칩니다 — 서로 다른 표현의 기록이 섞입니다`, where: `${key} · ${list.map(c => txt(c.target_phrase)).join(' / ')}` });
  }

  for (const c of clips) {
    const lv = txt(c.level);
    if (lv && !LEVEL_OK.test(lv)) {
      out.push({ rank: 'fatal', text: `level "${lv}" 은 10단위가 아닙니다 — 스텝 순서가 어긋납니다`, where: id(c) });
    }
    const missing = (['target_phrase', 'translation', 'category', 'level'] as const).filter(k => !txt((c as any)[k]));
    if (missing.length) out.push({ rank: 'warn', text: `빈 칸: ${missing.join(', ')}`, where: id(c) });

    const script = txt(c.script_en);
    if (script && !splitCaption(script, txt(c.target_phrase)).some(p => p.hit)) {
      out.push({ rank: 'fatal', text: `자막(script_en) 안에 말할 표현이 없습니다 — 들리지 않는 말을 시키게 됩니다`, where: id(c) });
    }
    const n = words(c.target_phrase);
    if (c.speak_mode !== false && n > 12) out.push({ rank: 'fatal', text: `표현이 ${n}단어 — 통째로 말하기 어렵습니다`, where: id(c) });
    else if (c.speak_mode !== false && n > 6) out.push({ rank: 'warn', text: `표현이 ${n}단어 — 코치 설명이면 핵심만 자르는 편이 낫습니다`, where: id(c) });
  }

  // 같은 영상 · 같은 구간
  const bySeg = new Map<string, OverviewClip[]>();
  for (const c of clips) {
    const url = txt(c.youtube_url);
    if (!url) continue;
    const k = `${url}|${txt((c as any).start_sec)}|${txt((c as any).end_sec)}`;
    const list = bySeg.get(k) || [];
    list.push(c); bySeg.set(k, list);
  }
  for (const [, group] of bySeg) {
    if (group.length < 2) continue;
    const where = group.map(id).join(', ');
    const phrases = new Set(group.map(c => expressionKeyOf(c)));
    if (phrases.size === 1) {
      out.push({ rank: 'warn', text: '같은 영상·같은 구간·같은 표현 — 같은 장면을 두 번 보게 됩니다', where });
    } else {
      const pauses = new Set(group.map(c => txt((c as any).pause_at)));
      if (pauses.size === 1) out.push({ rank: 'warn', text: '한 장면에서 표현 여럿인데 멈춤 지점이 같습니다 — 각 표현이 끝나는 시각으로 나눠 주세요', where });
      else out.push({ rank: 'info', text: '한 장면에서 표현 여럿 (의도된 분리로 봅니다)', where });
    }
  }

  // 레벨 단위
  for (const level of getLevels(clips)) {
    const groups = expressionsOfLevel(clips, level);
    if (groups.length > 0 && groups.length < 3) {
      out.push({ rank: 'warn', text: `표현이 ${groups.length}개뿐 — 한 스텝이 너무 얇습니다`, where: `${levelLabel(level, clips)} (${level})` });
    }
    const slot = new Map<string, OverviewClip[]>();
    for (const c of clipsOfLevel(clips, level)) {
      const k = `${expressionKeyOf(c)}|${c.level_order || 0}`;
      const list = slot.get(k) || [];
      list.push(c); slot.set(k, list);
    }
    for (const [, list] of slot) {
      if (list.length > 1) out.push({ rank: 'warn', text: `같은 표현이 같은 번호(${list[0].level_order})를 씁니다 — 장면 순서가 시트 행 순서에 좌우됩니다`, where: list.map(id).join(', ') });
    }
  }

  const rank = { fatal: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.rank] - rank[b.rank]);
}
