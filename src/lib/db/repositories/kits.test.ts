import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../connection";
import { NomeDuplicadoError } from "../erros";
import { criarCategoria } from "./categorias";
import { CategoriaInvalidaError, listarKitsCadastro, salvarKit } from "./kits";
import { listarKits } from "./vendas";

let caneca: number;
let caixa: number;
let papel: number;
let kitPreta: number;

beforeEach(() => {
  const db = getDb();
  db.exec(
    "DELETE FROM venda_itens; DELETE FROM venda_kits; DELETE FROM vendas; DELETE FROM kit_itens; DELETE FROM kits; DELETE FROM compras_insumo; DELETE FROM insumos; DELETE FROM categorias;",
  );
  caneca = criarCategoria("Caneca Cor Preta c/ Tarja Branca").id;
  caixa = criarCategoria("Caixa para caneca").id;
  papel = criarCategoria("Papel de sublimação").id;
  kitPreta = salvarKit(null, {
    nome: "Caneca preta",
    preco_venda_centavos: 3490,
    ativo: true,
    itens: [
      { categoria_id: caneca, quantidade: 1 },
      { categoria_id: caixa, quantidade: 1 },
    ],
  })!.id;
});

describe("padrão da venda (kits)", () => {
  it("cria kit com categorias e ele aparece na nova venda", () => {
    expect(listarKits().map((k) => [k.nome, k.preco_venda_centavos, k.itens.map((i) => `${i.quantidade}× ${i.nome}`)])).toEqual([
      ["Caneca preta", 3490, ["1× Caixa para caneca", "1× Caneca Cor Preta c/ Tarja Branca"]],
    ]);
  });

  it("altera preço e categorias (junta categoria repetida)", () => {
    const kit = salvarKit(kitPreta, {
      nome: "Caneca preta",
      preco_venda_centavos: 3990,
      ativo: true,
      itens: [
        { categoria_id: caneca, quantidade: 1 },
        { categoria_id: papel, quantidade: 1 },
        { categoria_id: papel, quantidade: 1 },
      ],
    })!;
    expect(kit.preco_venda_centavos).toBe(3990);
    expect(kit.itens.map((i) => [i.categoria_nome, i.quantidade])).toEqual([
      ["Caneca Cor Preta c/ Tarja Branca", 1],
      ["Papel de sublimação", 2],
    ]);
  });

  it("kit fora da venda não aparece na nova venda, mas continua no cadastro", () => {
    salvarKit(kitPreta, { nome: "Caneca preta", preco_venda_centavos: 3490, ativo: false, itens: [{ categoria_id: caneca, quantidade: 1 }] });
    expect(listarKits()).toEqual([]);
    expect(listarKitsCadastro().map((k) => [k.nome, k.ativo])).toEqual([["Caneca preta", 0]]);
  });

  it("novo kit vai para o fim da lista", () => {
    salvarKit(null, { nome: "Caneca mágica", preco_venda_centavos: 4990, ativo: true, itens: [{ categoria_id: caixa, quantidade: 1 }] });
    expect(listarKits().map((k) => k.nome)).toEqual(["Caneca preta", "Caneca mágica"]);
  });

  it("recusa nome repetido (sem diferenciar maiúsculas) e categoria inexistente", () => {
    const dados = { preco_venda_centavos: 100, ativo: true, itens: [{ categoria_id: caneca, quantidade: 1 }] };
    expect(() => salvarKit(null, { ...dados, nome: "CANECA PRETA" })).toThrow(NomeDuplicadoError);
    expect(() => salvarKit(null, { ...dados, nome: "Outro", itens: [{ categoria_id: 9999, quantidade: 1 }] })).toThrow(CategoriaInvalidaError);
    expect(salvarKit(9999, { ...dados, nome: "X" })).toBeNull();
  });
});
