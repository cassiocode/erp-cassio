import { getDb, transacao } from "../connection";
import { buscarInsumoPorId } from "./insumos";

export interface ItemKit {
  insumo_id: number;
  nome: string;
  quantidade: number;
}

export interface Kit {
  id: number;
  nome: string;
  preco_venda_centavos: number;
  itens: ItemKit[];
}

export interface ItemVenda {
  id: number;
  insumo_id: number;
  nome: string;
  quantidade: number;
  custo_unitario_centavos: number; // custo médio do insumo no dia da venda
}

export interface Venda {
  id: number;
  data_venda: string; // AAAA-MM-DD
  kit_id: number | null;
  kit_nome: string | null;
  cliente: string | null;
  preco_venda_centavos: number;
  custo_total_centavos: number;
  lucro_centavos: number; // pode ser negativo (prejuízo)
  observacao: string | null;
  criado_em: string;
}

export interface VendaComItens extends Venda {
  itens: ItemVenda[];
}

export interface DadosVenda {
  data_venda: string;
  kit_id: number | null;
  cliente: string | null;
  preco_venda_centavos: number;
  observacao: string | null;
  itens: { insumo_id: number; quantidade: number }[];
}

/** Algum insumo da venda (ou o kit) não existe. */
export class ItemInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ItemInvalidoError";
  }
}

/** Kits ativos (pré-definições da venda), com os insumos de cada um. */
export function listarKits(): Kit[] {
  const db = getDb();
  const itens = db.prepare(
    `SELECT ki.insumo_id, i.nome, ki.quantidade
       FROM kit_itens ki JOIN insumos i ON i.id = ki.insumo_id
      WHERE ki.kit_id = ? ORDER BY i.nome COLLATE NOCASE`,
  );
  return db
    .prepare("SELECT id, nome, preco_venda_centavos FROM kits WHERE ativo = 1 ORDER BY ordem, nome")
    .all()
    .map((linha) => {
      const kit = { ...(linha as Omit<Kit, "itens">) };
      return { ...kit, itens: itens.all(kit.id).map((i) => ({ ...(i as unknown as ItemKit) })) };
    });
}

const SELECT_VENDA = `
  SELECT v.*, k.nome AS kit_nome,
         COALESCE((SELECT SUM(vi.quantidade * vi.custo_unitario_centavos) FROM venda_itens vi WHERE vi.venda_id = v.id), 0)
           AS custo_total_centavos
    FROM vendas v
    LEFT JOIN kits k ON k.id = v.kit_id`;

function paraVenda(linha: unknown): Venda {
  const v = linha as Omit<Venda, "lucro_centavos">;
  return { ...v, lucro_centavos: v.preco_venda_centavos - v.custo_total_centavos };
}

/** Vendas mais recentes primeiro. */
export function listarVendas(): Venda[] {
  return getDb().prepare(`${SELECT_VENDA} ORDER BY v.data_venda DESC, v.id DESC`).all().map(paraVenda);
}

export function buscarVenda(id: number): VendaComItens | null {
  const db = getDb();
  const linha = db.prepare(`${SELECT_VENDA} WHERE v.id = ?`).get(id);
  if (!linha) return null;
  const itens = db
    .prepare(
      `SELECT vi.id, vi.insumo_id, i.nome, vi.quantidade, vi.custo_unitario_centavos
         FROM venda_itens vi JOIN insumos i ON i.id = vi.insumo_id
        WHERE vi.venda_id = ? ORDER BY vi.id`,
    )
    .all(id)
    .map((i) => ({ ...(i as unknown as ItemVenda) }));
  return { ...paraVenda(linha), itens };
}

/** Junta itens repetidos do mesmo insumo somando as quantidades. */
function juntarItens(itens: DadosVenda["itens"]): DadosVenda["itens"] {
  const porInsumo = new Map<number, number>();
  for (const { insumo_id, quantidade } of itens) {
    porInsumo.set(insumo_id, (porInsumo.get(insumo_id) ?? 0) + quantidade);
  }
  return [...porInsumo].map(([insumo_id, quantidade]) => ({ insumo_id, quantidade }));
}

/**
 * Registra a venda: guarda o custo médio de cada insumo no dia e tira as quantidades do estoque
 * (o estoque pode ficar negativo).
 */
export function registrarVenda(dados: DadosVenda): VendaComItens {
  const db = getDb();
  if (dados.kit_id !== null && !db.prepare("SELECT 1 FROM kits WHERE id = ?").get(dados.kit_id)) {
    throw new ItemInvalidoError("Kit não encontrado");
  }

  const itens = juntarItens(dados.itens).map((item) => {
    const insumo = buscarInsumoPorId(item.insumo_id);
    if (!insumo) throw new ItemInvalidoError(`Insumo ${item.insumo_id} não encontrado`);
    return { ...item, custo_unitario_centavos: insumo.custo_unitario_centavos ?? 0 };
  });

  const id = transacao(() => {
    const agora = new Date().toISOString();
    const venda = db
      .prepare(
        `INSERT INTO vendas (data_venda, kit_id, cliente, preco_venda_centavos, observacao, criado_em)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(dados.data_venda, dados.kit_id, dados.cliente, dados.preco_venda_centavos, dados.observacao, agora);
    const vendaId = Number(venda.lastInsertRowid);

    const inserirItem = db.prepare(
      "INSERT INTO venda_itens (venda_id, insumo_id, quantidade, custo_unitario_centavos) VALUES (?, ?, ?, ?)",
    );
    const baixarEstoque = db.prepare(
      "UPDATE insumos SET quantidade_estoque = quantidade_estoque - ?, atualizado_em = ? WHERE id = ?",
    );
    for (const item of itens) {
      inserirItem.run(vendaId, item.insumo_id, item.quantidade, item.custo_unitario_centavos);
      baixarEstoque.run(item.quantidade, agora, item.insumo_id);
    }
    return vendaId;
  });

  return buscarVenda(id)!;
}

/** Apaga a venda e devolve os insumos ao estoque. False se não existe. */
export function apagarVenda(id: number): boolean {
  const venda = buscarVenda(id);
  if (!venda) return false;

  transacao(() => {
    const db = getDb();
    const agora = new Date().toISOString();
    const devolver = db.prepare(
      "UPDATE insumos SET quantidade_estoque = quantidade_estoque + ?, atualizado_em = ? WHERE id = ?",
    );
    for (const item of venda.itens) devolver.run(item.quantidade, agora, item.insumo_id);
    db.prepare("DELETE FROM venda_itens WHERE venda_id = ?").run(id);
    db.prepare("DELETE FROM vendas WHERE id = ?").run(id);
  });
  return true;
}
