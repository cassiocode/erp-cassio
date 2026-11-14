import { describe, expect, it } from "vitest";
import { errosPorCampo } from "./comum";
import { insumoSchema } from "./insumos";

const valido = {
  nome: "  Caneca branca 325ml ",
  valor_pago: "126,00",
  quantidade_comprada: "12",
  quantidade_estoque: "12",
  observacao: "Cerâmica AAA",
};

function errosDe(entrada: unknown) {
  const resultado = insumoSchema.safeParse(entrada);
  if (resultado.success) throw new Error("era para falhar");
  return errosPorCampo(resultado.error);
}

describe("insumoSchema", () => {
  it("aceita dados do formulário e converte para o formato do banco", () => {
    expect(insumoSchema.parse(valido)).toEqual({
      nome: "Caneca branca 325ml",
      valor_pago_centavos: 12600,
      quantidade_comprada: 12,
      quantidade_estoque: 12,
      observacao: "Cerâmica AAA",
    });
  });

  it("usa padrões quando quantidades e observação não vêm", () => {
    const dados = insumoSchema.parse({ nome: "Bombom", valor_pago: 1.5 });
    expect(dados).toEqual({
      nome: "Bombom",
      valor_pago_centavos: 150,
      quantidade_comprada: 1,
      quantidade_estoque: 0,
      observacao: null,
    });
  });

  it("observação vazia vira null", () => {
    expect(insumoSchema.parse({ ...valido, observacao: "   " }).observacao).toBeNull();
  });

  it("exige nome e total pago", () => {
    const erros = errosDe({ nome: " ", valor_pago: "" });
    expect(erros.nome).toBe("O nome é obrigatório");
    expect(erros.valor_pago).toMatch(/Valor inválido/);
  });

  it("rejeita total pago negativo", () => {
    expect(errosDe({ ...valido, valor_pago: "-3" }).valor_pago).toMatch(/não pode ser negativo/);
  });

  it("rejeita quantidade comprada zero ou fracionada", () => {
    expect(errosDe({ ...valido, quantidade_comprada: "0" }).quantidade_comprada).toBe(
      "A quantidade comprada deve ser pelo menos 1",
    );
    expect(errosDe({ ...valido, quantidade_comprada: "2.5" }).quantidade_comprada).toBe(
      "A quantidade comprada deve ser um número inteiro",
    );
  });

  it("aceita estoque negativo, mas não fracionado", () => {
    expect(insumoSchema.parse({ ...valido, quantidade_estoque: "-3" }).quantidade_estoque).toBe(-3);
    expect(errosDe({ ...valido, quantidade_estoque: "1.5" }).quantidade_estoque).toMatch(/inteiro/);
  });
});
