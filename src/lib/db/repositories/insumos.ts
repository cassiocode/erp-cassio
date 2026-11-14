import { custoPorUnidade } from "../../dinheiro";
import { getDb, normalizarTexto } from "../connection";
import { ehViolacaoDeUnico, GrupoInvalidoError, NomeDuplicadoError } from "../erros";

export interface Insumo {
  id: number;
  nome: string;
  grupo_id: number;
  grupo_nome: string;
  unidade: string;
  valor_pago_centavos: number;
  rendimento: number;
  custo_unitario_centavos: number;
  quantidade_estoque: number;
  estoque_minimo: number;
  fornecedor: string | null;
  especificacao: string | null;
  ativo: number; // 1 = ativo, 0 = inativo
  criado_em: string;
  atualizado_em: string;
}

export interface DadosInsumo {
  nome: string;
  grupo_id: number;
  unidade: string;
  valor_pago_centavos: number;
  rendimento: number;
  quantidade_estoque: number;
  estoque_minimo: number;
  fornecedor: string | null;
  especificacao: string | null;
}

export interface FiltrosInsumos {
  busca?: string;
  grupoId?: number;
  ativo?: 0 | 1;
}

const MENSAGEM_DUPLICADO = "Já existe um insumo com este nome";

const SELECT_INSUMO = `
  SELECT i.*, g.nome AS grupo_nome
    FROM insumos i
    JOIN grupos_insumo g ON g.id = i.grupo_id`;

// node:sqlite devolve objetos sem protótipo; copiamos para objetos comuns
function paraInsumo(linha: unknown): Insumo {
  return { ...(linha as Insumo) };
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
  if (filtros.grupoId !== undefined) {
    condicoes.push("i.grupo_id = ?");
    params.push(filtros.grupoId);
  }
  if (filtros.ativo !== undefined) {
    condicoes.push("i.ativo = ?");
    params.push(filtros.ativo);
  }

  // Só fragmentos fixos entram no SQL; valores do usuário vão sempre por parâmetro
  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const sql = `${SELECT_INSUMO} ${where}
    ORDER BY i.ativo DESC, g.nome COLLATE NOCASE, i.nome COLLATE NOCASE`;

  return getDb().prepare(sql).all(...params).map(paraInsumo);
}

export function buscarInsumoPorId(id: number): Insumo | null {
  const linha = getDb().prepare(`${SELECT_INSUMO} WHERE i.id = ?`).get(id);
  return linha ? paraInsumo(linha) : null;
}

function nomeJaExiste(nome: string, ignorarId = -1): boolean {
  return (
    getDb()
      .prepare("SELECT 1 FROM insumos WHERE normalizar(nome) = ? AND id <> ?")
      .get(normalizarTexto(nome), ignorarId) !== undefined
  );
}

function grupoExiste(grupoId: number): boolean {
  return getDb().prepare("SELECT 1 FROM grupos_insumo WHERE id = ?").get(grupoId) !== undefined;
}

function validarAntesDeGravar(dados: DadosInsumo, ignorarId?: number) {
  if (!grupoExiste(dados.grupo_id)) throw new GrupoInvalidoError();
  if (nomeJaExiste(dados.nome, ignorarId)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
}

export function criarInsumo(dados: DadosInsumo): Insumo {
  validarAntesDeGravar(dados);

  const agora = new Date().toISOString();
  try {
    const resultado = getDb()
      .prepare(
        `INSERT INTO insumos (
           nome, grupo_id, unidade, valor_pago_centavos, rendimento, custo_unitario_centavos,
           quantidade_estoque, estoque_minimo, fornecedor, especificacao, ativo, criado_em, atualizado_em
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        dados.nome,
        dados.grupo_id,
        dados.unidade,
        dados.valor_pago_centavos,
        dados.rendimento,
        custoPorUnidade(dados.valor_pago_centavos, dados.rendimento),
        dados.quantidade_estoque,
        dados.estoque_minimo,
        dados.fornecedor,
        dados.especificacao,
        agora,
        agora,
      );
    return buscarInsumoPorId(Number(resultado.lastInsertRowid))!;
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
    throw erro;
  }
}

export function atualizarInsumo(id: number, dados: DadosInsumo): Insumo | null {
  if (!buscarInsumoPorId(id)) return null;
  validarAntesDeGravar(dados, id);

  try {
    getDb()
      .prepare(
        `UPDATE insumos
            SET nome = ?, grupo_id = ?, unidade = ?, valor_pago_centavos = ?, rendimento = ?,
                custo_unitario_centavos = ?, quantidade_estoque = ?, estoque_minimo = ?,
                fornecedor = ?, especificacao = ?, atualizado_em = ?
          WHERE id = ?`,
      )
      .run(
        dados.nome,
        dados.grupo_id,
        dados.unidade,
        dados.valor_pago_centavos,
        dados.rendimento,
        custoPorUnidade(dados.valor_pago_centavos, dados.rendimento),
        dados.quantidade_estoque,
        dados.estoque_minimo,
        dados.fornecedor,
        dados.especificacao,
        new Date().toISOString(),
        id,
      );
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
    throw erro;
  }
  return buscarInsumoPorId(id);
}

/** Exclusão lógica: inativa ou reativa. Não existe DELETE físico de propósito. */
export function definirInsumoAtivo(id: number, ativo: boolean): Insumo | null {
  const resultado = getDb()
    .prepare("UPDATE insumos SET ativo = ?, atualizado_em = ? WHERE id = ?")
    .run(ativo ? 1 : 0, new Date().toISOString(), id);
  return resultado.changes > 0 ? buscarInsumoPorId(id) : null;
}
