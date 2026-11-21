/**
 * Gerador pseudoaleatório com semente (mulberry32).
 *
 * Os dados de demonstração PRECISAM ser determinísticos: o Next 16 (Cache
 * Components) prerenderiza as páginas e não aceita Math.random() no render,
 * e servidor e navegador têm que gerar exatamente os mesmos números.
 * Use sempre este PRNG com uma semente fixa — nunca Math.random().
 */
export function criarPrng(semente: number | string) {
  let s = typeof semente === "string" ? hashString(semente) : semente >>> 0;
  const proximo = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** [0, 1) */
    proximo,
    /** [min, max) */
    entre: (min: number, max: number) => min + (max - min) * proximo(),
    /** inteiro em [min, max] */
    inteiro: (min: number, max: number) => Math.floor(min + (max - min + 1) * proximo()),
    /** ruído normal aproximado (média 0, desvio 1) */
    normal: () => {
      let u = 0;
      let v = 0;
      while (u === 0) u = proximo();
      while (v === 0) v = proximo();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    },
    escolher: <T>(itens: readonly T[]): T => itens[Math.floor(proximo() * itens.length)],
    chance: (p: number) => proximo() < p,
  };
}

export type Prng = ReturnType<typeof criarPrng>;

export function hashString(texto: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Arredonda para centavos */
export const centavos = (v: number) => Math.round(v * 100) / 100;
