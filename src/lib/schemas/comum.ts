import { z } from "zod";

export const ativoSchema = z.object({
  ativo: z.boolean({ error: "Informe ativo: true ou false" }),
});

/** Converte erros do zod em { campo: mensagem } (primeira mensagem de cada campo). */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = String(problema.path[0] ?? "geral");
    erros[campo] ??= problema.message;
  }
  return erros;
}
