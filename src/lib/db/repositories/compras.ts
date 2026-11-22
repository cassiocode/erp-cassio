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
  entregue: number; // 1 = chegou (está no estoque), 0 = pendente de entrega (fora do estoque)
  data_prevista_entrega: string | null; // previsão do fornecedor
  data_entrega: string | null; // quando chegou
  criado_em: string;
}

export interface DadosCompra {
  data_compra: string;
  quantidade: number;
  valor_pago_centavos: number;
  observacao: string | null;
  entregue?: boolean; // ausente = já chegou
  data_prevista_entrega?: string | null;
}

/** A operação não vale para a situação da compra (ex.: marcar como entregue o que já chegou). */
export class CompraInvalidaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "CompraInvalidaError";
  }
}

function paraCompra(linha: unknown): Compra {
  const c = linha as Omit<Compra, "custo_unitario_centavos">;
  return { ...c, custo_unitario_centavos: custoPorUnidade(c.valor_pago_centavos, c.quantidade) };
}

export function buscarCompraPorId(id: number): Compra | null {
  const linha = getDb().prepare("SELECT * FROM compras_insumo WHERE id = ?").get(id);
  return linha ? paraCompra(linha) : null;
}

/** Compras do insumo: pendentes de entrega primeiro (previsão mais próxima), depois as mais recentes. */
export function listarCompras(insumoId: number): Compra[] {
  return getDb()
    .prepare(
      `SELECT * FROM compras_insumo WHERE insumo_id = ?
        ORDER BY entregue, CASE WHEN entregue = 0 THEN COALESCE(data_prevista_entrega, '9999-12-31') END,
                 data_compra DESC, id DESC`,
    )
    .all(insumoId)
    .map(paraCompra);
}

function somarEstoque(insumoId: number, quantidade: number) {
  getDb()
    .prepare("UPDATE insumos SET quantidade_estoque = quantidade_estoque + ?, atualizado_em = ? WHERE id = ?")
    .run(quantidade, new Date().toISOString(), insumoId);
}

/**
 * Grava a compra. Se já chegou, a quantidade soma ao estoque; se está pendente de entrega, só entra no
 * estoque quando for marcada como entregue. Use dentro de uma transação.
 */
export function inserirCompra(insumoId: number, dados: DadosCompra): number {
  const entregue = dados.entregue ?? true;
  const resultado = getDb()
    .prepare(
      `INSERT INTO compras_insumo (insumo_id, data_compra, quantidade, valor_pago_centavos, observacao,
                                   entregue, data_prevista_entrega, data_entrega, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      insumoId,
      dados.data_compra,
      dados.quantidade,
      dados.valor_pago_centavos,
      dados.observacao,
      entregue ? 1 : 0,
      entregue ? null : (dados.data_prevista_entrega ?? null),
      entregue ? dados.data_compra : null,
      new Date().toISOString(),
    );
  if (entregue) somarEstoque(insumoId, dados.quantidade);
  return Number(resultado.lastInsertRowid);
}

/** Registra uma nova compra do insumo (ex.: +12 canecas: estoque 8 -> 20). Null se o insumo não existe. */
export function registrarCompra(insumoId: number, dados: DadosCompra): Compra | null {
  const existe = getDb().prepare("SELECT 1 FROM insumos WHERE id = ?").get(insumoId) !== undefined;
  if (!existe) return null;
  const id = transacao(() => inserirCompra(insumoId, dados));
  return buscarCompraPorId(id);
}

/** A compra pendente chegou: a quantidade entra no estoque. Null se não existe. */
export function marcarCompraEntregue(id: number, dataEntrega: string): Compra | null {
  const compra = buscarCompraPorId(id);
  if (!compra) return null;
  if (compra.entregue) throw new CompraInvalidaError("Esta compra já foi entregue");
  transacao(() => {
    getDb().prepare("UPDATE compras_insumo SET entregue = 1, data_entrega = ? WHERE id = ?").run(dataEntrega, id);
    somarEstoque(compra.insumo_id, compra.quantidade);
  });
  return buscarCompraPorId(id);
}

/** Muda a previsão de entrega da compra pendente. Null se não existe. */
export function alterarPrevisaoCompra(id: number, dataPrevista: string): Compra | null {
  const compra = buscarCompraPorId(id);
  if (!compra) return null;
  if (compra.entregue) throw new CompraInvalidaError("Esta compra já foi entregue");
  getDb().prepare("UPDATE compras_insumo SET data_prevista_entrega = ? WHERE id = ?").run(dataPrevista, id);
  return buscarCompraPorId(id);
}

/**
 * Apaga a compra. Se já tinha chegado, a quantidade sai do estoque (que pode ficar negativo); pendente
 * não mexe no estoque. False se não existe.
 */
export function apagarCompra(id: number): boolean {
  const compra = buscarCompraPorId(id);
  if (!compra) return false;

  transacao(() => {
    getDb().prepare("DELETE FROM compras_insumo WHERE id = ?").run(id);
    if (compra.entregue) somarEstoque(compra.insumo_id, -compra.quantidade);
  });
  return true;
}
