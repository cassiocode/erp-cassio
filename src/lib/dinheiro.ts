/** Formata centavos inteiros como moeda brasileira. Ex.: 1250 -> "R$ 12,50" */
export function formatarReais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/**
 * Converte texto digitado em centavos inteiros.
 * Aceita "12,50", "1.234,56", "12", "R$ 12,50" e "12.5".
 * Retorna null se o texto for inválido (vazio, negativo, mais de 2 casas decimais...).
 */
export function paraCentavos(texto: string): number | null {
  let t = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (t === "") return null;

  if (t.includes(",")) {
    // Formato brasileiro: ponto = milhar, vírgula = decimal
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // "1.234" = mil duzentos e trinta e quatro reais
    t = t.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;

  const [reais, cent = ""] = t.split(".");
  const centavos = Number(reais) * 100 + Number(cent.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/** Centavos -> texto para preencher campo de formulário. Ex.: 1250 -> "12,50" */
export function centavosParaTexto(centavos: number): string {
  const reais = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, "0");
  return `${reais},${resto}`;
}
