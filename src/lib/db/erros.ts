/** Nome já usado por outro registro (comparação sem diferenciar maiúsculas). */
export class NomeDuplicadoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "NomeDuplicadoError";
  }
}

/** O grupo informado para o insumo não existe. */
export class GrupoInvalidoError extends Error {
  constructor() {
    super("Grupo não encontrado");
    this.name = "GrupoInvalidoError";
  }
}

export function ehViolacaoDeUnico(erro: unknown): boolean {
  return erro instanceof Error && erro.message.includes("UNIQUE constraint failed");
}
