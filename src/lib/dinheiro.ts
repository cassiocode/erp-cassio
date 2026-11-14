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

/**
 * Custo de uma unidade de uso a partir do valor pago na compra e do rendimento.
 * Ex.: pacote de papel R$ 45,00 que rende 100 folhas -> 45 centavos por folha.
 * Arredonda para o centavo mais próximo.
 */
export function custoPorUnidade(valorPagoCentavos: number, rendimento: number): number {
  if (!Number.isInteger(valorPagoCentavos) || valorPagoCentavos < 0) {
    throw new RangeError("O valor pago deve ser um inteiro em centavos, maior ou igual a zero");
  }
  if (!Number.isInteger(rendimento) || rendimento < 1) {
    throw new RangeError("O rendimento deve ser um número inteiro maior ou igual a 1");
  }
  return Math.round(valorPagoCentavos / rendimento);
}

/** Centavos -> texto para preencher campo de formulário. Ex.: 1250 -> "12,50" */
export function centavosParaTexto(centavos: number): string {
  const reais = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, "0");
  return `${reais},${resto}`;
}
