import { z } from "zod";
import { paraCentavos } from "../dinheiro";

/**
 * Entrada da API/formulário de insumo.
 * O valor pago chega como texto ("45,00") e sai em centavos.
 */
export const insumoSchema = z
  .object({
    nome: z
      .string({ error: "O nome é obrigatório" })
      .trim()
      .min(1, "O nome é obrigatório")
      .max(120, "O nome pode ter no máximo 120 caracteres"),
    valor_pago: z
      .union([z.string(), z.number()], { error: "O valor pago é obrigatório" })
      .transform((v, ctx) => {
        const centavos = paraCentavos(String(v));
        if (centavos === null) {
          ctx.addIssue({
            code: "custom",
            message: "Valor inválido. Use um valor como 12,50 (não pode ser negativo)",
          });
          return z.NEVER;
        }
        return centavos;
      }),
    quantidade_comprada: z.coerce
      .number({ error: "A quantidade comprada deve ser um número" })
      .int("A quantidade comprada deve ser um número inteiro")
      .min(1, "A quantidade comprada deve ser pelo menos 1")
      .default(1),
    // Pode ser negativa (ex.: vendeu antes de lançar a compra)
    quantidade_estoque: z.coerce
      .number({ error: "A quantidade em estoque deve ser um número" })
      .int("A quantidade em estoque deve ser um número inteiro")
      .default(0),
    observacao: z
      .string()
      .trim()
      .max(500, "A observação pode ter no máximo 500 caracteres")
      .nullish()
      .transform((v) => v || null),
  })
  .transform(({ valor_pago, ...resto }) => ({
    ...resto,
    valor_pago_centavos: valor_pago,
  }));
