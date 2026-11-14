/**
 * Desconto progressivo sobre o preço dos kits de caneca (branca e preta somam juntas):
 * 3 a 5 canecas = 5%, 6 ou mais = 10%. Extras (trufa, laço...) não têm desconto.
 */
export function descontoProgressivo(quantidadeCanecas: number): number {
  if (quantidadeCanecas >= 6) return 10;
  if (quantidadeCanecas >= 3) return 5;
  return 0;
}

/** Valor do desconto em centavos sobre o total dos kits. Ex.: R$ 139,60 com 5% = R$ 6,98. */
export function valorDesconto(totalKitsCentavos: number, percentual: number): number {
  return Math.round((totalKitsCentavos * percentual) / 100);
}

/** "5" / "33,5" / "10%" -> número de 0 a 100; null se inválido. Vazio = 0 (sem desconto). */
export function lerPercentual(texto: string): number | null {
  const limpo = texto.trim().replace("%", "").replace(",", ".").trim();
  if (limpo === "") return 0;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
}
