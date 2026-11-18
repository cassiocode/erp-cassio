import { normalizarTexto } from "../../texto";
import { getDb } from "../connection";
import { ehViolacaoDeUnico, NomeDuplicadoError } from "../erros";

/**
 * Categoria = o tipo do material, independente do fornecedor. Ex.: "Caneca Cor Preta c/ Tarja Branca"
 * junta a caneca preta Top e a Trix. Kits e alertas de falta olham a categoria (estoque somado).
 */
export interface Categoria {
  id: number;
  nome: string;
  ativo: number; // 1 = ativa
  criado_em: string;
  atualizado_em: string;
  // Calculados a partir dos insumos ativos da categoria
  quantidade_insumos: number;
  estoque_total: number;
}

const MENSAGEM_DUPLICADO = "Já existe uma categoria com este nome";

const SELECT_CATEGORIA = `
  SELECT c.*,
         COUNT(i.id) AS quantidade_insumos,
         COALESCE(SUM(i.quantidade_estoque), 0) AS estoque_total
    FROM categorias c
    LEFT JOIN insumos i ON i.categoria_id = c.id AND i.ativo = 1`;

const paraCategoria = (linha: unknown): Categoria => ({ ...(linha as Categoria) });

export function listarCategorias(filtro: { ativo?: 0 | 1 } = {}): Categoria[] {
  const where = filtro.ativo === undefined ? "" : "WHERE c.ativo = ?";
  const params = filtro.ativo === undefined ? [] : [filtro.ativo];
  return getDb()
    .prepare(`${SELECT_CATEGORIA} ${where} GROUP BY c.id ORDER BY c.ativo DESC, c.nome COLLATE NOCASE`)
    .all(...params)
    .map(paraCategoria);
}

export function buscarCategoria(id: number): Categoria | null {
  const linha = getDb().prepare(`${SELECT_CATEGORIA} WHERE c.id = ? GROUP BY c.id`).get(id);
  return linha ? paraCategoria(linha) : null;
}

function nomeJaExiste(nome: string, ignorarId = -1): boolean {
  return (
    getDb()
      .prepare("SELECT 1 FROM categorias WHERE normalizar(nome) = ? AND id <> ?")
      .get(normalizarTexto(nome), ignorarId) !== undefined
  );
}

export function criarCategoria(nome: string): Categoria {
  if (nomeJaExiste(nome)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
  const agora = new Date().toISOString();
  try {
    const r = getDb()
      .prepare("INSERT INTO categorias (nome, ativo, criado_em, atualizado_em) VALUES (?, 1, ?, ?)")
      .run(nome, agora, agora);
    return buscarCategoria(Number(r.lastInsertRowid))!;
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
    throw erro;
  }
}

export function renomearCategoria(id: number, nome: string): Categoria | null {
  if (!buscarCategoria(id)) return null;
  if (nomeJaExiste(nome, id)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
  try {
    getDb().prepare("UPDATE categorias SET nome = ?, atualizado_em = ? WHERE id = ?").run(nome, new Date().toISOString(), id);
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
    throw erro;
  }
  return buscarCategoria(id);
}

/** Inativa (some do cadastro de insumo novo) ou reativa. Os insumos dela continuam nela. */
export function definirCategoriaAtiva(id: number, ativo: boolean): Categoria | null {
  const r = getDb()
    .prepare("UPDATE categorias SET ativo = ?, atualizado_em = ? WHERE id = ?")
    .run(ativo ? 1 : 0, new Date().toISOString(), id);
  return r.changes > 0 ? buscarCategoria(id) : null;
}
