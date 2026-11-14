import { describe, expect, it } from "vitest";
import { hojeISO } from "../datas";
import { errosPorCampo } from "./comum";
import { compraSchema, edicaoInsumoSchema, novoInsumoSchema } from "./insumos";
import type { z } from "zod";

function errosDe(schema: z.ZodType, entrada: unknown) {
  const resultado = schema.safeParse(entrada);
  if (resultado.success) throw new Error("era para falhar");
  return errosPorCampo(resultado.error);
}

describe("novoInsumoSchema", () => {
  const valido = {
    nome: "  Caneca branca 325ml ",
    valor_pago: "126,00",
    quantidade_comprada: "12",
    data_compra: "2026-11-01",
    observacao: "Cerâmica AAA",
  };

  it("aceita dados do formulário e converte para o formato do banco", () => {
    expect(novoInsumoSchema.parse(valido)).toEqual({
      nome: "Caneca branca 325ml",
      valor_pago_centavos: 12600,
      quantidade_comprada: 12,
      data_compra: "2026-11-01",
      observacao: "Cerâmica AAA",
    });
  });

  it("usa padrões: quantidade 1, data de hoje, observação vazia vira null", () => {
    expect(novoInsumoSchema.parse({ nome: "Bombom", valor_pago: 1.5, observacao: "  " })).toEqual({
      nome: "Bombom",
      valor_pago_centavos: 150,
      quantidade_comprada: 1,
      data_compra: hojeISO(),
      observacao: null,
    });
  });

  it("exige nome e total pago", () => {
    const erros = errosDe(novoInsumoSchema, { nome: " ", valor_pago: "" });
    expect(erros.nome).toBe("O nome é obrigatório");
    expect(erros.valor_pago).toMatch(/Valor inválido/);
  });

  it("rejeita total negativo, quantidade zero/fracionada e data inválida", () => {
    expect(errosDe(novoInsumoSchema, { ...valido, valor_pago: "-3" }).valor_pago).toMatch(/não pode ser negativo/);
    expect(errosDe(novoInsumoSchema, { ...valido, quantidade_comprada: "0" }).quantidade_comprada).toBe(
      "A quantidade comprada deve ser pelo menos 1",
    );
    expect(errosDe(novoInsumoSchema, { ...valido, quantidade_comprada: "2.5" }).quantidade_comprada).toBe(
      "A quantidade comprada deve ser um número inteiro",
    );
    expect(errosDe(novoInsumoSchema, { ...valido, data_compra: "14/11/2026" }).data_compra).toBe("Data inválida");
  });
});

describe("edicaoInsumoSchema", () => {
  it("aceita estoque negativo, mas não fracionado", () => {
    expect(edicaoInsumoSchema.parse({ nome: "Caneca", quantidade_estoque: "-3" }).quantidade_estoque).toBe(-3);
    expect(errosDe(edicaoInsumoSchema, { nome: "Caneca", quantidade_estoque: "1.5" }).quantidade_estoque).toMatch(
      /inteiro/,
    );
  });
});

describe("compraSchema", () => {
  it("converte a compra para centavos", () => {
    expect(compraSchema.parse({ data_compra: "2026-11-10", quantidade: "12", valor_pago: "144" })).toEqual({
      data_compra: "2026-11-10",
      quantidade: 12,
      valor_pago_centavos: 14400,
      observacao: null,
    });
  });

  it("exige quantidade e total pago", () => {
    const erros = errosDe(compraSchema, { quantidade: "", valor_pago: "" });
    expect(erros.quantidade).toBe("A quantidade comprada deve ser pelo menos 1");
    expect(erros.valor_pago).toMatch(/Valor inválido/);
  });
});
