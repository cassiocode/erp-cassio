import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../connection";
import { NomeDuplicadoError } from "../erros";
import { apagarCompra, listarCompras, registrarCompra, type DadosCompra } from "./compras";
import {
  atualizarInsumo,
  buscarInsumoPorId,
  criarInsumo,
  definirInsumoAtivo,
  listarInsumos,
  type DadosNovoInsumo,
} from "./insumos";

// DB_PATH=":memory:" (vitest.config.mts): banco novo e vazio, com migrations aplicadas

function novo(extra: Partial<DadosNovoInsumo> = {}): DadosNovoInsumo {
  return {
    nome: "Caneca branca 325ml",
    valor_pago_centavos: 12600,
    quantidade_comprada: 12,
    data_compra: "2026-11-01",
    observacao: null,
    ...extra,
  };
}

function compra(extra: Partial<DadosCompra> = {}): DadosCompra {
  return { data_compra: "2026-11-10", quantidade: 12, valor_pago_centavos: 14400, observacao: null, ...extra };
}

beforeEach(() => {
  getDb().exec("DELETE FROM compras_insumo; DELETE FROM insumos;");
});

describe("insumos: criar", () => {
  it("12 canecas por R$ 126,00: custo R$ 10,50 e 12 em estoque", () => {
    const insumo = criarInsumo(novo());
    expect(insumo.id).toBeGreaterThan(0);
    expect(insumo.total_pago_centavos).toBe(12600);
    expect(insumo.quantidade_comprada).toBe(12);
    expect(insumo.custo_unitario_centavos).toBe(1050);
    expect(insumo.quantidade_estoque).toBe(12);
    expect(insumo.ativo).toBe(1);
  });

  it("o cadastro vira a primeira compra do insumo", () => {
    const { id } = criarInsumo(novo());
    expect(listarCompras(id)).toMatchObject([
      { insumo_id: id, data_compra: "2026-11-01", quantidade: 12, valor_pago_centavos: 12600, custo_unitario_centavos: 1050 },
    ]);
  });

  it("arredonda o custo por unidade para o centavo mais próximo", () => {
    // R$ 100,00 / 3 = 33,333... -> R$ 33,33
    expect(criarInsumo(novo({ valor_pago_centavos: 10000, quantidade_comprada: 3 })).custo_unitario_centavos).toBe(3333);
  });

  it("aceita caneca branca e caneca preta como insumos diferentes", () => {
    criarInsumo(novo());
    criarInsumo(novo({ nome: "Caneca preta 325ml", valor_pago_centavos: 20280 }));
    expect(listarInsumos().map((i) => i.nome)).toEqual(["Caneca branca 325ml", "Caneca preta 325ml"]);
  });

  it("bloqueia nome duplicado sem diferenciar maiúsculas nem acentos, sem gravar compra", () => {
    criarInsumo(novo({ nome: "Caneca mágica preta" }));
    expect(() => criarInsumo(novo({ nome: "CANECA MÁGICA PRETA" }))).toThrow(NomeDuplicadoError);
    expect(() => criarInsumo(novo({ nome: "caneca magica preta" }))).toThrow(NomeDuplicadoError);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM compras_insumo").get()?.n).toBe(1);
  });
});

describe("compras", () => {
  it("nova compra soma ao estoque: 8 + 12 = 20", () => {
    const { id } = criarInsumo(novo());
    atualizarInsumo(id, { nome: "Caneca branca 325ml", quantidade_estoque: 8, observacao: null });

    registrarCompra(id, compra());
    expect(buscarInsumoPorId(id)?.quantidade_estoque).toBe(20);
  });

  it("custo do insumo é a média ponderada das compras", () => {
    const { id } = criarInsumo(novo()); // 12 x R$ 10,50
    registrarCompra(id, compra()); // 12 x R$ 12,00
    const insumo = buscarInsumoPorId(id)!;
    expect(insumo.quantidade_comprada).toBe(24);
    expect(insumo.total_pago_centavos).toBe(27000);
    expect(insumo.custo_unitario_centavos).toBe(1125); // R$ 11,25
  });

  it("lista as compras mais recentes primeiro", () => {
    const { id } = criarInsumo(novo());
    registrarCompra(id, compra({ data_compra: "2026-11-20" }));
    registrarCompra(id, compra({ data_compra: "2026-11-05" }));
    expect(listarCompras(id).map((c) => c.data_compra)).toEqual(["2026-11-20", "2026-11-05", "2026-11-01"]);
  });

  it("apagar compra tira do estoque e recalcula o custo", () => {
    const { id } = criarInsumo(novo());
    const segunda = registrarCompra(id, compra())!;

    expect(apagarCompra(segunda.id)).toBe(true);
    const insumo = buscarInsumoPorId(id)!;
    expect(insumo.quantidade_estoque).toBe(12);
    expect(insumo.custo_unitario_centavos).toBe(1050);
    expect(listarCompras(id)).toHaveLength(1);
  });

  it("apagar compra pode deixar o estoque negativo", () => {
    const { id } = criarInsumo(novo());
    atualizarInsumo(id, { nome: "Caneca branca 325ml", quantidade_estoque: 5, observacao: null });
    const [primeira] = listarCompras(id);
    apagarCompra(primeira.id);
    expect(buscarInsumoPorId(id)?.quantidade_estoque).toBe(-7);
  });

  it("sem compras, o custo fica vazio", () => {
    const { id } = criarInsumo(novo());
    apagarCompra(listarCompras(id)[0].id);
    const insumo = buscarInsumoPorId(id)!;
    expect(insumo.quantidade_comprada).toBe(0);
    expect(insumo.custo_unitario_centavos).toBeNull();
  });

  it("insumo ou compra inexistente", () => {
    expect(registrarCompra(9999, compra())).toBeNull();
    expect(apagarCompra(9999)).toBe(false);
  });
});

describe("insumos: listar e buscar", () => {
  beforeEach(() => {
    criarInsumo(novo());
    criarInsumo(novo({ nome: "Caneca preta 325ml" }));
    const papel = criarInsumo(novo({ nome: "Papel A4" }));
    definirInsumoAtivo(papel.id, false);
  });

  it("busca por parte do nome", () => {
    expect(listarInsumos({ busca: "preta" }).map((i) => i.nome)).toEqual(["Caneca preta 325ml"]);
  });

  it("busca sem diferenciar maiúsculas nem acentos", () => {
    criarInsumo(novo({ nome: "Fita térmica" }));
    expect(listarInsumos({ busca: "TERMICA" }).map((i) => i.nome)).toEqual(["Fita térmica"]);
    expect(listarInsumos({ busca: "Térm" }).map((i) => i.nome)).toEqual(["Fita térmica"]);
  });

  it("trata % e _ da busca como texto, não como curinga", () => {
    expect(listarInsumos({ busca: "%" })).toHaveLength(0);
  });

  it("filtra por situação, com ativos primeiro", () => {
    expect(listarInsumos({ ativo: 1 })).toHaveLength(2);
    expect(listarInsumos({ ativo: 0 }).map((i) => i.nome)).toEqual(["Papel A4"]);
    expect(listarInsumos().map((i) => i.nome)).toEqual(["Caneca branca 325ml", "Caneca preta 325ml", "Papel A4"]);
  });

  it("buscar por id inexistente devolve null", () => {
    expect(buscarInsumoPorId(9999)).toBeNull();
  });
});

describe("insumos: editar", () => {
  it("altera nome, estoque (até negativo) e observação sem mexer nas compras", () => {
    const { id } = criarInsumo(novo());
    const atualizado = atualizarInsumo(id, { nome: "Caneca branca", quantidade_estoque: -1, observacao: "AAA" });
    expect(atualizado).toMatchObject({ nome: "Caneca branca", quantidade_estoque: -1, observacao: "AAA" });
    expect(atualizado?.custo_unitario_centavos).toBe(1050);
  });

  it("permite manter o próprio nome (mudando só maiúsculas)", () => {
    const { id } = criarInsumo(novo());
    expect(atualizarInsumo(id, { nome: "CANECA BRANCA 325ML", quantidade_estoque: 0, observacao: null })?.nome).toBe(
      "CANECA BRANCA 325ML",
    );
  });

  it("bloqueia nome de outro insumo", () => {
    criarInsumo(novo());
    const preta = criarInsumo(novo({ nome: "Caneca preta 325ml" }));
    expect(() =>
      atualizarInsumo(preta.id, { nome: "Caneca branca 325ml", quantidade_estoque: 0, observacao: null }),
    ).toThrow(NomeDuplicadoError);
  });

  it("devolve null para id inexistente", () => {
    expect(atualizarInsumo(9999, { nome: "X", quantidade_estoque: 0, observacao: null })).toBeNull();
  });
});

describe("insumos: inativar e reativar", () => {
  it("inativa e reativa sem apagar", () => {
    const { id } = criarInsumo(novo());
    expect(definirInsumoAtivo(id, false)?.ativo).toBe(0);
    expect(buscarInsumoPorId(id)).not.toBeNull();
    expect(definirInsumoAtivo(id, true)?.ativo).toBe(1);
  });

  it("devolve null para id inexistente", () => {
    expect(definirInsumoAtivo(9999, false)).toBeNull();
  });
});
