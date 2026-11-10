// src/lib/matchWords.js
// Finds vocabulary words inside a tokenized Japanese sentence and works out the exact span to
// highlight plus the reading of that span (e.g. 食べた -> たべた).
import { toHiragana } from './kana.js';

const HAN = /\p{Script=Han}/u;
const KANA_ONLY = /^[\u3041-\u3096ー]+$/;
const CONTENT_POS = new Set(['名詞', '動詞', '形容詞', '副詞', '連体詞']);
const NOT_ABSORBED = new Set(['です']); // 高いです highlights 高い only

const isInflecting = (t) => t.pos === '動詞' || t.pos === '形容詞';

// Tokens that belong to the conjugated predicate after a verb/adjective head:
// auxiliaries (た, ない, ます...), て/で, and helper verbs (いる, しまう, られる...).
function absorbable(t, prev) {
  // だ only counts as part of the verb when it is the past tense (飲んだ, 読んだ), not 食べるだろう
  if (t.pos === '助動詞' && t.basic_form === 'だ') return prev.conjugated_form === '連用タ接続';
  if (t.pos === '助動詞') return !NOT_ABSORBED.has(t.basic_form);
  if (t.pos === '助詞' && t.pos_detail_1 === '接続助詞') return t.surface_form === 'て' || t.surface_form === 'で';
  if (t.pos === '動詞') return t.pos_detail_1 === '非自立' || t.pos_detail_1 === '接尾';
  return false;
}

/**
 * @param {object[]} tokens  kuromoji tokens for `text`
 * @param {string} text      the sentence
 * @param {Map<string, {id:number, reading:string}[]>} wordsByWritten
 * @returns {{wordId:number, start:number, end:number, surface:string, reading:string}[]}
 *          first occurrence of each word only; start/end are JS string offsets (end exclusive)
 */
export function findMatches(tokens, text, wordsByWritten) {
  const out = [];
  const seen = new Set();

  for (let i = 0; i < tokens.length; i++) {
    const head = tokens[i];
    if (!CONTENT_POS.has(head.pos) || !HAN.test(head.surface_form) || !head.reading) continue;

    const key = head.basic_form && head.basic_form !== '*' ? head.basic_form : head.surface_form;
    const candidates = wordsByWritten.get(key);
    if (!candidates) continue;

    const infl = isInflecting(head);
    const headReading = toHiragana(head.reading);
    const row =
      candidates.find((c) => (infl ? headReading.startsWith(c.reading.slice(0, -1)) : c.reading === headReading)) ??
      candidates[0];
    if (seen.has(row.id)) continue;

    let j = i;
    if (infl) while (j + 1 < tokens.length && absorbable(tokens[j + 1], tokens[j])) j++;

    const span = tokens.slice(i, j + 1);
    const start = head.word_position - 1;
    const last = span[span.length - 1];
    const end = last.word_position - 1 + last.surface_form.length;
    const surface = text.slice(start, end);
    if (surface !== span.map((t) => t.surface_form).join('')) continue; // offset sanity check

    const reading = span.map((t) => toHiragana(t.reading ?? t.surface_form)).join('');
    if (!KANA_ONLY.test(reading)) continue;

    seen.add(row.id);
    out.push({ wordId: row.id, start, end, surface, reading });
  }
  return out;
}