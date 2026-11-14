import { describe, expect, it } from "vitest";
import { filtrarPorNome, normalizarTexto } from "./texto";

describe("normalizarTexto", () => {
  it("tira acentos, espaços das pontas e deixa minúsculo", () => {
    expect(normalizarTexto("  Fita TÉRMICA ")).toBe("fita termica");
    expect(normalizarTexto("Caneca Mágica")).toBe("caneca magica");
  });
});

describe("filtrarPorNome", () => {
  const itens = [{ nome: "Caneca branca 325ml" }, { nome: "Caneca preta 325ml" }, { nome: "Fita térmica" }];

  it("texto vazio devolve todos", () => {
    expect(filtrarPorNome(itens, "  ")).toEqual(itens);
  });

  it("filtra por parte do nome sem diferenciar maiúsculas nem acentos", () => {
    expect(filtrarPorNome(itens, "CANECA").map((i) => i.nome)).toEqual(["Caneca branca 325ml", "Caneca preta 325ml"]);
    expect(filtrarPorNome(itens, "termi").map((i) => i.nome)).toEqual(["Fita térmica"]);
    expect(filtrarPorNome(itens, "preta 3").map((i) => i.nome)).toEqual(["Caneca preta 325ml"]);
  });

  it("devolve vazio quando nada combina", () => {
    expect(filtrarPorNome(itens, "bombom")).toEqual([]);
  });
});
