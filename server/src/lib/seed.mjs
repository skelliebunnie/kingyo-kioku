// seed.mjs
import fs from 'node:fs/promises';

const BASE = 'https://kanjiapi.dev/v1';
const getJson = async (path) => {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
};

// small worker pool so we don't hammer the server
async function mapPool(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

const chars = await getJson('/kanji/joyo');
const kanji = await mapPool(chars, 5, (c) => getJson(`/kanji/${encodeURIComponent(c)}`));
const jlptOf = new Map(kanji.map((k) => [k.kanji, k.jlpt]));

const words = new Map(); // key: written|reading
await mapPool(kanji, 5, async (k) => {
  const entries = await getJson(`/words/${encodeURIComponent(k.kanji)}`);
  for (const e of entries) {
    const glosses = e.meanings.flatMap((m) => m.glosses).slice(0, 4);
    for (const v of e.variants) {
      if (!v.priorities?.length) continue;          // common words only
      const key = `${v.written}|${v.pronounced}`;
      if (words.has(key)) continue;
      // word level = hardest (lowest number) kanji level it contains
      const levels = [...v.written].map((c) => jlptOf.get(c)).filter(Boolean);
      words.set(key, {
        written: v.written,
        reading: v.pronounced,
        glosses,
        jlpt: levels.length ? Math.min(...levels) : null,
      });
    }
  }
});

await fs.writeFile('words.json', JSON.stringify([...words.values()], null, 1));