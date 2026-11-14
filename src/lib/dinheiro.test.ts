import { describe, expect, it } from "vitest";
import { centavosParaTexto, formatarReais, paraCentavos } from "./dinheiro";

// Intl usa espaço não separável entre "R$" e o valor
const normalizar = (s: string) => s.replace(/ /g, " ");

describe("formatarReais", () => {
  it("formata centavos em reais", () => {
    expect(normalizar(formatarReais(1250))).toBe("R$ 12,50");
    expect(normalizar(formatarReais(0))).toBe("R$ 0,00");
    expect(normalizar(formatarReais(5))).toBe("R$ 0,05");
    expect(normalizar(formatarReais(123456))).toBe("R$ 1.234,56");
  });
});

describe("paraCentavos", () => {
  it("converte formatos válidos", () => {
    expect(paraCentavos("12,50")).toBe(1250);
    expect(paraCentavos("1.234,56")).toBe(123456);
    expect(paraCentavos("12")).toBe(1200);
    expect(paraCentavos("R$ 12,50")).toBe(1250);
    expect(paraCentavos("0,5")).toBe(50);
    expect(paraCentavos("0,05")).toBe(5);
    expect(paraCentavos("12.5")).toBe(1250);
    expect(paraCentavos("1.234")).toBe(123400);
    expect(paraCentavos("  7,00 ")).toBe(700);
    expect(paraCentavos("0")).toBe(0);
  });

  it("não sofre com erro de ponto flutuante", () => {
    expect(paraCentavos("0,29")).toBe(29);
    expect(paraCentavos("1,15")).toBe(115);
    expect(paraCentavos("19,99")).toBe(1999);
  });

  it("retorna null para entradas inválidas", () => {
    expect(paraCentavos("")).toBeNull();
    expect(paraCentavos("   ")).toBeNull();
    expect(paraCentavos("abc")).toBeNull();
    expect(paraCentavos("-5")).toBeNull();
    expect(paraCentavos("12,555")).toBeNull();
    expect(paraCentavos("1,2,3")).toBeNull();
    expect(paraCentavos("12,")).toBeNull();
  });
});

describe("centavosParaTexto", () => {
  it("volta para o formato do campo", () => {
    expect(centavosParaTexto(1250)).toBe("12,50");
    expect(centavosParaTexto(5)).toBe("0,05");
    expect(centavosParaTexto(100000)).toBe("1000,00");
    expect(paraCentavos(centavosParaTexto(123456))).toBe(123456);
  });
});
