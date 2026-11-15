/** lib/caption 회귀 테스트 — `npm test` */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitCaption, captionText } from '../src/lib/caption.ts';

const shown = (parts: { text: string }[]) => parts.map(p => p.text).join('');
const hit = (parts: { text: string; hit: boolean }[]) => parts.filter(p => p.hit).map(p => p.text).join('');

test('긴 문장에서 말할 부분만 강조한다', () => {
  const parts = splitCaption('Hold that ball until pressure arrives.', 'Hold');
  assert.equal(shown(parts), 'Hold that ball until pressure arrives.', '자막 원문은 그대로');
  assert.equal(hit(parts), 'Hold');
});

test('문장 중간·끝에 있어도 찾는다', () => {
  assert.equal(hit(splitCaption('Now you have to hold it there', 'hold it')), 'hold it');
  assert.equal(hit(splitCaption('Everyone, touch the line!', 'touch the line')), 'touch the line');
});

test('대소문자·문장부호가 달라도 찾는다', () => {
  const parts = splitCaption('So again — MAN ON, man on!', 'Man on!');
  assert.equal(hit(parts), 'MAN ON', '원문 표기를 그대로 살린다');
  assert.equal(shown(parts), 'So again — MAN ON, man on!');
});

test('문장 안에 없으면 강조 없이 전체를 보여준다', () => {
  const parts = splitCaption('Keep the shape and be patient.', 'Finish!');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].hit, false);
  assert.equal(shown(parts), 'Keep the shape and be patient.');
});

test('script_en이 없으면 표현 자체가 자막이 된다', () => {
  assert.equal(captionText({ target_phrase: 'Man on!' }), 'Man on!');
  assert.equal(captionText({ script_en: '  ', target_phrase: 'Man on!' }), 'Man on!');
  assert.equal(captionText({ script_en: 'Man on, behind you!', target_phrase: 'Man on!' }), 'Man on, behind you!');
});

test('빈 자막은 빈 배열', () => {
  assert.deepEqual(splitCaption('', 'Hold'), []);
});
