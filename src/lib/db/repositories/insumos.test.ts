import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../connection";
import { GrupoInvalidoError, NomeDuplicadoError } from "../erros";
import {
  buscarGrupoPorNome,
  criarGrupo,
  definirGrupoAtivo,
  listarGrupos,
  renomearGrupo,
} from "./grupos-insumo";
import {
  atualizarInsumo,
  buscarInsumoPorId,
  criarInsumo,
  definirInsumoAtivo,
  listarInsumos,
  type DadosInsumo,
} from "./insumos";

// DB_PATH=":memory:" (vitest.config.mts): banco novo e vazio, com migrations aplicadas

let canecas: number;
let papel: number;

function dados(extra: Partial<DadosInsumo> = {}): DadosInsumo {
  return {
    nome: "Caneca branca 325ml",
    grupo_id: canecas,
    unidade: "un",
    valor_pago_centavos: 1250,
    rendimento: 1,
    quantidade_estoque: 40,
    estoque_minimo: 10,
    fornecedor: null,
    especificacao: null,
    ...extra,
  };
}

beforeEach(() => {
  getDb().exec("DELETE FROM insumos; DELETE FROM grupos_insumo;");
  canecas = criarGrupo("Caneca").id;
  papel = criarGrupo("Papel e tinta").id;
});

describe("insumos: criar", () => {
  it("cria e devolve com grupo e custo por unidade", () => {
    const insumo = criarInsumo(dados());
    expect(insumo.id).toBeGreaterThan(0);
    expect(insumo.grupo_nome).toBe("Caneca");
    expect(insumo.custo_unitario_centavos).toBe(1250);
    expect(insumo.ativo).toBe(1);
    expect(insumo.criado_em).toBe(insumo.atualizado_em);
  });

  it("calcula o custo por unidade a partir do rendimento", () => {
    const insumo = criarInsumo(
      dados({ nome: "Papel A4", grupo_id: papel, unidade: "folha", valor_pago_centavos: 4500, rendimento: 100 }),
    );
    expect(insumo.custo_unitario_centavos).toBe(45);
  });

  it("aceita caneca branca e caneca preta como insumos diferentes", () => {
    criarInsumo(dados());
    criarInsumo(dados({ nome: "Caneca preta 325ml", valor_pago_centavos: 1690 }));
    expect(listarInsumos({ grupoId: canecas }).map((i) => i.nome)).toEqual([
      "Caneca branca 325ml",
      "Caneca preta 325ml",
    ]);
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

  it("bloqueia grupo inexistente", () => {
    expect(() => criarInsumo(dados({ grupo_id: 9999 }))).toThrow(GrupoInvalidoError);
  });
});

describe("insumos: listar e buscar", () => {
  beforeEach(() => {
    criarInsumo(dados());
    criarInsumo(dados({ nome: "Caneca preta 325ml" }));
    const papelA4 = criarInsumo(dados({ nome: "Papel A4", grupo_id: papel }));
    definirInsumoAtivo(papelA4.id, false);
  });

  it("busca por parte do nome", () => {
    expect(listarInsumos({ busca: "preta" }).map((i) => i.nome)).toEqual(["Caneca preta 325ml"]);
  });

  it("busca sem diferenciar maiúsculas nem acentos", () => {
    criarInsumo(dados({ nome: "Fita térmica", grupo_id: papel }));
    expect(listarInsumos({ busca: "TERMICA" }).map((i) => i.nome)).toEqual(["Fita térmica"]);
    expect(listarInsumos({ busca: "Térm" }).map((i) => i.nome)).toEqual(["Fita térmica"]);
  });

  it("trata % e _ da busca como texto, não como curinga", () => {
    expect(listarInsumos({ busca: "%" })).toHaveLength(0);
  });

  it("filtra por grupo e por situação", () => {
    expect(listarInsumos({ grupoId: papel })).toHaveLength(1);
    expect(listarInsumos({ ativo: 1 })).toHaveLength(2);
    expect(listarInsumos({ ativo: 0 }).map((i) => i.nome)).toEqual(["Papel A4"]);
    expect(listarInsumos()).toHaveLength(3);
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
      dados({ valor_pago_centavos: 2600, rendimento: 2, fornecedor: "Loja X", especificacao: "AAA" }),
    );
    expect(atualizado?.custo_unitario_centavos).toBe(1300);
    expect(atualizado?.fornecedor).toBe("Loja X");
    expect(atualizado?.especificacao).toBe("AAA");
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

describe("grupos de insumo", () => {
  it("lista com a quantidade de insumos de cada grupo", () => {
    criarInsumo(dados());
    criarInsumo(dados({ nome: "Caneca preta 325ml" }));
    const totais = Object.fromEntries(listarGrupos().map((g) => [g.nome, g.total_insumos]));
    expect(totais).toEqual({ Caneca: 2, "Papel e tinta": 0 });
  });

  it("bloqueia grupo duplicado sem diferenciar maiúsculas nem acentos", () => {
    expect(() => criarGrupo("CANECA")).toThrow(NomeDuplicadoError);
    criarGrupo("Decoração");
    expect(() => criarGrupo("DECORACAO")).toThrow(NomeDuplicadoError);
  });

  it("renomeia e o insumo passa a mostrar o novo nome", () => {
    const { id } = criarInsumo(dados());
    renomearGrupo(canecas, "Canecas de sublimação");
    expect(buscarInsumoPorId(id)?.grupo_nome).toBe("Canecas de sublimação");
  });

  it("não deixa renomear para o nome de outro grupo", () => {
    expect(() => renomearGrupo(papel, "caneca")).toThrow(NomeDuplicadoError);
  });

  it("inativa o grupo sem afetar os insumos dele", () => {
    const { id } = criarInsumo(dados());
    definirGrupoAtivo(canecas, false);
    expect(listarGrupos({ ativo: 1 }).map((g) => g.nome)).toEqual(["Papel e tinta"]);
    expect(buscarInsumoPorId(id)?.ativo).toBe(1);
  });

  it("busca por nome sem diferenciar maiúsculas", () => {
    expect(buscarGrupoPorNome("papel E TINTA")?.id).toBe(papel);
    expect(buscarGrupoPorNome("Inexistente")).toBeNull();
  });
});
