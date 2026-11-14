import { describe, expect, it } from "vitest";
import { hojeISO } from "../datas";
import { errosPorCampo } from "./comum";
import { baixaSchema } from "./baixas";

describe("baixaSchema", () => {
  it("converte a baixa da tela", () => {
    expect(baixaSchema.parse({ insumo_id: "9", quantidade: "2", motivo: " Estragou ", data_baixa: "2026-11-14" })).toEqual({
      insumo_id: 9,
      quantidade: 2,
      motivo: "Estragou",
      data_baixa: "2026-11-14",
    });
  });

  it("sem data usa hoje", () => {
    expect(baixaSchema.parse({ insumo_id: 9, quantidade: 1, motivo: "x", data_baixa: "" }).data_baixa).toBe(hojeISO());
  });

  it("exige insumo, quantidade de pelo menos 1 e motivo", () => {
    const r = baixaSchema.safeParse({ insumo_id: "", quantidade: 0, motivo: "  " });
    if (r.success) throw new Error("era para falhar");
    const erros = errosPorCampo(r.error);
    expect(erros.insumo_id).toBe("Escolha o insumo");
    expect(erros.quantidade).toMatch(/pelo menos 1/);
    expect(erros.motivo).toBe("Informe o motivo da baixa");
  });
});
