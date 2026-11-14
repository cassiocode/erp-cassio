import { getDb, transacao } from "../connection";
import { buscarInsumoPorId } from "./insumos";

export interface Baixa {
  id: number;
  insumo_id: number;
  insumo_nome: string;
  data_baixa: string; // AAAA-MM-DD
  quantidade: number;
  motivo: string;
  custo_unitario_centavos: number; // custo médio do insumo no dia da baixa
  custo_total_centavos: number; // quantidade × custo unitário (valor perdido)
  criado_em: string;
}

export interface DadosBaixa {
  insumo_id: number;
  data_baixa: string;
  quantidade: number;
  motivo: string;
}

const SELECT_BAIXA = `
  SELECT b.*, i.nome AS insumo_nome, b.quantidade * b.custo_unitario_centavos AS custo_total_centavos
    FROM baixas b JOIN insumos i ON i.id = b.insumo_id`;

const paraBaixa = (linha: unknown): Baixa => ({ ...(linha as Baixa) });

export function buscarBaixa(id: number): Baixa | null {
  const linha = getDb().prepare(`${SELECT_BAIXA} WHERE b.id = ?`).get(id);
  return linha ? paraBaixa(linha) : null;
}

/** Baixas mais recentes primeiro. */
export function listarBaixas(): Baixa[] {
  return getDb().prepare(`${SELECT_BAIXA} ORDER BY b.data_baixa DESC, b.id DESC`).all().map(paraBaixa);
}

/** Registra a baixa e tira a quantidade do estoque (que pode ficar negativo). Null se o insumo não existe. */
export function registrarBaixa(dados: DadosBaixa): Baixa | null {
  const insumo = buscarInsumoPorId(dados.insumo_id);
  if (!insumo) return null;

  const id = transacao(() => {
    const db = getDb();
    const agora = new Date().toISOString();
    const resultado = db
      .prepare(
        `INSERT INTO baixas (insumo_id, data_baixa, quantidade, motivo, custo_unitario_centavos, criado_em)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(dados.insumo_id, dados.data_baixa, dados.quantidade, dados.motivo, insumo.custo_unitario_centavos ?? 0, agora);
    db.prepare("UPDATE insumos SET quantidade_estoque = quantidade_estoque - ?, atualizado_em = ? WHERE id = ?").run(
      dados.quantidade,
      agora,
      dados.insumo_id,
    );
    return Number(resultado.lastInsertRowid);
  });
  return buscarBaixa(id);
}

/** Apaga a baixa (lançada por engano) e devolve a quantidade ao estoque. False se não existe. */
export function apagarBaixa(id: number): boolean {
  const baixa = buscarBaixa(id);
  if (!baixa) return false;

  transacao(() => {
    const db = getDb();
    db.prepare("DELETE FROM baixas WHERE id = ?").run(id);
    db.prepare("UPDATE insumos SET quantidade_estoque = quantidade_estoque + ?, atualizado_em = ? WHERE id = ?").run(
      baixa.quantidade,
      new Date().toISOString(),
      baixa.insumo_id,
    );
  });
  return true;
}
