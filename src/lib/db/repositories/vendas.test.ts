import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../connection";
import { criarCategoria } from "./categorias";
import { registrarCompra } from "./compras";
import { buscarInsumoPorId, criarInsumo } from "./insumos";
import {
  alterarDataPrevista,
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

// DB_PATH=":memory:": banco vazio com migrations. Os kits padrão existem; os itens deles (categorias) são
// montados aqui.

let branca: number;
let preta: number;
let caixa: number;
let laco: number;
let kitBranca: number;
let kitPreta: number;
let catBranca: number;
let catPreta: number;
let catCaixa: number;
let catLaco: number;

function insumo(nome: string, totalCentavos: number, quantidade: number, categoria_id: number): number {
  return criarInsumo({
    nome,
    valor_pago_centavos: totalCentavos,
    quantidade_comprada: quantidade,
    data_compra: "2026-11-01",
    observacao: null,
    categoria_id,
  }).id;
}

function venda(extra: Partial<DadosVenda> = {}): DadosVenda {
  return {
    status: "concluida",
    data_venda: "2026-11-14",
    data_prevista: null,
    kits: [{ kit_id: kitBranca, quantidade: 1 }],
    desconto_percentual: 0,
    valor_pago_centavos: 0,
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
  db.exec(
    "DELETE FROM venda_itens; DELETE FROM venda_kits; DELETE FROM vendas; DELETE FROM kit_itens; DELETE FROM compras_insumo; DELETE FROM insumos; DELETE FROM categorias;",
  );
  catBranca = criarCategoria("Caneca cor branca").id;
  catPreta = criarCategoria("Caneca Cor Preta c/ Tarja Branca").id;
  catCaixa = criarCategoria("Caixa para caneca").id;
  catLaco = criarCategoria("Laço").id;
  branca = insumo("Caneca branca 325ml", 12600, 12, catBranca); // R$ 10,50
  preta = insumo("Caneca preta 325ml", 20400, 12, catPreta); // R$ 17,00
  caixa = insumo("Caixa para caneca de porcelana 325ml", 10000, 50, catCaixa); // R$ 2,00
  laco = insumo("Laço azul", 290, 10, catLaco); // R$ 0,29

  kitBranca = Number(db.prepare("SELECT id FROM kits WHERE nome = 'Caneca branca'").get()?.id);
  kitPreta = Number(db.prepare("SELECT id FROM kits WHERE nome = 'Caneca preta'").get()?.id);
  const ligar = db.prepare("INSERT INTO kit_itens (kit_id, categoria_id) VALUES (?, ?)");
  ligar.run(kitBranca, catBranca);
  ligar.run(kitBranca, catCaixa);
  ligar.run(kitPreta, catPreta);
  ligar.run(kitPreta, catCaixa);
});

describe("kits", () => {
  it("caneca branca R$ 29,90 e caneca preta R$ 34,90, cada uma com a caixa (por categoria)", () => {
    expect(listarKits().map((k) => ({ nome: k.nome, preco: k.preco_venda_centavos, itens: k.itens.map((i) => i.nome) }))).toEqual([
      { nome: "Caneca branca", preco: 2990, itens: ["Caixa para caneca", "Caneca cor branca"] },
      { nome: "Caneca preta", preco: 3490, itens: ["Caixa para caneca", "Caneca Cor Preta c/ Tarja Branca"] },
    ]);
  });
});

describe("vendas", () => {
  it("registra com custo dos insumos e lucro", () => {
    const v = registrarVenda(venda());
    expect(v.kits_resumo).toBe("1× Caneca branca");
    expect(v.quantidade_canecas).toBe(1);
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
    expect(registrarVenda(venda({ kits: [{ kit_id: kitPreta, quantidade: 1 }], preco_venda_centavos: 1000, itens: [{ insumo_id: preta, quantidade: 1 }] })).lucro_centavos).toBe(-700);
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
    expect(registrarVenda(venda({ kits: [] })).kits_resumo).toBeNull();
  });

  it("recusa insumo ou kit inexistente sem gravar nada", () => {
    expect(() => registrarVenda(venda({ itens: [{ insumo_id: 9999, quantidade: 1 }] }))).toThrow(ItemInvalidoError);
    expect(() => registrarVenda(venda({ kits: [{ kit_id: 9999, quantidade: 1 }] }))).toThrow(ItemInvalidoError);
    expect(listarVendas()).toHaveLength(0);
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(12);
  });

  it("concluídas: as mais recentes primeiro", () => {
    registrarVenda(venda({ data_venda: "2026-11-10", cliente: "Ana" }));
    registrarVenda(venda({ data_venda: "2026-11-12", cliente: "Bia" }));
    expect(listarVendas().map((v) => v.cliente)).toEqual(["Bia", "Ana"]);
  });

  it("venda concluída pode ser editada: o estoque acompanha a diferença", () => {
    const { id } = registrarVenda(venda()); // branca: 12 -> 11
    salvarVenda(id, venda({ preco_venda_centavos: 2500, itens: [{ insumo_id: branca, quantidade: 3 }] }));
    expect(buscarVenda(id)?.preco_venda_centavos).toBe(2500);
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(9);
    expect(buscarInsumoPorId(caixa)?.quantidade_estoque).toBe(50); // saiu da venda: voltou
  });

  it("venda concluída lançada errado pode voltar a pré-venda (estoque não muda)", () => {
    const { id } = registrarVenda(venda());
    salvarVenda(id, venda({ status: "pre_venda", data_prevista: "2026-11-20" }));
    expect(buscarVenda(id)?.status).toBe("pre_venda");
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(11);
  });

  it("cancelar venda concluída devolve os insumos ao estoque", () => {
    const { id } = registrarVenda(venda({ itens: [...venda().itens, { insumo_id: laco, quantidade: 2 }] }));
    expect(apagarVenda(id)).toBe(true);
    expect(buscarVenda(id)).toBeNull();
    expect(buscarInsumoPorId(branca)?.quantidade_estoque).toBe(12);
    expect(buscarInsumoPorId(laco)?.quantidade_estoque).toBe(10);
    expect(apagarVenda(9999)).toBe(false);
  });
});

describe("kits com quantidade e desconto", () => {
  it("2 brancas + 2 pretas com 5%: grava kits, canecas e o desconto sobre os kits", () => {
    const v = registrarVenda(
      venda({
        kits: [
          { kit_id: kitBranca, quantidade: 2 },
          { kit_id: kitPreta, quantidade: 2 },
        ],
        desconto_percentual: 5,
        preco_venda_centavos: 12312, // (2×29,90 + 2×34,90 = 129,60) × 0,95
      }),
    );
    expect(v.kits_resumo).toBe("2× Caneca branca, 2× Caneca preta");
    expect(v.quantidade_canecas).toBe(4);
    expect(v.desconto_percentual).toBe(5);
    expect(v.desconto_centavos).toBe(648); // 5% de R$ 129,60 = R$ 6,48
  });

  it("concluir pré-venda mantém kits e desconto", () => {
    const { id } = registrarVenda(
      venda({ status: "pre_venda", data_prevista: "2026-11-20", kits: [{ kit_id: kitPreta, quantidade: 6 }], desconto_percentual: 10 }),
    );
    const v = concluirVenda(id, "2026-11-20")!;
    expect(v.kits).toEqual([{ kit_id: kitPreta, nome: "Caneca preta", quantidade: 6, preco_unitario_centavos: 3490 }]);
    expect(v.desconto_centavos).toBe(2094); // 10% de 6 × 34,90 = 209,40 → 20,94
  });

  it("pré-venda guarda o valor já pago e mantém ao concluir", () => {
    const { id, valor_pago_centavos } = registrarVenda(
      venda({ status: "pre_venda", data_prevista: "2026-11-20", valor_pago_centavos: 1000 }),
    );
    expect(valor_pago_centavos).toBe(1000);
    expect(concluirVenda(id, "2026-11-20")?.valor_pago_centavos).toBe(1000);
  });

  it("apagar rascunho apaga os kits dele", () => {
    const { id } = registrarVenda(venda({ status: "rascunho", kits: [{ kit_id: kitBranca, quantidade: 3 }] }));
    expect(apagarVenda(id)).toBe(true);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM venda_kits WHERE venda_id = ?").get(id)?.n).toBe(0);
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
      { venda_id: bia, cliente: "Bia", data_prevista: "2026-11-18", material: catLaco, material_nome: "Laço", falta: 1 },
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

  it("venda entregue agora (ou baixa pela API de alertas) pega o material: a falta cai na pré-venda", () => {
    const bia = pre("Bia", "2026-11-18", 9); // laço: 10 -> 1
    const faltas = faltasAoSalvar(null, { status: "concluida", data_prevista: null, cliente: null, itens: [{ insumo_id: laco, quantidade: 3 }] });
    expect(faltas.map((f) => [f.venda_id, f.falta])).toEqual([[bia, 2]]);
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

describe("faltas por categoria", () => {
  let trix: number;
  beforeEach(() => {
    // Segunda caneca preta (outro fornecedor), mesma categoria
    trix = insumo("Caneca preta 325ml - Trix", 6000, 3, catPreta); // estoque 3
    getDb().prepare("UPDATE insumos SET quantidade_estoque = 0 WHERE id = ?").run(preta); // Top acabou
  });

  const prePreta = (cliente: string, data: string, insumoId: number, qtd: number) =>
    registrarVenda(
      venda({
        status: "pre_venda",
        cliente,
        data_prevista: data,
        kits: [{ kit_id: kitPreta, quantidade: qtd }],
        itens: [{ insumo_id: insumoId, quantidade: qtd }],
      }),
    ).id;

  it("Top zerada mas Trix com estoque: não falta caneca preta", () => {
    prePreta("Ana", "2026-11-20", preta, 2); // Top: 0 -> -2, Trix 3: categoria = 1
    expect(calcularFaltas()).toEqual([]);
    expect(faltasAoTirar(trix, 1)).toEqual([]); // categoria 1 -> 0
  });

  it("quando a categoria toda acaba, a falta aparece com o nome da categoria", () => {
    const ana = prePreta("Ana", "2026-11-20", preta, 2); // categoria: 3 - 2 = 1
    expect(faltasAoTirar(trix, 3)).toEqual([
      { venda_id: ana, cliente: "Ana", data_prevista: "2026-11-20", material: catPreta, material_nome: "Caneca Cor Preta c/ Tarja Branca", falta: 2 },
    ]);
  });

  it("nova venda de outra caneca da mesma categoria avisa a pré-venda", () => {
    const ana = prePreta("Ana", "2026-11-20", trix, 3); // Trix 3 -> 0; Top 0
    const faltas = faltasAoSalvar(null, { status: "concluida", data_prevista: null, cliente: null, itens: [{ insumo_id: preta, quantidade: 1 }] });
    expect(faltas.map((f) => [f.venda_id, f.material_nome, f.falta])).toEqual([[ana, "Caneca Cor Preta c/ Tarja Branca", 1]]);
  });

  it("os itens da venda trazem a categoria do insumo", () => {
    const v = registrarVenda(venda());
    expect(v.itens.map((i) => [i.nome, i.categoria_nome])).toEqual([
      ["Caneca branca 325ml", "Caneca cor branca"],
      ["Caixa para caneca de porcelana 325ml", "Caixa para caneca"],
    ]);
  });
});

describe("alterar data de entrega", () => {
  it("muda a data da pré-venda sem mexer no estoque e reordena as faltas", () => {
    const pre = (cliente: string, data: string, qtd: number) =>
      registrarVenda(venda({ status: "pre_venda", cliente, data_prevista: data, itens: [{ insumo_id: laco, quantidade: qtd }] })).id;
    const ana = pre("Ana", "2026-11-20", 6);
    const bia = pre("Bia", "2026-11-25", 6); // laço 10 -> -2: falta fica com a Bia (entrega depois)
    expect(calcularFaltas().map((f) => f.venda_id)).toEqual([bia]);

    expect(alterarDataPrevista(bia, "2026-11-18")?.data_prevista).toBe("2026-11-18");
    expect(buscarInsumoPorId(laco)?.quantidade_estoque).toBe(-2);
    expect(calcularFaltas().map((f) => f.venda_id)).toEqual([ana]); // agora a Ana entrega por último
  });

  it("não muda a data de venda concluída; inexistente = null", () => {
    const { id } = registrarVenda(venda());
    expect(() => alterarDataPrevista(id, "2026-12-01")).toThrow(StatusInvalidoError);
    expect(alterarDataPrevista(9999, "2026-12-01")).toBeNull();
  });
});
