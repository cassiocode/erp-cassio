/**
 * Minúsculas e sem acento: "Térmica" e "TERMICA" viram "termica".
 * Usada no banco (função SQL `normalizar()`) e nas telas, para comparar e filtrar nomes.
 */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Itens cujo nome contém o texto, sem diferenciar maiúsculas nem acentos. Texto vazio devolve todos. */
export function filtrarPorNome<T extends { nome: string }>(itens: T[], texto: string): T[] {
  const termo = normalizarTexto(texto);
  if (!termo) return itens;
  return itens.filter((item) => normalizarTexto(item.nome).includes(termo));
}
