import { describe, expect, it } from "vitest";
import { descontoProgressivo, lerPercentual, valorDesconto } from "./descontos";

describe("descontoProgressivo", () => {
  it("1 e 2 canecas: sem desconto; 3 a 5: 5%; 6 ou mais: 10%", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 20].map(descontoProgressivo)).toEqual([0, 0, 0, 5, 5, 5, 10, 10, 10]);
  });
});

describe("valorDesconto", () => {
  it("4 canecas pretas (R$ 139,60) com 5% = R$ 6,98", () => {
    expect(valorDesconto(13960, 5)).toBe(698);
  });
  it("arredonda para o centavo e 0% não desconta", () => {
    expect(valorDesconto(2990, 5)).toBe(150); // 149,5 -> 150
    expect(valorDesconto(2990, 0)).toBe(0);
  });
});

describe("lerPercentual", () => {
  it("aceita 20, 7,5 e 10%; vazio é 0; recusa negativo, acima de 100 e texto", () => {
    expect(lerPercentual("20")).toBe(20);
    expect(lerPercentual("7,5")).toBe(7.5);
    expect(lerPercentual("10%")).toBe(10);
    expect(lerPercentual(" ")).toBe(0);
    expect(lerPercentual("-1")).toBeNull();
    expect(lerPercentual("101")).toBeNull();
    expect(lerPercentual("abc")).toBeNull();
  });
});
