import { z } from "zod";
import { paraCentavos } from "../dinheiro";

const inteiroNaoNegativo = (rotulo: string) =>
  z.coerce
    .number({ error: `${rotulo} deve ser um número` })
    .int(`${rotulo} deve ser um número inteiro`)
    .min(0, `${rotulo} não pode ser negativa`);

/**
 * Entrada da API/formulário. O custo chega como texto ("12,50") e sai em centavos.
 */
export const materialSchema = z
  .object({
    nome: z
      .string({ error: "O nome é obrigatório" })
      .trim()
      .min(1, "O nome é obrigatório")
      .max(120, "O nome pode ter no máximo 120 caracteres"),
    categoria: z
      .string()
      .trim()
      .max(60, "A categoria pode ter no máximo 60 caracteres")
      .nullish()
      .transform((v) => v || null),
    unidade: z
      .string({ error: "A unidade é obrigatória" })
      .trim()
      .min(1, "A unidade é obrigatória")
      .max(20, "A unidade pode ter no máximo 20 caracteres"),
    custo: z
      .union([z.string(), z.number()], { error: "O custo é obrigatório" })
      .transform((v, ctx) => {
        const centavos = paraCentavos(String(v));
        if (centavos === null) {
          ctx.addIssue({
            code: "custom",
            message: "Custo inválido. Use um valor como 12,50 (não pode ser negativo)",
          });
          return z.NEVER;
        }
        return centavos;
      }),
    quantidade_estoque: inteiroNaoNegativo("A quantidade em estoque").default(0),
    estoque_minimo: inteiroNaoNegativo("O estoque mínimo").default(0),
  })
  .transform(({ custo, ...resto }) => ({
    ...resto,
    custo_unitario_centavos: custo,
  }));

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
