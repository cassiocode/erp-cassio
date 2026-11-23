import { normalizarTexto } from "../../texto";
import { getDb, transacao } from "../connection";
import { ehViolacaoDeUnico, NomeDuplicadoError } from "../erros";

/**
 * Kit = o padrão da venda: o que entra a cada caneca vendida (categorias e quantidades) e o preço.
 * Ex.: "Caneca preta" R$ 34,90 = 1 Caneca Cor Preta + 1 Caixa para caneca + 1 Papel de sublimação.
 * As vendas já gravadas guardam os próprios itens e o preço do dia: mudar o kit não muda o passado.
 */
export interface KitCadastro {
  id: number;
  nome: string;
  preco_venda_centavos: number;
  ordem: number;
  ativo: number; // 1 = aparece na nova venda
  itens: { categoria_id: number; categoria_nome: string; quantidade: number }[];
}

export interface DadosKit {
  nome: string;
  preco_venda_centavos: number;
  ativo: boolean;
  itens: { categoria_id: number; quantidade: number }[];
}

/** Categoria do kit que não existe. */
export class CategoriaInvalidaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "CategoriaInvalidaError";
  }
}

const MENSAGEM_DUPLICADO = "Já existe um kit com este nome";

/** Todos os kits (ativos primeiro, na ordem da tela de venda), com as categorias de cada um. */
export function listarKitsCadastro(): KitCadastro[] {
  const db = getDb();
  const itens = db.prepare(
    `SELECT ki.categoria_id, c.nome AS categoria_nome, ki.quantidade
       FROM kit_itens ki JOIN categorias c ON c.id = ki.categoria_id
      WHERE ki.kit_id = ? ORDER BY c.nome COLLATE NOCASE`,
  );
  return db
    .prepare("SELECT id, nome, preco_venda_centavos, ordem, ativo FROM kits ORDER BY ativo DESC, ordem, nome COLLATE NOCASE")
    .all()
    .map((linha) => {
      const kit = { ...(linha as Omit<KitCadastro, "itens">) };
      return { ...kit, itens: itens.all(kit.id).map((i) => ({ ...(i as KitCadastro["itens"][number]) })) };
    });
}

export function buscarKitCadastro(id: number): KitCadastro | null {
  return listarKitsCadastro().find((k) => k.id === id) ?? null;
}

/** Junta categorias repetidas somando as quantidades. */
function juntar(itens: DadosKit["itens"]): DadosKit["itens"] {
  const porCategoria = new Map<number, number>();
  for (const { categoria_id, quantidade } of itens) {
    porCategoria.set(categoria_id, (porCategoria.get(categoria_id) ?? 0) + quantidade);
  }
  return [...porCategoria].map(([categoria_id, quantidade]) => ({ categoria_id, quantidade }));
}

/** Cria (id = null) ou altera o kit e troca as categorias dele. Null se o kit não existe. */
export function salvarKit(id: number | null, dados: DadosKit): KitCadastro | null {
  const db = getDb();
  if (id !== null && !db.prepare("SELECT 1 FROM kits WHERE id = ?").get(id)) return null;
  const duplicado = db
    .prepare("SELECT 1 FROM kits WHERE normalizar(nome) = ? AND id <> ?")
    .get(normalizarTexto(dados.nome), id ?? -1);
  if (duplicado) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);

  const itens = juntar(dados.itens);
  const existeCategoria = db.prepare("SELECT 1 FROM categorias WHERE id = ?");
  for (const item of itens) {
    if (!existeCategoria.get(item.categoria_id)) throw new CategoriaInvalidaError("Categoria não encontrada");
  }

  try {
    const kitId = transacao(() => {
      let kId: number;
      if (id !== null) {
        db.prepare("UPDATE kits SET nome = ?, preco_venda_centavos = ?, ativo = ? WHERE id = ?").run(
          dados.nome,
          dados.preco_venda_centavos,
          dados.ativo ? 1 : 0,
          id,
        );
        db.prepare("DELETE FROM kit_itens WHERE kit_id = ?").run(id);
        kId = id;
      } else {
        const ordem = Number(db.prepare("SELECT COALESCE(MAX(ordem), 0) + 1 AS n FROM kits").get()?.n);
        const r = db
          .prepare("INSERT INTO kits (nome, preco_venda_centavos, ordem, ativo) VALUES (?, ?, ?, ?)")
          .run(dados.nome, dados.preco_venda_centavos, ordem, dados.ativo ? 1 : 0);
        kId = Number(r.lastInsertRowid);
      }
      const inserir = db.prepare("INSERT INTO kit_itens (kit_id, categoria_id, quantidade) VALUES (?, ?, ?)");
      for (const item of itens) inserir.run(kId, item.categoria_id, item.quantidade);
      return kId;
    });
    return buscarKitCadastro(kitId);
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) throw new NomeDuplicadoError(MENSAGEM_DUPLICADO);
    throw erro;
  }
}
