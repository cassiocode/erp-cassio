/** Custo fixo de energia (forno/prensa) somado a cada venda, a menos que seja desmarcado na tela. */
export const CUSTO_ENERGIA_CENTAVOS = 50;

/** Preço de venda de um insumo com margem: custo × (1 + margem%). Ex.: R$ 5,99 com 50% = R$ 8,99. */
export function precoComMargem(custoCentavos: number, margemPercentual: number): number {
  return Math.round(custoCentavos * (1 + margemPercentual / 100));
}

/** Texto da margem para mostrar: 50 -> "50%", 33.5 -> "33,5%". */
export function formatarMargem(margemPercentual: number): string {
  return `${String(margemPercentual).replace(".", ",")}%`;
}
