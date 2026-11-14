import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../connection";
import { NomeDuplicadoError } from "../erros";
import {
  atualizarInsumo,
  buscarInsumoPorId,
  criarInsumo,
  definirInsumoAtivo,
  listarInsumos,
  type DadosInsumo,
} from "./insumos";

// DB_PATH=":memory:" (vitest.config.mts): banco novo e vazio, com migrations aplicadas

function dados(extra: Partial<DadosInsumo> = {}): DadosInsumo {
  return {
    nome: "Caneca branca 325ml",
    valor_pago_centavos: 12600,
    quantidade_comprada: 12,
    quantidade_estoque: 12,
    observacao: null,
    ...extra,
  };
}

beforeEach(() => {
  getDb().exec("DELETE FROM insumos");
});

describe("insumos: criar", () => {
  it("12 canecas por R$ 126,00 custam R$ 10,50 cada", () => {
    const insumo = criarInsumo(dados());
    expect(insumo.id).toBeGreaterThan(0);
    expect(insumo.valor_pago_centavos).toBe(12600);
    expect(insumo.quantidade_comprada).toBe(12);
    expect(insumo.custo_unitario_centavos).toBe(1050);
    expect(insumo.ativo).toBe(1);
    expect(insumo.criado_em).toBe(insumo.atualizado_em);
  });

  it("arredonda o custo por unidade para o centavo mais próximo", () => {
    // R$ 100,00 / 3 = 33,333... -> R$ 33,33
    expect(criarInsumo(dados({ valor_pago_centavos: 10000, quantidade_comprada: 3 })).custo_unitario_centavos).toBe(3333);
  });

  it("aceita estoque negativo", () => {
    expect(criarInsumo(dados({ quantidade_estoque: -2 })).quantidade_estoque).toBe(-2);
  });

  it("aceita caneca branca e caneca preta como insumos diferentes", () => {
    criarInsumo(dados());
    criarInsumo(dados({ nome: "Caneca preta 325ml", valor_pago_centavos: 20280 }));
    expect(listarInsumos().map((i) => i.nome)).toEqual(["Caneca branca 325ml", "Caneca preta 325ml"]);
  });

  it("bloqueia nome duplicado sem diferenciar maiúsculas", () => {
    criarInsumo(dados());
    expect(() => criarInsumo(dados({ nome: "CANECA BRANCA 325ML" }))).toThrow(NomeDuplicadoError);
  });

  it("bloqueia nome duplicado com acento em maiúscula ou sem acento", () => {
    criarInsumo(dados({ nome: "Caneca mágica preta" }));
    expect(() => criarInsumo(dados({ nome: "CANECA MÁGICA PRETA" }))).toThrow(NomeDuplicadoError);
    expect(() => criarInsumo(dados({ nome: "caneca magica preta" }))).toThrow(NomeDuplicadoError);
  });
});

describe("insumos: listar e buscar", () => {
  beforeEach(() => {
    criarInsumo(dados());
    criarInsumo(dados({ nome: "Caneca preta 325ml" }));
    const papel = criarInsumo(dados({ nome: "Papel A4" }));
    definirInsumoAtivo(papel.id, false);
  });

  it("busca por parte do nome", () => {
    expect(listarInsumos({ busca: "preta" }).map((i) => i.nome)).toEqual(["Caneca preta 325ml"]);
  });

  it("busca sem diferenciar maiúsculas nem acentos", () => {
    criarInsumo(dados({ nome: "Fita térmica" }));
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

describe("insumos: atualizar", () => {
  it("atualiza campos e recalcula o custo por unidade", () => {
    const { id } = criarInsumo(dados());
    const atualizado = atualizarInsumo(
      id,
      dados({ valor_pago_centavos: 2600, quantidade_comprada: 2, quantidade_estoque: -1, observacao: "AAA" }),
    );
    expect(atualizado?.custo_unitario_centavos).toBe(1300);
    expect(atualizado?.quantidade_estoque).toBe(-1);
    expect(atualizado?.observacao).toBe("AAA");
  });

  it("permite manter o próprio nome (mudando só maiúsculas)", () => {
    const { id } = criarInsumo(dados());
    expect(atualizarInsumo(id, dados({ nome: "CANECA BRANCA 325ML" }))?.nome).toBe("CANECA BRANCA 325ML");
  });

  it("bloqueia nome de outro insumo", () => {
    criarInsumo(dados());
    const preta = criarInsumo(dados({ nome: "Caneca preta 325ml" }));
    expect(() => atualizarInsumo(preta.id, dados())).toThrow(NomeDuplicadoError);
  });

  it("devolve null para id inexistente", () => {
    expect(atualizarInsumo(9999, dados())).toBeNull();
  });
});

describe("insumos: inativar e reativar", () => {
  it("inativa e reativa sem apagar", () => {
    const { id } = criarInsumo(dados());
    expect(definirInsumoAtivo(id, false)?.ativo).toBe(0);
    expect(buscarInsumoPorId(id)).not.toBeNull();
    expect(definirInsumoAtivo(id, true)?.ativo).toBe(1);
  });

  it("devolve null para id inexistente", () => {
    expect(definirInsumoAtivo(9999, false)).toBeNull();
  });
});
