import { custoPorUnidade } from "../../dinheiro";
import { getDb, transacao } from "../connection";

export interface Compra {
  id: number;
  insumo_id: number;
  data_compra: string; // AAAA-MM-DD
  quantidade: number;
  valor_pago_centavos: number;
  custo_unitario_centavos: number; // valor pago ÷ quantidade desta compra
  observacao: string | null;
  criado_em: string;
}

export interface DadosCompra {
  data_compra: string;
  quantidade: number;
  valor_pago_centavos: number;
  observacao: string | null;
}

function paraCompra(linha: unknown): Compra {
  const c = linha as Omit<Compra, "custo_unitario_centavos">;
  return { ...c, custo_unitario_centavos: custoPorUnidade(c.valor_pago_centavos, c.quantidade) };
}

function buscarCompraPorId(id: number): Compra | null {
  const linha = getDb().prepare("SELECT * FROM compras_insumo WHERE id = ?").get(id);
  return linha ? paraCompra(linha) : null;
}

/** Compras do insumo, mais recentes primeiro. */
export function listarCompras(insumoId: number): Compra[] {
  return getDb()
    .prepare("SELECT * FROM compras_insumo WHERE insumo_id = ? ORDER BY data_compra DESC, id DESC")
    .all(insumoId)
    .map(paraCompra);
}

/** Grava a compra e soma a quantidade ao estoque. Use dentro de uma transação. */
export function inserirCompra(insumoId: number, dados: DadosCompra): number {
  const db = getDb();
  const resultado = db
    .prepare(
      `INSERT INTO compras_insumo (insumo_id, data_compra, quantidade, valor_pago_centavos, observacao, criado_em)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(insumoId, dados.data_compra, dados.quantidade, dados.valor_pago_centavos, dados.observacao, new Date().toISOString());
  db.prepare("UPDATE insumos SET quantidade_estoque = quantidade_estoque + ?, atualizado_em = ? WHERE id = ?").run(
    dados.quantidade,
    new Date().toISOString(),
    insumoId,
  );
  return Number(resultado.lastInsertRowid);
}

/** Registra uma nova compra do insumo (ex.: +12 canecas: estoque 8 -> 20). Null se o insumo não existe. */
export function registrarCompra(insumoId: number, dados: DadosCompra): Compra | null {
  const existe = getDb().prepare("SELECT 1 FROM insumos WHERE id = ?").get(insumoId) !== undefined;
  if (!existe) return null;
  const id = transacao(() => inserirCompra(insumoId, dados));
  return buscarCompraPorId(id);
}

/** Apaga a compra e tira a quantidade dela do estoque (que pode ficar negativo). False se não existe. */
export function apagarCompra(id: number): boolean {
  const compra = buscarCompraPorId(id);
  if (!compra) return false;

  transacao(() => {
    const db = getDb();
    db.prepare("DELETE FROM compras_insumo WHERE id = ?").run(id);
    db.prepare("UPDATE insumos SET quantidade_estoque = quantidade_estoque - ?, atualizado_em = ? WHERE id = ?").run(
      compra.quantidade,
      new Date().toISOString(),
      compra.insumo_id,
    );
  });
  return true;
}
