import { getDb, normalizarTexto } from "../connection";
import { ehViolacaoDeUnico, NomeDuplicadoError } from "../erros";

export interface GrupoInsumo {
  id: number;
  nome: string;
  ativo: number; // 1 = ativo, 0 = inativo
  total_insumos: number;
  criado_em: string;
  atualizado_em: string;
}

const MENSAGEM_DUPLICADO = "Já existe um grupo com este nome";

const SELECT_GRUPO = `
  SELECT g.*, (SELECT COUNT(*) FROM insumos i WHERE i.grupo_id = g.id) AS total_insumos
    FROM grupos_insumo g`;

function paraGrupo(linha: unknown): GrupoInsumo {
  return { ...(linha as GrupoInsumo) };
}

export function listarGrupos(filtro: { ativo?: 0 | 1 } = {}): GrupoInsumo[] {
  const db = getDb();
  const linhas =
    filtro.ativo === undefined
      ? db.prepare(`${SELECT_GRUPO} ORDER BY g.nome COLLATE NOCASE`).all()
      : db.prepare(`${SELECT_GRUPO} WHERE g.ativo = ? ORDER BY g.nome COLLATE NOCASE`).all(filtro.ativo);
  return linhas.map(paraGrupo);
}

export function buscarGrupoPorId(id: number): GrupoInsumo | null {
  const linha = getDb().prepare(`${SELECT_GRUPO} WHERE g.id = ?`).get(id);
  return linha ? paraGrupo(linha) : null;
}

export function buscarGrupoPorNome(nome: string): GrupoInsumo | null {
  const linha = getDb().prepare(`${SELECT_GRUPO} WHERE normalizar(g.nome) = ?`).get(normalizarTexto(nome));
  return linha ? paraGrupo(linha) : null;
}

function nomeJaExiste(nome: string, ignorarId = -1): boolean {
  return (
    getDb()
      .prepare("SELECT 1 FROM grupos_insumo WHERE normalizar(nome) = ? AND id <> ?")
      .get(normalizarTexto(nome), ignorarId) !== undefined
  );
}

export function criarGrupo(nome: string): GrupoInsumo {
  if (nomeJaExiste(nome)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);

  const agora = new Date().toISOString();
  try {
    const resultado = getDb()
      .prepare("INSERT INTO grupos_insumo (nome, ativo, criado_em, atualizado_em) VALUES (?, 1, ?, ?)")
      .run(nome, agora, agora);
    return buscarGrupoPorId(Number(resultado.lastInsertRowid))!;
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
    throw erro;
  }
}

export function renomearGrupo(id: number, nome: string): GrupoInsumo | null {
  if (!buscarGrupoPorId(id)) return null;
  if (nomeJaExiste(nome, id)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);

  try {
    getDb()
      .prepare("UPDATE grupos_insumo SET nome = ?, atualizado_em = ? WHERE id = ?")
      .run(nome, new Date().toISOString(), id);
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
    throw erro;
  }
  return buscarGrupoPorId(id);
}

/** Inativa/reativa. Grupo inativo some das opções de novos insumos, mas os insumos existentes continuam nele. */
export function definirGrupoAtivo(id: number, ativo: boolean): GrupoInsumo | null {
  const resultado = getDb()
    .prepare("UPDATE grupos_insumo SET ativo = ?, atualizado_em = ? WHERE id = ?")
    .run(ativo ? 1 : 0, new Date().toISOString(), id);
  return resultado.changes > 0 ? buscarGrupoPorId(id) : null;
}
