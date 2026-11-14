import { describe, expect, it } from "vitest";
import { errosPorCampo } from "./comum";
import { grupoInsumoSchema } from "./grupos-insumo";
import { insumoSchema } from "./insumos";

const valido = {
  nome: "  Caneca branca 325ml ",
  grupo_id: "1",
  unidade: "un",
  valor_pago: "12,50",
  rendimento: "1",
  quantidade_estoque: "40",
  estoque_minimo: "10",
  fornecedor: "",
  especificacao: "Cerâmica AAA",
};

function errosDe(entrada: unknown) {
  const resultado = insumoSchema.safeParse(entrada);
  if (resultado.success) throw new Error("era para falhar");
  return errosPorCampo(resultado.error);
}

describe("insumoSchema", () => {
  it("aceita dados do formulário e converte para o formato do banco", () => {
    const dados = insumoSchema.parse(valido);
    expect(dados).toEqual({
      nome: "Caneca branca 325ml",
      grupo_id: 1,
      unidade: "un",
      valor_pago_centavos: 1250,
      rendimento: 1,
      quantidade_estoque: 40,
      estoque_minimo: 10,
      fornecedor: null, // vazio vira null
      especificacao: "Cerâmica AAA",
    });
  });

  it("usa padrões quando rendimento e estoque não vêm", () => {
    const dados = insumoSchema.parse({ nome: "Bombom", grupo_id: 2, unidade: "un", valor_pago: 1.5 });
    expect(dados.rendimento).toBe(1);
    expect(dados.quantidade_estoque).toBe(0);
    expect(dados.estoque_minimo).toBe(0);
    expect(dados.valor_pago_centavos).toBe(150);
  });

  it("exige nome, grupo, unidade e valor pago", () => {
    const erros = errosDe({ nome: " ", grupo_id: "", unidade: "", valor_pago: "" });
    expect(erros.nome).toBe("O nome é obrigatório");
    expect(erros.grupo_id).toBe("Escolha um grupo");
    expect(erros.unidade).toBe("A unidade é obrigatória");
    expect(erros.valor_pago).toMatch(/Valor inválido/);
  });

  it("rejeita valor pago negativo", () => {
    expect(errosDe({ ...valido, valor_pago: "-3" }).valor_pago).toMatch(/não pode ser negativo/);
  });

  it("rejeita rendimento zero ou fracionado", () => {
    expect(errosDe({ ...valido, rendimento: "0" }).rendimento).toBe("O rendimento deve ser pelo menos 1");
    expect(errosDe({ ...valido, rendimento: "2.5" }).rendimento).toBe("O rendimento deve ser um número inteiro");
  });

  it("rejeita estoque negativo ou fracionado", () => {
    expect(errosDe({ ...valido, quantidade_estoque: "-1" }).quantidade_estoque).toMatch(/não pode ser negativa/);
    expect(errosDe({ ...valido, estoque_minimo: "1.5" }).estoque_minimo).toMatch(/inteiro/);
  });
});

describe("grupoInsumoSchema", () => {
  it("aceita e apara o nome", () => {
    expect(grupoInsumoSchema.parse({ nome: "  Embalagem " })).toEqual({ nome: "Embalagem" });
  });

  it("exige nome", () => {
    const resultado = grupoInsumoSchema.safeParse({ nome: "   " });
    expect(resultado.success).toBe(false);
  });
});
