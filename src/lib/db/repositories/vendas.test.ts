import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../connection";
import { registrarCompra } from "./compras";
import { buscarInsumoPorId, criarInsumo } from "./insumos";
import { apagarVenda, buscarVenda, ItemInvalidoError, listarKits, listarVendas, registrarVenda, type DadosVenda } from "./vendas";

// DB_PATH=":memory:": banco vazio com migrations. Os kits padrão existem, mas sem itens (não havia insumos).

let branca: number;
let preta: number;
let caixa: number;
let laco: number;
let kitBranca: number;
let kitPreta: number;

function insumo(nome: string, totalCentavos: number, quantidade: number): number {
  return criarInsumo({ nome, valor_pago_centavos: totalCentavos, quantidade_comprada: quantidade, data_compra: "2026-11-01", observacao: null }).id;
}

function venda(extra: Partial<DadosVenda> = {}): DadosVenda {
  return {
    data_venda: "2026-11-14",
    kit_id: kitBranca,
    cliente: "Maria",
    preco_venda_centavos: 2990,
    custo_energia_centavos: 0, // sem energia, para as contas abaixo ficarem só nos insumos
    observacao: null,
    itens: [
      { insumo_id: branca, quantidade: 1 },
      { insumo_id: caixa, quantidade: 1 },
    ],
    ...extra,
  };
}

beforeEach(() => {
  const db = getDb();
  db.exec("DELETE FROM venda_itens; DELETE FROM vendas; DELETE FROM kit_itens; DELETE FROM compras_insumo; DELETE FROM insumos;");
  branca = insumo("Caneca branca 325ml", 12600, 12); // R$ 10,50
  preta = insumo("Caneca preta 325ml", 20400, 12); // R$ 17,00
  caixa = insumo("Caixa para caneca de porcelana 325ml", 10000, 50); // R$ 2,00
  laco = insumo("Laço azul", 290, 10); // R$ 0,29

  kitBranca = Number(db.prepare("SELECT id FROM kits WHERE nome = 'Caneca branca'").get()?.id);
  kitPreta = Number(db.prepare("SELECT id FROM kits WHERE nome = 'Caneca preta'").get()?.id);
  const ligar = db.prepare("INSERT INTO kit_itens (kit_id, insumo_id) VALUES (?, ?)");
  ligar.run(kitBranca, branca);
  ligar.run(kitBranca, caixa);
  ligar.run(kitPreta, preta);
  ligar.run(kitPreta, caixa);
});

describe("kits", () => {
  it("caneca branca R$ 29,90 e caneca preta R$ 34,90, cada uma com a caixa", () => {
    expect(listarKits().map((k) => ({ nome: k.nome, preco: k.preco_venda_centavos, itens: k.itens.map((i) => i.nome) }))).toEqual([
      { nome: "Caneca branca", preco: 2990, itens: ["Caixa para caneca de porcelana 325ml", "Caneca branca 325ml"] },
      { nome: "Caneca preta", preco: 3490, itens: ["Caixa para caneca de porcelana 325ml", "Caneca preta 325ml"] },
    ]);
  });
});

describe("vendas", () => {
  it("registra com custo dos insumos e lucro", () => {
    const v = registrarVenda(venda());
    expect(v.kit_nome).toBe("Caneca branca");
    expect(v.custo_total_centavos).toBe(1250); // 10,50 + 2,00
    expect(v.lucro_centavos).toBe(1740); // 29,90 - 12,50
    expect(v.itens.map((i) => [i.nome, i.quantidade, i.custo_unitario_centavos])).toEqual([
      ["Caneca branca 325ml", 1, 1050],
      ["Caixa para caneca de porcelana 325ml", 1, 200],
    ]);
  });

  it("custo de energia entra no custo total e no lucro", () => {
    const v = registrarVenda(venda({ custo_energia_centavos: 50 }));
    expect(v.custo_energia_centavos).toBe(50);
    expect(v.custo_total_centavos).toBe(1300); // 10,50 + 2,00 + 0,50
    expect(v.lucro_centavos).toBe(1690);
  });

  it("tira os insumos do estoque, incluindo os extras adicionados à mão", () => {
    registrarVenda(venda({ itens: [...venda().itens, { insumo_id: laco, quantidade: 2 }] }));
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(11);
    expect(buscarInsumoPorId(caixa)?.quantidade_estoque).toBe(49);
    expect(buscarInsumoPorId(laco)?.quantidade_estoque).toBe(8);
  });

  it("junta itens repetidos do mesmo insumo", () => {
    const v = registrarVenda(venda({ itens: [{ insumo_id: laco, quantidade: 1 }, { insumo_id: laco, quantidade: 2 }] }));
    expect(v.itens).toHaveLength(1);
    expect(v.itens[0].quantidade).toBe(3);
  });

  it("preço editado abaixo do custo mostra prejuízo", () => {
    expect(registrarVenda(venda({ kit_id: kitPreta, preco_venda_centavos: 1000, itens: [{ insumo_id: preta, quantidade: 1 }] })).lucro_centavos).toBe(-700);
  });

  it("guarda o custo do dia: compra nova depois não muda o lucro da venda", () => {
    const { id } = registrarVenda(venda());
    registrarCompra(branca, { data_compra: "2026-11-20", quantidade: 12, valor_pago_centavos: 24000, observacao: null });
    expect(buscarVenda(id)?.custo_total_centavos).toBe(1250);
  });

  it("estoque pode ficar negativo", () => {
    registrarVenda(venda({ itens: [{ insumo_id: laco, quantidade: 15 }] }));
    expect(buscarInsumoPorId(laco)?.quantidade_estoque).toBe(-5);
  });

  it("venda sem kit (só insumos avulsos)", () => {
    expect(registrarVenda(venda({ kit_id: null })).kit_nome).toBeNull();
  });

  it("recusa insumo ou kit inexistente sem gravar nada", () => {
    expect(() => registrarVenda(venda({ itens: [{ insumo_id: 9999, quantidade: 1 }] }))).toThrow(ItemInvalidoError);
    expect(() => registrarVenda(venda({ kit_id: 9999 }))).toThrow(ItemInvalidoError);
    expect(listarVendas()).toHaveLength(0);
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(12);
  });

  it("lista as mais recentes primeiro", () => {
    registrarVenda(venda({ data_venda: "2026-11-10", cliente: "Ana" }));
    registrarVenda(venda({ data_venda: "2026-11-12", cliente: "Bia" }));
    expect(listarVendas().map((v) => v.cliente)).toEqual(["Bia", "Ana"]);
  });

  it("apagar a venda devolve os insumos ao estoque", () => {
    const { id } = registrarVenda(venda({ itens: [...venda().itens, { insumo_id: laco, quantidade: 2 }] }));
    expect(apagarVenda(id)).toBe(true);
    expect(buscarVenda(id)).toBeNull();
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(12);
    expect(buscarInsumoPorId(laco)?.quantidade_estoque).toBe(10);
    expect(apagarVenda(id)).toBe(false);
  });
});
