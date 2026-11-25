export interface CatalogProduct {
  id: string;
  code: string;
  name: string;
  stock: number;
  description?: string;
}

export type MatchKind = "exact" | "suggested" | "manual" | "none";
export type RowStatus = MatchKind | "error";

export interface RawRow {
  code: string;
  name: string;
  qty: number;
}

export interface ImportRow {
  id: number;
  n: number;
  origCode: string;
  origName: string;
  qty: number;
  productCode: string | null;
  kind: MatchKind;
  method: string;
  score: number;
  ambiguous: boolean;
}

/** Catálogo de demostración (solo para el archivo de ejemplo). */
export const DEMO_CATALOG: CatalogProduct[] = [
  { id: "", code: "SAM-A15", name: "Samsung Galaxy A15 128GB", stock: 34 },
  { id: "", code: "SAM-A15-256", name: "Samsung Galaxy A15 256GB", stock: 12 },
  { id: "", code: "SAM-A15-5G", name: "Samsung Galaxy A15 5G", stock: 9 },
  { id: "", code: "IP13-128", name: "iPhone 13 128GB", stock: 7 },
  { id: "", code: "IP14-128", name: "iPhone 14 128GB", stock: 5 },
  { id: "", code: "RED-N13", name: "Redmi Note 13", stock: 21 },
  { id: "", code: "RED-N13P", name: "Redmi Note 13 Pro", stock: 10 },
  { id: "", code: "MOT-G54", name: "Motorola Moto G54", stock: 14 },
  { id: "", code: "HON-X8B", name: "Honor X8b", stock: 6 },
  { id: "", code: "TEC-SP20", name: "Tecno Spark 20", stock: 18 },
  { id: "", code: "CAR-20W", name: "Cargador 20W USB-C", stock: 88 },
  { id: "", code: "CAB-UC1", name: "Cable USB-C 1m", stock: 120 },
  { id: "", code: "CAB-LT1", name: "Cable Lightning 1m", stock: 64 },
  { id: "", code: "VID-A15", name: "Vidrio templado Samsung A15", stock: 150 },
  { id: "", code: "FOR-IP13", name: "Forro silicona iPhone 13", stock: 42 },
  { id: "", code: "AUD-JBL510", name: "Audífonos JBL Tune 510BT", stock: 16 },
  { id: "", code: "AUD-PRO", name: "Audífonos inalámbricos Pro", stock: 27 },
  { id: "", code: "PAR-GO3", name: "Parlante JBL Go 3", stock: 11 },
  { id: "", code: "SW-T800", name: "Smartwatch T800 Ultra", stock: 23 },
  { id: "", code: "PB-10K", name: "Power Bank 10000mAh", stock: 30 },
];

const ABBR: Record<string, string> = {
  sam: "samsung",
  ip: "iphone",
  aud: "audifono",
  cel: "celular",
};

export function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d+)\s*gb/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((t) => ABBR[t] ?? (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));
}

interface Prepared {
  toks: string[];
  norm: string;
  bg: Map<string, number>;
  bgTotal: number;
}

function prep(s: string): Prepared {
  const toks = normalize(s);
  const joined = toks.join("");
  const bg = new Map<string, number>();
  let total = 0;
  for (let i = 0; i < joined.length - 1; i++) {
    const g = joined.slice(i, i + 2);
    bg.set(g, (bg.get(g) ?? 0) + 1);
    total++;
  }
  return { toks, norm: toks.join(" "), bg, bgTotal: total };
}

function score(a: Prepared, b: Prepared): number {
  if (!a.toks.length || !b.toks.length) return 0;
  if (a.norm === b.norm) return 100;
  const used = new Set<number>();
  let matched = 0;
  for (const x of a.toks) {
    const j = b.toks.findIndex(
      (y, i) => !used.has(i) && (x === y || (x.length >= 3 && y.length >= 3 && (y.startsWith(x) || x.startsWith(y))))
    );
    if (j >= 0) {
      used.add(j);
      matched++;
    }
  }
  const tokenDice = (2 * matched) / (a.toks.length + b.toks.length);
  let hit = 0;
  a.bg.forEach((n, g) => {
    hit += Math.min(n, b.bg.get(g) ?? 0);
  });
  const bigramDice = a.bgTotal + b.bgTotal ? (2 * hit) / (a.bgTotal + b.bgTotal) : 0;
  return Math.min(99, Math.round((0.55 * tokenDice + 0.45 * bigramDice) * 100));
}

export function similarity(a: string, b: string): number {
  return score(prep(a), prep(b));
}

// ---------- Catálogo activo + índices ----------
interface Entry {
  p: CatalogProduct;
  pr: Prepared;
}
let list: CatalogProduct[] = [];
let entries: Entry[] = [];
let byCode = new Map<string, CatalogProduct>();
let byDigits = new Map<string, CatalogProduct>();
let inv = new Map<string, number[]>();

export function setCatalog(products: CatalogProduct[]) {
  list = products;
  entries = products.map((p) => ({ p, pr: prep(p.name) }));
  byCode = new Map();
  byDigits = new Map();
  inv = new Map();
  entries.forEach((e, i) => {
    const code = e.p.code.trim().toUpperCase();
    byCode.set(code, e.p);
    // Códigos con formato A00000A: se pueden escribir sin las A
    const m = code.match(/^A?(\d+)A?$/);
    if (m && !byDigits.has(m[1])) byDigits.set(m[1], e.p);
    new Set(e.pr.toks).forEach((t) => inv.set(t, [...(inv.get(t) ?? []), i]));
  });
}
setCatalog(DEMO_CATALOG);

export const getCatalog = () => list;
export const findProduct = (code: string | null) => (code ? byCode.get(code.trim().toUpperCase()) ?? null : null);

export function rank(query: string, limit = 5) {
  const q = prep(query);
  const votes = new Map<number, number>();
  const vote = (ids: number[]) => ids.forEach((i) => votes.set(i, (votes.get(i) ?? 0) + 1));
  for (const t of new Set(q.toks)) {
    const exact = inv.get(t);
    if (exact) vote(exact);
    if (t.length >= 3)
      inv.forEach((ids, key) => {
        if (key !== t && key.length >= 3 && (key.startsWith(t) || t.startsWith(key))) vote(ids);
      });
  }
  const cand = [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 400);
  return cand
    .map(([i]) => ({ p: entries[i].p, score: score(q, entries[i].pr) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function searchCatalog(query: string, limit = 40): CatalogProduct[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: CatalogProduct[] = [];
  for (const p of list) {
    const hay = `${p.code} ${p.name} ${p.description ?? ""}`.toLowerCase();
    if (terms.every((t) => hay.includes(t))) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function buildRows(raw: RawRow[]): ImportRow[] {
  return raw.map((r, i) => {
    const base = { id: i + 1, n: i + 1, origCode: r.code, origName: r.name, qty: r.qty };
    const code = r.code.trim().toUpperCase();
    const hitCode = code ? byCode.get(code) : undefined;
    if (hitCode)
      return { ...base, productCode: hitCode.code, kind: "exact", method: "Código exacto", score: 100, ambiguous: false };
    const dm = code.match(/^A?(\d+)A?$/);
    const hitDigits = dm ? byDigits.get(dm[1]) : undefined;
    if (hitDigits)
      return { ...base, productCode: hitDigits.code, kind: "exact", method: "Código exacto (sin A)", score: 100, ambiguous: false };

    const nameKey = r.name.trim();
    if (nameKey) {
      const ranked = rank(nameKey, 2);
      const best = ranked[0];
      if (best && best.score === 100)
        return { ...base, productCode: best.p.code, kind: "suggested", method: "Nombre exacto", score: 100, ambiguous: false };
      if (best && best.score >= 50)
        return {
          ...base,
          productCode: best.p.code,
          kind: "suggested",
          method: "Similitud de nombre",
          score: best.score,
          ambiguous: !!ranked[1] && best.score - ranked[1].score <= 8,
        };
    }
    if (code && code.length >= 3) {
      const pre = list.find((p) => {
        const c = p.code.toUpperCase();
        return c.startsWith(code) || code.startsWith(c);
      });
      if (pre) return { ...base, productCode: pre.code, kind: "suggested", method: "Código similar", score: 78, ambiguous: false };
    }
    // Sin nombre: intentar el texto del código como nombre
    if (!nameKey && code) {
      const best = rank(code, 1)[0];
      if (best && best.score >= 60)
        return { ...base, productCode: best.p.code, kind: "suggested", method: "Similitud de nombre", score: best.score, ambiguous: false };
    }
    return { ...base, productCode: null, kind: "none", method: "Sin coincidencia", score: 0, ambiguous: false };
  });
}

export const validQty = (q: number) => Number.isInteger(q) && q > 0;

export function statusOf(r: ImportRow): RowStatus {
  if (!validQty(r.qty)) return "error";
  return r.kind;
}

/** Datos de ejemplo (≈ 46 filas) para recorrer el prototipo. */
export function demoRows(): RawRow[] {
  const head: RawRow[] = [
    { code: "SAM-A15", name: "", qty: 10 },
    { code: "IP13-128", name: "", qty: 5 },
    { code: "", name: "Samsun A15 128", qty: 8 },
    { code: "RED-N13", name: "", qty: 15 },
    { code: "", name: "iPhone 13 128GB", qty: 5 },
    { code: "", name: "Xiaomi Redmi Note 13", qty: 6 },
    { code: "", name: "Cargador 20W tipo C", qty: 30 },
    { code: "", name: "Forro silicon iPhone 13", qty: 24 },
    { code: "ZZ-991", name: "Parlante portátil genérico", qty: 3 },
    { code: "SAM-A15", name: "", qty: 12 },
    { code: "MOT-G54", name: "", qty: 0 },
    { code: "", name: "Audifonos bluetooth JBL T510", qty: 9 },
    { code: "", name: "Vidrio templado A15", qty: 40 },
    { code: "SAM-A15X", name: "", qty: 4 },
    { code: "", name: "Cable USB-C 1m", qty: 50 },
    { code: "", name: "Smartwatch T800", qty: 7 },
  ];
  const extra: RawRow[] = [];
  const pool = DEMO_CATALOG.slice(5);
  for (let i = 0; i < 30; i++) {
    const p = pool[i % pool.length];
    const qty = ((i * 7) % 19) + 1;
    if (i % 3 === 0) extra.push({ code: p.code, name: "", qty });
    else if (i % 3 === 1) extra.push({ code: "", name: p.name.toLowerCase().replace(/ /, "  "), qty });
    else extra.push({ code: p.code, name: p.name, qty: i === 29 ? -2 : qty });
  }
  return [...head, ...extra];
}
