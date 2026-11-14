import { describe, expect, it } from "vitest";
import { hojeISO } from "../datas";
import { errosPorCampo } from "./comum";
import { vendaSchema } from "./vendas";

const valida = {
  data_venda: "2026-11-14",
  kits: [{ kit_id: "1", quantidade: "3" }],
  desconto_percentual: "5",
  cliente: " Maria ",
  preco_venda: "29,90",
  observacao: "",
  itens: [
    { insumo_id: "9", quantidade: "1" },
    { insumo_id: 15, quantidade: 1 },
  ],
};

function errosDe(entrada: unknown) {
  const resultado = vendaSchema.safeParse(entrada);
  if (resultado.success) throw new Error("era para falhar");
  return errosPorCampo(resultado.error);
}

describe("vendaSchema", () => {
  it("converte a venda da tela para o formato do banco", () => {
    expect(vendaSchema.parse(valida)).toEqual({
      status: "concluida",
      data_prevista: null,
      data_venda: "2026-11-14",
      kits: [{ kit_id: 1, quantidade: 3 }],
      desconto_percentual: 5,
      cliente: "Maria",
      preco_venda_centavos: 2990,
      valor_pago_centavos: 0,
      custo_energia_centavos: 50, // energia vem marcada por padrão
      observacao: null,
      itens: [
        { insumo_id: 9, quantidade: 1 },
        { insumo_id: 15, quantidade: 1 },
      ],
    });
  });

  it("desconto: vazio = 0 (sem desconto), aceita 7,5 e recusa acima de 100; sem kits = venda avulsa", () => {
    expect(vendaSchema.parse({ ...valida, desconto_percentual: "" }).desconto_percentual).toBe(0);
    expect(vendaSchema.parse({ ...valida, desconto_percentual: "7,5" }).desconto_percentual).toBe(7.5);
    expect(errosDe({ ...valida, desconto_percentual: "150" }).desconto_percentual).toMatch(/Desconto inválido/);
    expect(vendaSchema.parse({ ...valida, kits: undefined }).kits).toEqual([]);
    expect(errosDe({ ...valida, kits: [{ kit_id: 1, quantidade: 0 }] }).kits).toMatch(/pelo menos 1/);
  });

  it("pré-venda exige data prevista de entrega; rascunho não", () => {
    expect(errosDe({ ...valida, status: "pre_venda" }).data_prevista).toMatch(/data prevista/);
    expect(vendaSchema.parse({ ...valida, status: "pre_venda", data_prevista: "2026-11-20" }).data_prevista).toBe("2026-11-20");
    expect(vendaSchema.parse({ ...valida, status: "rascunho" }).status).toBe("rascunho");
    expect(errosDe({ ...valida, status: "outro" }).status).toBe("Status inválido");
  });

  it("energia desmarcada fica com custo 0", () => {
    expect(vendaSchema.parse({ ...valida, com_energia: false }).custo_energia_centavos).toBe(0);
  });

  it("valor já pago: vazio = 0, converte para centavos e não pode passar do preço", () => {
    expect(vendaSchema.parse({ ...valida, valor_pago: "" }).valor_pago_centavos).toBe(0);
    expect(vendaSchema.parse({ ...valida, valor_pago: "10,00" }).valor_pago_centavos).toBe(1000);
    expect(errosDe({ ...valida, valor_pago: "30,00" }).valor_pago).toMatch(/maior que o preço/);
    expect(errosDe({ ...valida, valor_pago: "-1" }).valor_pago).toMatch(/inválido/);
  });

  it("sem data usa hoje", () => {
    expect(vendaSchema.parse({ ...valida, data_venda: "" }).data_venda).toBe(hojeISO());
  });

  it("exige preço válido e pelo menos um insumo", () => {
    const erros = errosDe({ ...valida, preco_venda: "abc", itens: [] });
    expect(erros.preco_venda).toMatch(/Preço inválido/);
    expect(erros.itens).toBe("Adicione pelo menos um insumo");
  });

  it("recusa quantidade zero", () => {
    expect(errosDe({ ...valida, itens: [{ insumo_id: 9, quantidade: 0 }] }).itens).toMatch(/pelo menos 1/);
  });
});
