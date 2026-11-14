import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../connection";
import { apagarBaixa, listarBaixas, registrarBaixa } from "./baixas";
import { buscarInsumoPorId, criarInsumo } from "./insumos";

let caneca: number;

beforeEach(() => {
  getDb().exec(
    "DELETE FROM baixas; DELETE FROM venda_itens; DELETE FROM vendas; DELETE FROM kit_itens; DELETE FROM compras_insumo; DELETE FROM insumos;",
  );
  caneca = criarInsumo({
    nome: "Caneca branca 325ml",
    valor_pago_centavos: 12600,
    quantidade_comprada: 12,
    data_compra: "2026-11-01",
    observacao: null,
  }).id; // R$ 10,50 cada, 12 em estoque
});

describe("baixas", () => {
  it("registra com motivo, guarda o custo do dia e tira do estoque", () => {
    const b = registrarBaixa({ insumo_id: caneca, data_baixa: "2026-11-14", quantidade: 2, motivo: "Quebrou na prensa" });
    expect(b).toMatchObject({
      insumo_nome: "Caneca branca 325ml",
      quantidade: 2,
      motivo: "Quebrou na prensa",
      custo_unitario_centavos: 1050,
      custo_total_centavos: 2100,
    });
    expect(buscarInsumoPorId(caneca)?.quantidade_estoque).toBe(10);
  });

  it("estoque pode ficar negativo", () => {
    registrarBaixa({ insumo_id: caneca, data_baixa: "2026-11-14", quantidade: 15, motivo: "Estrago" });
    expect(buscarInsumoPorId(caneca)?.quantidade_estoque).toBe(-3);
  });

  it("insumo inexistente devolve null sem gravar", () => {
    expect(registrarBaixa({ insumo_id: 9999, data_baixa: "2026-11-14", quantidade: 1, motivo: "x" })).toBeNull();
    expect(listarBaixas()).toHaveLength(0);
  });

  it("lista as mais recentes primeiro", () => {
    registrarBaixa({ insumo_id: caneca, data_baixa: "2026-11-10", quantidade: 1, motivo: "A" });
    registrarBaixa({ insumo_id: caneca, data_baixa: "2026-11-12", quantidade: 1, motivo: "B" });
    expect(listarBaixas().map((b) => b.motivo)).toEqual(["B", "A"]);
  });

  it("apagar a baixa devolve ao estoque", () => {
    const b = registrarBaixa({ insumo_id: caneca, data_baixa: "2026-11-14", quantidade: 3, motivo: "Estrago" })!;
    expect(apagarBaixa(b.id)).toBe(true);
    expect(buscarInsumoPorId(caneca)?.quantidade_estoque).toBe(12);
    expect(apagarBaixa(b.id)).toBe(false);
  });
});
