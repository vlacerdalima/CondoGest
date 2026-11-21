"use client";

/**
 * Store do navegador para o MVP sem banco.
 *
 * - Contas enviadas pelo gestor (tela "Enviar conta") ficam no localStorage.
 * - Pagamentos registrados ("marcar como paga") também, inclusive sobre contas demo.
 * - Hooks usam useSyncExternalStore: no servidor (prerender) o snapshot é vazio,
 *   então o HTML inicial mostra só a demo; no navegador, os dados locais entram
 *   logo após a hidratação, sem erro de hidratação.
 *
 * Use SEMPRE `useContas()` nas telas (nunca obterContasDemo() direto em
 * componentes que devem refletir envios do gestor).
 */
import { useMemo, useSyncExternalStore } from "react";
import type { Conta, DataISO } from "../tipos";
import { obterContasDemo } from "./index";

const CHAVE = "condogest:v1";

interface EstadoLocal {
  enviadas: Conta[];
  /** id da conta → data de pagamento (null = desfazer pagamento) */
  pagamentos: Record<string, DataISO | null>;
}

const VAZIO: EstadoLocal = { enviadas: [], pagamentos: {} };
let estado: EstadoLocal | null = null;
const ouvintes = new Set<() => void>();

function ler(): EstadoLocal {
  if (typeof window === "undefined") return VAZIO;
  if (estado) return estado;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    const parsed = bruto ? (JSON.parse(bruto) as Partial<EstadoLocal>) : {};
    estado = { enviadas: parsed.enviadas ?? [], pagamentos: parsed.pagamentos ?? {} };
  } catch {
    estado = { ...VAZIO };
  }
  return estado;
}

function gravar(novo: EstadoLocal) {
  estado = novo;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(novo));
  } catch {
    // Sem storage (aba anônima, cota cheia): mantém só em memória.
  }
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  const aoMudarStorage = (e: StorageEvent) => {
    if (e.key === CHAVE) {
      estado = null;
      f();
    }
  };
  window.addEventListener("storage", aoMudarStorage);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener("storage", aoMudarStorage);
  };
}

const snapshotServidor = () => VAZIO;

function useEstadoLocal() {
  return useSyncExternalStore(assinar, ler, snapshotServidor);
}

/* ------------------------------ ações ------------------------------ */

export type NovaConta = Omit<Conta, "id" | "origem" | "enviadaEm">;

/** Salva uma conta enviada pelo gestor e devolve a conta completa */
export function adicionarConta(dados: NovaConta, arquivoNome?: string): Conta {
  const conta: Conta = {
    ...dados,
    id: `envio-${crypto.randomUUID()}`,
    origem: "envio",
    arquivoNome: arquivoNome ?? dados.arquivoNome,
    enviadaEm: new Date().toISOString(),
  };
  if (conta.energia && !conta.energia.ucId) {
    throw new Error("Conta de energia precisa de ucId");
  }
  const atual = ler();
  gravar({ ...atual, enviadas: [...atual.enviadas, conta] });
  return conta;
}

export function removerContaEnviada(id: string) {
  const atual = ler();
  gravar({ ...atual, enviadas: atual.enviadas.filter((c) => c.id !== id) });
}

export function registrarPagamento(id: string, data: DataISO | null) {
  const atual = ler();
  gravar({ ...atual, pagamentos: { ...atual.pagamentos, [id]: data } });
}

/** Apaga tudo que o gestor fez no navegador e volta à demonstração original */
export function restaurarDemonstracao() {
  gravar({ enviadas: [], pagamentos: {} });
}

/* ------------------------------ hooks ------------------------------ */

/** Todas as contas (demo + enviadas), com pagamentos locais aplicados */
export function useContas(): Conta[] {
  const local = useEstadoLocal();
  return useMemo(() => {
    const todas = [...obterContasDemo(), ...local.enviadas];
    const temPagamentos = Object.keys(local.pagamentos).length > 0;
    if (!temPagamentos) return todas;
    return todas.map((c) => {
      if (!(c.id in local.pagamentos)) return c;
      const pagaEm = local.pagamentos[c.id];
      return { ...c, pagaEm: pagaEm ?? undefined };
    });
  }, [local]);
}

/** Só as contas enviadas pelo gestor neste navegador */
export function useContasEnviadas(): Conta[] {
  return useEstadoLocal().enviadas;
}
