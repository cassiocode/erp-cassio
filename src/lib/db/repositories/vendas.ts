import { valorDesconto } from "../../descontos";
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

/**
 * - rascunho: anotação, não mexe no estoque
 * - pre_venda: entrega futura; os insumos já saíram do estoque
 * - concluida: entregue; definitiva (não volta para o estoque)
 */
export type StatusVenda = "rascunho" | "pre_venda" | "concluida";
export const STATUS_VENDA: StatusVenda[] = ["rascunho", "pre_venda", "concluida"];

/** Status em que os insumos já saíram do estoque. */
const tiraDoEstoque = (status: StatusVenda) => status !== "rascunho";

export interface ItemVenda {
  id: number;
  insumo_id: number;
  nome: string;
  quantidade: number;
  custo_unitario_centavos: number; // custo médio do insumo quando a venda foi salva
}

export interface KitDaVenda {
  kit_id: number;
  nome: string;
  quantidade: number; // canecas deste kit
  preco_unitario_centavos: number; // preço do kit no dia
}

export interface Venda {
  id: number;
  status: StatusVenda;
  data_venda: string; // AAAA-MM-DD
  data_prevista: string | null; // previsão de entrega
  kits_resumo: string | null; // "2× Caneca branca, 1× Caneca preta"; null = avulsa
  quantidade_canecas: number;
  desconto_percentual: number; // sobre o preço dos kits
  desconto_centavos: number;
  cliente: string | null;
  preco_venda_centavos: number; // preço final (já com desconto)
  valor_pago_centavos: number; // já pago pelo cliente (sinal da pré-venda)
  custo_energia_centavos: number; // 0 quando a energia foi desmarcada
  custo_total_centavos: number; // insumos + energia
  lucro_centavos: number; // pode ser negativo (prejuízo)
  observacao: string | null;
  criado_em: string;
}

export interface VendaComItens extends Venda {
  kits: KitDaVenda[];
  itens: ItemVenda[];
}

export interface DadosVenda {
  status: StatusVenda;
  data_venda: string;
  data_prevista: string | null;
  kits: { kit_id: number; quantidade: number }[];
  desconto_percentual: number; // 0 a 100, sobre o preço dos kits
  valor_pago_centavos: number; // sinal já pago (não pode passar do preço)
  cliente: string | null;
  preco_venda_centavos: number;
  custo_energia_centavos: number;
  observacao: string | null;
  itens: { insumo_id: number; quantidade: number }[];
}

/** Falta de material para uma pré-venda: o estoque do insumo ficou negativo. */
export interface FaltaMaterial {
  venda_id: number | null; // null = a venda que está sendo lançada agora (ainda não gravada)
  cliente: string | null;
  data_prevista: string | null;
  insumo_id: number;
  insumo_nome: string;
  falta: number;
}

/** Algum insumo da venda (ou o kit) não existe. */
export class ItemInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ItemInvalidoError";
  }
}

/** A operação não vale para o status atual (ex.: apagar venda concluída). */
export class StatusInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "StatusInvalidoError";
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
  SELECT v.*,
         (SELECT group_concat(vk.quantidade || '× ' || k.nome, ', ')
            FROM venda_kits vk JOIN kits k ON k.id = vk.kit_id WHERE vk.venda_id = v.id) AS kits_resumo,
         COALESCE((SELECT SUM(vk.quantidade) FROM venda_kits vk WHERE vk.venda_id = v.id), 0) AS quantidade_canecas,
         v.custo_energia_centavos +
         COALESCE((SELECT SUM(vi.quantidade * vi.custo_unitario_centavos) FROM venda_itens vi WHERE vi.venda_id = v.id), 0)
           AS custo_total_centavos
    FROM vendas v`;

function paraVenda(linha: unknown): Venda {
  const v = linha as Omit<Venda, "lucro_centavos">;
  return { ...v, lucro_centavos: v.preco_venda_centavos - v.custo_total_centavos };
}

/**
 * Pré-vendas primeiro (entrega mais próxima no topo), depois rascunhos (por entrega) e por fim as
 * concluídas (mais recentes primeiro).
 */
export function listarVendas(filtro: { status?: StatusVenda } = {}): Venda[] {
  const where = filtro.status ? "WHERE v.status = ?" : "";
  const params = filtro.status ? [filtro.status] : [];
  return getDb()
    .prepare(
      `${SELECT_VENDA} ${where}
        ORDER BY CASE v.status WHEN 'pre_venda' THEN 0 WHEN 'rascunho' THEN 1 ELSE 2 END,
                 CASE WHEN v.status <> 'concluida' THEN COALESCE(v.data_prevista, '9999-12-31') END ASC,
                 v.data_venda DESC, v.id DESC`,
    )
    .all(...params)
    .map(paraVenda);
}

function itensDaVenda(id: number): ItemVenda[] {
  return getDb()
    .prepare(
      `SELECT vi.id, vi.insumo_id, i.nome, vi.quantidade, vi.custo_unitario_centavos
         FROM venda_itens vi JOIN insumos i ON i.id = vi.insumo_id
        WHERE vi.venda_id = ? ORDER BY vi.id`,
    )
    .all(id)
    .map((i) => ({ ...(i as unknown as ItemVenda) }));
}

function kitsDaVenda(id: number): KitDaVenda[] {
  return getDb()
    .prepare(
      `SELECT vk.kit_id, k.nome, vk.quantidade, vk.preco_unitario_centavos
         FROM venda_kits vk JOIN kits k ON k.id = vk.kit_id
        WHERE vk.venda_id = ? ORDER BY k.ordem, k.nome`,
    )
    .all(id)
    .map((k) => ({ ...(k as unknown as KitDaVenda) }));
}

export function buscarVenda(id: number): VendaComItens | null {
  const linha = getDb().prepare(`${SELECT_VENDA} WHERE v.id = ?`).get(id);
  return linha ? { ...paraVenda(linha), kits: kitsDaVenda(id), itens: itensDaVenda(id) } : null;
}

/** Junta itens repetidos do mesmo insumo somando as quantidades. */
function juntarItens(itens: DadosVenda["itens"]): DadosVenda["itens"] {
  const porInsumo = new Map<number, number>();
  for (const { insumo_id, quantidade } of itens) {
    porInsumo.set(insumo_id, (porInsumo.get(insumo_id) ?? 0) + quantidade);
  }
  return [...porInsumo].map(([insumo_id, quantidade]) => ({ insumo_id, quantidade }));
}

/** Quanto sai do estoque, por insumo: os itens, se o status tira do estoque; senão nada. */
function saidaDoEstoque(status: StatusVenda, itens: { insumo_id: number; quantidade: number }[]): Map<number, number> {
  const saida = new Map<number, number>();
  if (!tiraDoEstoque(status)) return saida;
  for (const { insumo_id, quantidade } of itens) saida.set(insumo_id, (saida.get(insumo_id) ?? 0) + quantidade);
  return saida;
}

/** Diferença de estoque entre a situação nova e a antiga (positivo = sai mais do estoque). */
function diferenca(nova: Map<number, number>, antiga: Map<number, number>): Map<number, number> {
  const delta = new Map<number, number>();
  for (const id of new Set([...nova.keys(), ...antiga.keys()])) {
    const d = (nova.get(id) ?? 0) - (antiga.get(id) ?? 0);
    if (d !== 0) delta.set(id, d);
  }
  return delta;
}

function validar(dados: DadosVenda) {
  const precoKit = getDb().prepare("SELECT preco_venda_centavos FROM kits WHERE id = ?");
  const porKit = new Map<number, number>();
  for (const { kit_id, quantidade } of dados.kits) porKit.set(kit_id, (porKit.get(kit_id) ?? 0) + quantidade);
  const kits = [...porKit].map(([kit_id, quantidade]) => {
    const kit = precoKit.get(kit_id) as { preco_venda_centavos: number } | undefined;
    if (!kit) throw new ItemInvalidoError("Kit não encontrado");
    return { kit_id, quantidade, preco_unitario_centavos: kit.preco_venda_centavos };
  });

  const itens = juntarItens(dados.itens).map((item) => {
    const insumo = buscarInsumoPorId(item.insumo_id);
    if (!insumo) throw new ItemInvalidoError(`Insumo ${item.insumo_id} não encontrado`);
    return { ...item, custo_unitario_centavos: insumo.custo_unitario_centavos ?? 0 };
  });

  const totalKits = kits.reduce((s, k) => s + k.quantidade * k.preco_unitario_centavos, 0);
  return { kits, itens, desconto_centavos: valorDesconto(totalKits, dados.desconto_percentual) };
}

/**
 * Cria (id = null) ou altera a venda. O estoque é ajustado pela diferença entre o antes e o depois:
 * rascunho não mexe; pré-venda e concluída tiram. Venda concluída não pode mais ser alterada.
 * O custo dos insumos é o custo médio do momento em que se salva.
 */
export function salvarVenda(id: number | null, dados: DadosVenda): VendaComItens | null {
  const antiga = id === null ? null : buscarVenda(id);
  if (id !== null && !antiga) return null;
  if (antiga?.status === "concluida") throw new StatusInvalidoError("Venda concluída não pode ser alterada");

  const { kits, itens, desconto_centavos } = validar(dados);
  const delta = diferenca(
    saidaDoEstoque(dados.status, itens),
    antiga ? saidaDoEstoque(antiga.status, antiga.itens) : new Map(),
  );

  const vendaId = transacao(() => {
    const db = getDb();
    const agora = new Date().toISOString();
    // kit_id (coluna antiga) fica com o primeiro kit, só por compatibilidade; os kits estão em venda_kits
    const valores = [
      dados.status,
      dados.data_venda,
      dados.data_prevista,
      kits[0]?.kit_id ?? null,
      dados.cliente,
      dados.preco_venda_centavos,
      dados.custo_energia_centavos,
      dados.desconto_percentual,
      desconto_centavos,
      dados.valor_pago_centavos,
      dados.observacao,
    ] as const;

    let vId: number;
    if (antiga) {
      vId = antiga.id;
      db.prepare(
        `UPDATE vendas SET status = ?, data_venda = ?, data_prevista = ?, kit_id = ?, cliente = ?,
                preco_venda_centavos = ?, custo_energia_centavos = ?, desconto_percentual = ?,
                desconto_centavos = ?, valor_pago_centavos = ?, observacao = ?
          WHERE id = ?`,
      ).run(...valores, vId);
      db.prepare("DELETE FROM venda_itens WHERE venda_id = ?").run(vId);
      db.prepare("DELETE FROM venda_kits WHERE venda_id = ?").run(vId);
    } else {
      const r = db
        .prepare(
          `INSERT INTO vendas (status, data_venda, data_prevista, kit_id, cliente, preco_venda_centavos,
                              custo_energia_centavos, desconto_percentual, desconto_centavos, valor_pago_centavos,
                              observacao, criado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...valores, agora);
      vId = Number(r.lastInsertRowid);
    }

    const inserirKit = db.prepare(
      "INSERT INTO venda_kits (venda_id, kit_id, quantidade, preco_unitario_centavos) VALUES (?, ?, ?, ?)",
    );
    for (const k of kits) inserirKit.run(vId, k.kit_id, k.quantidade, k.preco_unitario_centavos);

    const inserirItem = db.prepare(
      "INSERT INTO venda_itens (venda_id, insumo_id, quantidade, custo_unitario_centavos) VALUES (?, ?, ?, ?)",
    );
    for (const item of itens) inserirItem.run(vId, item.insumo_id, item.quantidade, item.custo_unitario_centavos);

    const ajustar = db.prepare(
      "UPDATE insumos SET quantidade_estoque = quantidade_estoque - ?, atualizado_em = ? WHERE id = ?",
    );
    for (const [insumoId, qtd] of delta) ajustar.run(qtd, agora, insumoId);
    return vId;
  });

  return buscarVenda(vendaId);
}

/** Atalho para criar a venda (o estoque sai conforme o status). */
export function registrarVenda(dados: DadosVenda): VendaComItens {
  return salvarVenda(null, dados)!;
}

/**
 * Conclui (entrega) um rascunho ou pré-venda. Pré-venda não mexe no estoque de novo; rascunho tira agora.
 * A data da venda passa a ser a da conclusão. Null se não existe.
 */
export function concluirVenda(id: number, dataConclusao: string): VendaComItens | null {
  const venda = buscarVenda(id);
  if (!venda) return null;
  if (venda.status === "concluida") throw new StatusInvalidoError("A venda já está concluída");
  return salvarVenda(id, {
    status: "concluida",
    data_venda: dataConclusao,
    data_prevista: venda.data_prevista,
    kits: venda.kits.map(({ kit_id, quantidade }) => ({ kit_id, quantidade })),
    desconto_percentual: venda.desconto_percentual,
    valor_pago_centavos: venda.valor_pago_centavos,
    cliente: venda.cliente,
    preco_venda_centavos: venda.preco_venda_centavos,
    custo_energia_centavos: venda.custo_energia_centavos,
    observacao: venda.observacao,
    itens: venda.itens,
  });
}

/**
 * Apaga um rascunho ou cancela uma pré-venda (os insumos voltam para o estoque).
 * Venda concluída não pode ser apagada: o que foi vendido não volta para o estoque.
 */
export function apagarVenda(id: number): boolean {
  const venda = buscarVenda(id);
  if (!venda) return false;
  if (venda.status === "concluida") {
    throw new StatusInvalidoError("Venda concluída não pode ser apagada: o que foi vendido não volta para o estoque");
  }

  transacao(() => {
    const db = getDb();
    const agora = new Date().toISOString();
    const devolver = db.prepare(
      "UPDATE insumos SET quantidade_estoque = quantidade_estoque + ?, atualizado_em = ? WHERE id = ?",
    );
    for (const [insumoId, qtd] of saidaDoEstoque(venda.status, venda.itens)) devolver.run(qtd, agora, insumoId);
    db.prepare("DELETE FROM venda_itens WHERE venda_id = ?").run(id);
    db.prepare("DELETE FROM venda_kits WHERE venda_id = ?").run(id);
    db.prepare("DELETE FROM vendas WHERE id = ?").run(id);
  });
  return true;
}

/**
 * Faltas de material das pré-vendas em aberto. O estoque já descontou as pré-vendas, então estoque
 * negativo = alguma pré-venda sem material. A falta fica com quem entrega por último (a entrega mais
 * próxima tem prioridade no material que existe).
 *
 * `saidaExtra` simula uma saída que ainda vai acontecer (baixa, venda...): insumo -> quantidade.
 * `donoDaSaida`: se a saída é de uma venda (nova ou sendo editada), ela entra na fila com a data dela.
 */
export function calcularFaltas(
  saidaExtra: Map<number, number> = new Map(),
  donoDaSaida: { venda_id: number | null; data_prevista: string | null; cliente: string | null } | null = null,
): FaltaMaterial[] {
  const db = getDb();
  const insumos = db.prepare("SELECT id, nome, quantidade_estoque FROM insumos").all() as unknown as {
    id: number;
    nome: string;
    quantidade_estoque: number;
  }[];
  const usos = db.prepare(
    `SELECT v.id AS venda_id, v.cliente, v.data_prevista, SUM(vi.quantidade) AS quantidade
       FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id
      WHERE v.status = 'pre_venda' AND vi.insumo_id = ?
      GROUP BY v.id`,
  );

  const faltas: FaltaMaterial[] = [];
  for (const insumo of insumos) {
    const extra = saidaExtra.get(insumo.id) ?? 0;
    let falta = -(insumo.quantidade_estoque - extra);
    if (falta <= 0) continue;

    // Quem precisa deste insumo
    type Uso = { venda_id: number | null; cliente: string | null; data_prevista: string | null; quantidade: number };
    const fila = usos.all(insumo.id).map((u) => ({ ...(u as unknown as Uso) }));
    if (donoDaSaida && extra > 0) {
      const mesma = donoDaSaida.venda_id === null ? undefined : fila.find((u) => u.venda_id === donoDaSaida.venda_id);
      if (mesma) mesma.quantidade += extra;
      else fila.push({ ...donoDaSaida, quantidade: extra });
    }
    // A falta fica com a entrega mais distante (sem data = por último); empate: a mais nova
    fila.sort(
      (a, b) =>
        (b.data_prevista ?? "9999-12-31").localeCompare(a.data_prevista ?? "9999-12-31") ||
        (b.venda_id ?? Infinity) - (a.venda_id ?? Infinity),
    );

    for (const uso of fila) {
      if (falta <= 0) break;
      const parte = Math.min(uso.quantidade, falta);
      faltas.push({
        venda_id: uso.venda_id,
        cliente: uso.cliente,
        data_prevista: uso.data_prevista,
        insumo_id: insumo.id,
        insumo_nome: insumo.nome,
        falta: parte,
      });
      falta -= parte;
    }
  }
  return faltas;
}

/**
 * Simula salvar a venda e devolve as faltas que ela causaria nas pré-vendas (e nela mesma).
 * Só considera os insumos que sairiam a mais do estoque.
 */
export function faltasAoSalvar(id: number | null, dados: Pick<DadosVenda, "status" | "data_prevista" | "cliente" | "itens">): FaltaMaterial[] {
  const antiga = id === null ? null : buscarVenda(id);
  const delta = diferenca(
    saidaDoEstoque(dados.status, juntarItens(dados.itens)),
    antiga ? saidaDoEstoque(antiga.status, antiga.itens) : new Map(),
  );
  const saida = new Map([...delta].filter(([, qtd]) => qtd > 0));
  if (saida.size === 0) return [];
  // Venda entregue agora (e baixa) pega o material primeiro: a falta cai nas pré-vendas.
  // Pré-venda entra na fila pela data de entrega dela.
  const dono =
    dados.status === "pre_venda" ? { venda_id: id, data_prevista: dados.data_prevista, cliente: dados.cliente } : null;
  return calcularFaltas(saida, dono).filter((f) => saida.has(f.insumo_id));
}

/** Faltas que uma saída avulsa (ex.: baixa) causaria nas pré-vendas. */
export function faltasAoTirar(insumoId: number, quantidade: number): FaltaMaterial[] {
  return calcularFaltas(new Map([[insumoId, quantidade]])).filter((f) => f.insumo_id === insumoId);
}
