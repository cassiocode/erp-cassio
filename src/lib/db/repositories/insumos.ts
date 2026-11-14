import { custoPorUnidade } from "../../dinheiro";
import { normalizarTexto } from "../../texto";
import { getDb, transacao } from "../connection";
import { ehViolacaoDeUnico, NomeDuplicadoError } from "../erros";
import { inserirCompra } from "./compras";

export interface Insumo {
  id: number;
  nome: string;
  quantidade_estoque: number; // pode ser negativa
  observacao: string | null;
  ativo: number; // 1 = ativo, 0 = inativo
  criado_em: string;
  atualizado_em: string;
  // Calculados a partir das compras
  total_pago_centavos: number;
  quantidade_comprada: number;
  custo_unitario_centavos: number | null; // custo médio; null se não há compras
}

/** Cadastro de insumo novo: o total pago e a quantidade viram a primeira compra. */
export interface DadosNovoInsumo {
  nome: string;
  valor_pago_centavos: number;
  quantidade_comprada: number;
  data_compra: string; // AAAA-MM-DD
  observacao: string | null;
}

/** Edição: total pago e quantidade mudam só pelas compras. */
export interface DadosEdicaoInsumo {
  nome: string;
  quantidade_estoque: number;
  observacao: string | null;
}

export interface FiltrosInsumos {
  busca?: string;
  ativo?: 0 | 1;
}

const MENSAGEM_DUPLICADO = "Já existe um insumo com este nome";

const SELECT_INSUMO = `
  SELECT i.*,
         COALESCE(SUM(c.valor_pago_centavos), 0) AS total_pago_centavos,
         COALESCE(SUM(c.quantidade), 0) AS quantidade_comprada
    FROM insumos i
    LEFT JOIN compras_insumo c ON c.insumo_id = i.id`;

// node:sqlite devolve objetos sem protótipo; copiamos e calculamos o custo médio
function paraInsumo(linha: unknown): Insumo {
  const i = linha as Omit<Insumo, "custo_unitario_centavos">;
  return {
    ...i,
    custo_unitario_centavos:
      i.quantidade_comprada > 0 ? custoPorUnidade(i.total_pago_centavos, i.quantidade_comprada) : null,
  };
}

export function listarInsumos(filtros: FiltrosInsumos = {}): Insumo[] {
  const condicoes: string[] = [];
  const params: (string | number)[] = [];

  if (filtros.busca?.trim()) {
    // Busca sem diferenciar maiúsculas nem acentos ("termica" acha "Fita térmica")
    const termo = normalizarTexto(filtros.busca).replace(/[\\%_]/g, "\\$&");
    condicoes.push("normalizar(i.nome) LIKE ? ESCAPE '\\'");
    params.push(`%${termo}%`);
  }
  if (filtros.ativo !== undefined) {
    condicoes.push("i.ativo = ?");
    params.push(filtros.ativo);
  }

  // Só fragmentos fixos entram no SQL; valores do usuário vão sempre por parâmetro
  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const sql = `${SELECT_INSUMO} ${where} GROUP BY i.id ORDER BY i.ativo DESC, i.nome COLLATE NOCASE`;

  return getDb().prepare(sql).all(...params).map(paraInsumo);
}

export function buscarInsumoPorId(id: number): Insumo | null {
  const linha = getDb().prepare(`${SELECT_INSUMO} WHERE i.id = ? GROUP BY i.id`).get(id);
  return linha ? paraInsumo(linha) : null;
}

function nomeJaExiste(nome: string, ignorarId = -1): boolean {
  return (
    getDb()
      .prepare("SELECT 1 FROM insumos WHERE normalizar(nome) = ? AND id <> ?")
      .get(normalizarTexto(nome), ignorarId) !== undefined
  );
}

/** Cria o insumo com estoque zero e registra a primeira compra (que soma ao estoque). */
export function criarInsumo(dados: DadosNovoInsumo): Insumo {
  if (nomeJaExiste(dados.nome)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);

  const agora = new Date().toISOString();
  try {
    const id = transacao(() => {
      const resultado = getDb()
        .prepare(
          `INSERT INTO insumos (nome, quantidade_estoque, observacao, ativo, criado_em, atualizado_em)
           VALUES (?, 0, ?, 1, ?, ?)`,
        )
        .run(dados.nome, dados.observacao, agora, agora);
      const novoId = Number(resultado.lastInsertRowid);
      inserirCompra(novoId, {
        data_compra: dados.data_compra,
        quantidade: dados.quantidade_comprada,
        valor_pago_centavos: dados.valor_pago_centavos,
        observacao: null,
      });
      return novoId;
    });
    return buscarInsumoPorId(id)!;
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
    throw erro;
  }
}

export function atualizarInsumo(id: number, dados: DadosEdicaoInsumo): Insumo | null {
  if (!buscarInsumoPorId(id)) return null;
  if (nomeJaExiste(dados.nome, id)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);

  try {
    getDb()
      .prepare("UPDATE insumos SET nome = ?, quantidade_estoque = ?, observacao = ?, atualizado_em = ? WHERE id = ?")
      .run(dados.nome, dados.quantidade_estoque, dados.observacao, new Date().toISOString(), id);
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
    throw erro;
  }
  return buscarInsumoPorId(id);
}

/** Exclusão lógica: inativa ou reativa. Insumo não é apagado (as compras dele ficam no histórico). */
export function definirInsumoAtivo(id: number, ativo: boolean): Insumo | null {
  const resultado = getDb()
    .prepare("UPDATE insumos SET ativo = ?, atualizado_em = ? WHERE id = ?")
    .run(ativo ? 1 : 0, new Date().toISOString(), id);
  return resultado.changes > 0 ? buscarInsumoPorId(id) : null;
}
