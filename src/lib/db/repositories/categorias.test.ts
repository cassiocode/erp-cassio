import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../connection";
import { NomeDuplicadoError } from "../erros";
import {
  buscarCategoria,
  criarCategoria,
  definirCategoriaAtiva,
  listarCategorias,
  renomearCategoria,
} from "./categorias";
import { atualizarInsumo, criarInsumo, definirInsumoAtivo, listarInsumos } from "./insumos";

let preta: number;

function insumo(nome: string, quantidade: number, categoria_id: number) {
  return criarInsumo({ nome, valor_pago_centavos: 1000, quantidade_comprada: quantidade, data_compra: "2026-11-01", observacao: null, categoria_id });
}

beforeEach(() => {
  getDb().exec(
    "DELETE FROM baixas; DELETE FROM venda_itens; DELETE FROM venda_kits; DELETE FROM vendas; DELETE FROM kit_itens; DELETE FROM compras_insumo; DELETE FROM insumos; DELETE FROM categorias;",
  );
  preta = criarCategoria("Caneca Cor Preta c/ Tarja Branca").id;
});

describe("categorias", () => {
  it("soma o estoque e conta os insumos ativos da categoria", () => {
    insumo("Caneca Preta 325 - Top", 6, preta);
    const trix = insumo("Caneca Preta 325 - Trix", 12, preta);
    expect(buscarCategoria(preta)).toMatchObject({ quantidade_insumos: 2, estoque_total: 18 });
    definirInsumoAtivo(trix.id, false);
    expect(buscarCategoria(preta)).toMatchObject({ quantidade_insumos: 1, estoque_total: 6 });
  });

  it("não deixa repetir nome (sem diferenciar maiúsculas nem acentos)", () => {
    expect(() => criarCategoria("caneca cor preta c/ tarja branca")).toThrow(NomeDuplicadoError);
    criarCategoria("Laço");
    expect(() => criarCategoria("LACO")).toThrow(NomeDuplicadoError);
    expect(() => renomearCategoria(preta, "laco")).toThrow(NomeDuplicadoError);
    expect(renomearCategoria(preta, "CANECA COR PRETA C/ TARJA BRANCA")?.nome).toBe("CANECA COR PRETA C/ TARJA BRANCA"); // a própria pode
  });

  it("renomeia e inativa; inativas vão para o fim da lista", () => {
    const branca = criarCategoria("Caneca branca").id;
    expect(renomearCategoria(branca, "Caneca cor branca")?.nome).toBe("Caneca cor branca");
    definirCategoriaAtiva(branca, false);
    expect(listarCategorias().map((c) => [c.nome, c.ativo])).toEqual([
      ["Caneca Cor Preta c/ Tarja Branca", 1],
      ["Caneca cor branca", 0],
    ]);
    expect(listarCategorias({ ativo: 1 }).map((c) => c.nome)).toEqual(["Caneca Cor Preta c/ Tarja Branca"]);
    expect(renomearCategoria(9999, "x")).toBeNull();
  });

  it("insumo guarda a categoria, filtra por ela e pode trocar de categoria", () => {
    const outra = criarCategoria("Caneca mágica").id;
    const top = insumo("Caneca Preta 325 - Top", 6, preta);
    expect(top).toMatchObject({ categoria_id: preta, categoria_nome: "Caneca Cor Preta c/ Tarja Branca" });
    expect(listarInsumos({ categoria_id: preta }).map((i) => i.nome)).toEqual(["Caneca Preta 325 - Top"]);
    expect(listarInsumos({ categoria_id: outra })).toEqual([]);

    // Edição sem categoria mantém a atual; com categoria, troca
    expect(atualizarInsumo(top.id, { nome: top.nome, quantidade_estoque: 6, observacao: null })?.categoria_id).toBe(preta);
    expect(atualizarInsumo(top.id, { nome: top.nome, quantidade_estoque: 6, observacao: null, categoria_id: outra })?.categoria_nome).toBe(
      "Caneca mágica",
    );
  });
});
