import { custoPorUnidade } from "../../dinheiro";
import { getDb, normalizarTexto } from "../connection";
import { ehViolacaoDeUnico, NomeDuplicadoError } from "../erros";

export interface Insumo {
  id: number;
  nome: string;
  valor_pago_centavos: number; // total pago na compra
  quantidade_comprada: number; // quantas unidades vieram nessa compra
  custo_unitario_centavos: number; // valor pago ÷ quantidade comprada
  quantidade_estoque: number; // pode ser negativa
  observacao: string | null;
  ativo: number; // 1 = ativo, 0 = inativo
  criado_em: string;
  atualizado_em: string;
}

export interface DadosInsumo {
  nome: string;
  valor_pago_centavos: number;
  quantidade_comprada: number;
  quantidade_estoque: number;
  observacao: string | null;
}

export interface FiltrosInsumos {
  busca?: string;
  ativo?: 0 | 1;
}

const MENSAGEM_DUPLICADO = "Já existe um insumo com este nome";

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
    condicoes.push("normalizar(nome) LIKE ? ESCAPE '\\'");
    params.push(`%${termo}%`);
  }
  if (filtros.ativo !== undefined) {
    condicoes.push("ativo = ?");
    params.push(filtros.ativo);
  }

  // Só fragmentos fixos entram no SQL; valores do usuário vão sempre por parâmetro
  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const sql = `SELECT * FROM insumos ${where} ORDER BY ativo DESC, nome COLLATE NOCASE`;

  return getDb().prepare(sql).all(...params).map(paraInsumo);
}

export function buscarInsumoPorId(id: number): Insumo | null {
  const linha = getDb().prepare("SELECT * FROM insumos WHERE id = ?").get(id);
  return linha ? paraInsumo(linha) : null;
}

function nomeJaExiste(nome: string, ignorarId = -1): boolean {
  return (
    getDb()
      .prepare("SELECT 1 FROM insumos WHERE normalizar(nome) = ? AND id <> ?")
      .get(normalizarTexto(nome), ignorarId) !== undefined
  );
}

export function criarInsumo(dados: DadosInsumo): Insumo {
  if (nomeJaExiste(dados.nome)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);

  const agora = new Date().toISOString();
  try {
    const resultado = getDb()
      .prepare(
        `INSERT INTO insumos (
           nome, valor_pago_centavos, quantidade_comprada, custo_unitario_centavos,
           quantidade_estoque, observacao, ativo, criado_em, atualizado_em
         ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        dados.nome,
        dados.valor_pago_centavos,
        dados.quantidade_comprada,
        custoPorUnidade(dados.valor_pago_centavos, dados.quantidade_comprada),
        dados.quantidade_estoque,
        dados.observacao,
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
  if (nomeJaExiste(dados.nome, id)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);

  try {
    getDb()
      .prepare(
        `UPDATE insumos
            SET nome = ?, valor_pago_centavos = ?, quantidade_comprada = ?, custo_unitario_centavos = ?,
                quantidade_estoque = ?, observacao = ?, atualizado_em = ?
          WHERE id = ?`,
      )
      .run(
        dados.nome,
        dados.valor_pago_centavos,
        dados.quantidade_comprada,
        custoPorUnidade(dados.valor_pago_centavos, dados.quantidade_comprada),
        dados.quantidade_estoque,
        dados.observacao,
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
