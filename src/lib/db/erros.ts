/** Nome já usado por outro registro (comparação sem diferenciar maiúsculas nem acentos). */
export class NomeDuplicadoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "NomeDuplicadoError";
  }
}

export function ehViolacaoDeUnico(erro: unknown): boolean {
  return erro instanceof Error && erro.message.includes("UNIQUE constraint failed");
}
