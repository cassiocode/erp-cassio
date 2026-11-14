import { getDb } from "../connection";

export interface Material {
  id: number;
  nome: string;
  categoria: string | null;
  unidade: string;
  custo_unitario_centavos: number;
  quantidade_estoque: number;
  estoque_minimo: number;
  ativo: number; // 1 = ativo, 0 = inativo
  criado_em: string;
  atualizado_em: string;
}

export interface DadosMaterial {
  nome: string;
  categoria: string | null;
  unidade: string;
  custo_unitario_centavos: number;
  quantidade_estoque: number;
  estoque_minimo: number;
}

export interface FiltrosMateriais {
  busca?: string;
  categoria?: string;
  ativo?: 0 | 1;
}

export class NomeDuplicadoError extends Error {
  constructor() {
    super("Já existe um material com este nome");
    this.name = "NomeDuplicadoError";
  }
}

// node:sqlite devolve objetos sem protótipo; copiamos para objetos comuns
function paraMaterial(linha: unknown): Material {
  return { ...(linha as Material) };
}

function ehViolacaoDeUnico(erro: unknown): boolean {
  return erro instanceof Error && erro.message.includes("UNIQUE constraint failed");
}

export function listarMateriais(filtros: FiltrosMateriais = {}): Material[] {
  const condicoes: string[] = [];
  const params: (string | number)[] = [];

  if (filtros.busca?.trim()) {
    const termo = filtros.busca.trim().replace(/[\\%_]/g, "\\$&");
    condicoes.push("nome LIKE ? ESCAPE '\\'");
    params.push(`%${termo}%`);
  }
  if (filtros.categoria) {
    condicoes.push("categoria = ? COLLATE NOCASE");
    params.push(filtros.categoria);
  }
  if (filtros.ativo !== undefined) {
    condicoes.push("ativo = ?");
    params.push(filtros.ativo);
  }

  // Só fragmentos fixos entram no SQL; valores do usuário vão sempre por parâmetro
  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const sql = `SELECT * FROM materiais ${where} ORDER BY ativo DESC, nome COLLATE NOCASE`;

  return getDb().prepare(sql).all(...params).map(paraMaterial);
}

export function listarCategorias(): string[] {
  return getDb()
    .prepare(
      "SELECT DISTINCT categoria FROM materiais WHERE categoria IS NOT NULL ORDER BY categoria COLLATE NOCASE",
    )
    .all()
    .map((linha) => String(linha.categoria));
}

export function buscarMaterialPorId(id: number): Material | null {
  const linha = getDb().prepare("SELECT * FROM materiais WHERE id = ?").get(id);
  return linha ? paraMaterial(linha) : null;
}

function nomeJaExiste(nome: string, ignorarId?: number): boolean {
  const linha = getDb()
    .prepare("SELECT id FROM materiais WHERE nome = ? COLLATE NOCASE AND id <> ?")
    .get(nome, ignorarId ?? -1);
  return linha !== undefined;
}

export function criarMaterial(dados: DadosMaterial): Material {
  if (nomeJaExiste(dados.nome)) throw new NomeDuplicadoError();

  const agora = new Date().toISOString();
  try {
    const resultado = getDb()
      .prepare(
        `INSERT INTO materiais
          (nome, categoria, unidade, custo_unitario_centavos, quantidade_estoque, estoque_minimo, ativo, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        dados.nome,
        dados.categoria,
        dados.unidade,
        dados.custo_unitario_centavos,
        dados.quantidade_estoque,
        dados.estoque_minimo,
        agora,
        agora,
      );
    return buscarMaterialPorId(Number(resultado.lastInsertRowid))!;
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError();
    throw erro;
  }
}

export function atualizarMaterial(id: number, dados: DadosMaterial): Material | null {
  if (!buscarMaterialPorId(id)) return null;
  if (nomeJaExiste(dados.nome, id)) throw new NomeDuplicadoError();

  try {
    getDb()
      .prepare(
        `UPDATE materiais
            SET nome = ?, categoria = ?, unidade = ?, custo_unitario_centavos = ?,
                quantidade_estoque = ?, estoque_minimo = ?, atualizado_em = ?
          WHERE id = ?`,
      )
      .run(
        dados.nome,
        dados.categoria,
        dados.unidade,
        dados.custo_unitario_centavos,
        dados.quantidade_estoque,
        dados.estoque_minimo,
        new Date().toISOString(),
        id,
      );
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError();
    throw erro;
  }
  return buscarMaterialPorId(id);
}

/** Exclusão lógica: inativa ou reativa. Não existe DELETE físico de propósito. */
export function definirAtivo(id: number, ativo: boolean): Material | null {
  const resultado = getDb()
    .prepare("UPDATE materiais SET ativo = ?, atualizado_em = ? WHERE id = ?")
    .run(ativo ? 1 : 0, new Date().toISOString(), id);
  return resultado.changes > 0 ? buscarMaterialPorId(id) : null;
}
