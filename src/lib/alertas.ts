import { formatarData } from "./datas";

/** Mesmo formato de FaltaMaterial do repositório (aqui sem importar o banco, para usar no navegador). */
export interface Falta {
  venda_id: number | null;
  cliente: string | null;
  data_prevista: string | null;
  insumo_nome: string;
  falta: number;
}

/** "a pré-venda #12 (Maria, entrega 20/11/2026)" ou "esta venda". */
export function descreverDono(f: Pick<Falta, "venda_id" | "cliente" | "data_prevista">): string {
  if (f.venda_id === null) return "esta venda";
  const detalhes = [f.cliente, f.data_prevista ? `entrega ${formatarData(f.data_prevista)}` : null].filter(Boolean);
  return `a pré-venda #${f.venda_id}${detalhes.length ? ` (${detalhes.join(", ")})` : ""}`;
}

/** Texto do aviso de falta de material, para confirm(). */
export function textoAlertaFaltas(faltas: Falta[], pergunta: string): string {
  const linhas = faltas.map((f) => `• ${f.falta}× ${f.insumo_nome} para ${descreverDono(f)}`);
  return `⚠️ Vai faltar material:\n${linhas.join("\n")}\n\n${pergunta}`;
}

/** Pergunta ao servidor se a saída vai deixar alguma pré-venda sem material. Falha de rede = sem alerta. */
export async function buscarFaltas(corpo: unknown): Promise<Falta[]> {
  try {
    const resposta = await fetch("/api/estoque/alertas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return resposta.ok ? ((await resposta.json()) as Falta[]) : [];
  } catch {
    return [];
  }
}
