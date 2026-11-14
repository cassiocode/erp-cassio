import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../connection";
import { registrarCompra } from "./compras";
import { buscarInsumoPorId, criarInsumo } from "./insumos";
import {
  apagarVenda,
  buscarVenda,
  calcularFaltas,
  concluirVenda,
  faltasAoSalvar,
  faltasAoTirar,
  ItemInvalidoError,
  listarKits,
  listarVendas,
  registrarVenda,
  salvarVenda,
  StatusInvalidoError,
  type DadosVenda,
} from "./vendas";

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
    status: "concluida",
    data_venda: "2026-11-14",
    data_prevista: null,
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

  it("concluídas: as mais recentes primeiro", () => {
    registrarVenda(venda({ data_venda: "2026-11-10", cliente: "Ana" }));
    registrarVenda(venda({ data_venda: "2026-11-12", cliente: "Bia" }));
    expect(listarVendas().map((v) => v.cliente)).toEqual(["Bia", "Ana"]);
  });

  it("venda concluída não pode ser apagada nem alterada (não volta para o estoque)", () => {
    const { id } = registrarVenda(venda());
    expect(() => apagarVenda(id)).toThrow(StatusInvalidoError);
    expect(() => salvarVenda(id, venda({ preco_venda_centavos: 1 }))).toThrow(StatusInvalidoError);
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(11);
    expect(apagarVenda(9999)).toBe(false);
  });
});

describe("rascunho e pré-venda", () => {
  const pre = (extra: Partial<DadosVenda> = {}) => venda({ status: "pre_venda", data_prevista: "2026-11-20", ...extra });

  it("rascunho não mexe no estoque; apagar rascunho também não", () => {
    const { id } = registrarVenda(venda({ status: "rascunho" }));
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(12);
    expect(apagarVenda(id)).toBe(true);
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(12);
  });

  it("pré-venda tira do estoque; cancelar devolve", () => {
    const { id } = registrarVenda(pre());
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(11);
    expect(apagarVenda(id)).toBe(true);
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(12);
  });

  it("concluir pré-venda não baixa de novo e muda a data da venda", () => {
    const { id } = registrarVenda(pre());
    const v = concluirVenda(id, "2026-11-21")!;
    expect(v.status).toBe("concluida");
    expect(v.data_venda).toBe("2026-11-21");
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(11);
    expect(() => concluirVenda(id, "2026-11-22")).toThrow(StatusInvalidoError);
  });

  it("concluir rascunho tira do estoque agora", () => {
    const { id } = registrarVenda(venda({ status: "rascunho" }));
    concluirVenda(id, "2026-11-21");
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(11);
  });

  it("editar pré-venda ajusta o estoque pela diferença", () => {
    const { id } = registrarVenda(pre({ itens: [{ insumo_id: laco, quantidade: 2 }] }));
    expect(buscarInsumoPorId(laco)?.quantidade_estoque).toBe(8);
    salvarVenda(id, pre({ itens: [{ insumo_id: laco, quantidade: 5 }, { insumo_id: caixa, quantidade: 1 }] }));
    expect(buscarInsumoPorId(laco)?.quantidade_estoque).toBe(5);
    expect(buscarInsumoPorId(caixa)?.quantidade_estoque).toBe(49);
    salvarVenda(id, pre({ status: "rascunho", itens: [{ insumo_id: laco, quantidade: 5 }] })); // volta a rascunho
    expect(buscarInsumoPorId(laco)?.quantidade_estoque).toBe(10);
    expect(buscarInsumoPorId(caixa)?.quantidade_estoque).toBe(50);
  });

  it("lista: pré-vendas primeiro pela entrega mais próxima, depois rascunhos, depois concluídas", () => {
    registrarVenda(venda({ cliente: "Concluída" }));
    registrarVenda(venda({ status: "rascunho", cliente: "Rascunho", data_prevista: "2026-11-15" }));
    registrarVenda(pre({ cliente: "Dia 18", data_prevista: "2026-11-18" }));
    registrarVenda(pre({ cliente: "Dia 15", data_prevista: "2026-11-15" }));
    registrarVenda(pre({ cliente: "Dia 17", data_prevista: "2026-11-17" }));
    expect(listarVendas().map((v) => v.cliente)).toEqual(["Dia 15", "Dia 17", "Dia 18", "Rascunho", "Concluída"]);
    expect(listarVendas({ status: "pre_venda" })).toHaveLength(3);
  });
});

describe("faltas de material", () => {
  const pre = (cliente: string, data: string, qtd: number) =>
    registrarVenda(
      venda({ status: "pre_venda", cliente, data_prevista: data, itens: [{ insumo_id: laco, quantidade: qtd }] }),
    ).id;

  it("sem estoque negativo, sem faltas", () => {
    pre("Ana", "2026-11-15", 3);
    expect(calcularFaltas()).toEqual([]);
  });

  it("baixa que deixa o estoque negativo avisa a pré-venda de entrega mais distante", () => {
    pre("Ana", "2026-11-15", 4); // laço: 10 -> 6
    const bia = pre("Bia", "2026-11-18", 4); // 6 -> 2
    expect(faltasAoTirar(laco, 3)).toEqual([
      { venda_id: bia, cliente: "Bia", data_prevista: "2026-11-18", insumo_id: laco, insumo_nome: "Laço azul", falta: 1 },
    ]);
    // Quebrar 7: falta 5 -> 4 da Bia (entrega depois) e 1 da Ana
    expect(faltasAoTirar(laco, 7).map((f) => [f.cliente, f.falta])).toEqual([
      ["Bia", 4],
      ["Ana", 1],
    ]);
  });

  it("nova pré-venda com entrega mais próxima passa na frente", () => {
    pre("Bia", "2026-11-18", 10); // laço: 10 -> 0
    const faltas = faltasAoSalvar(null, {
      status: "pre_venda",
      data_prevista: "2026-11-15",
      cliente: "Ana",
      itens: [{ insumo_id: laco, quantidade: 2 }],
    });
    expect(faltas.map((f) => [f.cliente, f.falta])).toEqual([["Bia", 2]]);
  });

  it("rascunho não causa falta", () => {
    pre("Bia", "2026-11-18", 10);
    expect(faltasAoSalvar(null, { status: "rascunho", data_prevista: null, cliente: null, itens: [{ insumo_id: laco, quantidade: 5 }] })).toEqual([]);
  });

  it("estoque já negativo aparece nas faltas da pré-venda", () => {
    const bia = pre("Bia", "2026-11-18", 12); // laço: 10 -> -2
    expect(calcularFaltas().map((f) => [f.venda_id, f.falta])).toEqual([[bia, 2]]);
  });
});
