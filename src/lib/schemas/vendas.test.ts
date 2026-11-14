import { describe, expect, it } from "vitest";
import { hojeISO } from "../datas";
import { errosPorCampo } from "./comum";
import { vendaSchema } from "./vendas";

const valida = {
  data_venda: "2026-11-14",
  kit_id: "1",
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
      kit_id: 1,
      cliente: "Maria",
      preco_venda_centavos: 2990,
      custo_energia_centavos: 50, // energia vem marcada por padrão
      observacao: null,
      itens: [
        { insumo_id: 9, quantidade: 1 },
        { insumo_id: 15, quantidade: 1 },
      ],
    });
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

  it("sem data usa hoje; sem kit fica null", () => {
    const dados = vendaSchema.parse({ ...valida, data_venda: "", kit_id: null });
    expect(dados.data_venda).toBe(hojeISO());
    expect(dados.kit_id).toBeNull();
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
