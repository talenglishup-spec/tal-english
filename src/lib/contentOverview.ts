/**
 * 콘텐츠 현황 집계 — 어드민 "콘텐츠 현황" 탭이 쓴다.
 *
 * 레벨 → 표현 → 장면(영상) 3단을 한 번에 세어 준다. 묶는 기준은 전부
 * lib/levels의 함수를 그대로 쓴다 — 어드민 화면의 숫자가 학생이 보는 피드와
 * 어긋나면 안 되기 때문이다(같은 표현을 다르게 세면 "표현 19개"가 화면마다
 * 달라진다).
 */

import {
  getLevels, levelLabel, clipsOfLevel, expressionsOfLevel, stageKeyOf,
  type LevelClip,
  // 확장자를 붙여야 node --test(네이티브 TS 실행)에서도 해석된다.
  // tsconfig의 allowImportingTsExtensions가 켜져 있어 빌드에도 문제없다.
} from './levels.ts';

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
