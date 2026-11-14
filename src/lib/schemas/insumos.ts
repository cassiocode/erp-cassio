import { z } from "zod";
import { paraCentavos } from "../dinheiro";

const inteiroNaoNegativo = (rotulo: string) =>
  z.coerce
    .number({ error: `${rotulo} deve ser um número` })
    .int(`${rotulo} deve ser um número inteiro`)
    .min(0, `${rotulo} não pode ser negativa`);

const textoOpcional = (rotulo: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${rotulo} pode ter no máximo ${max} caracteres`)
    .nullish()
    .transform((v) => v || null);

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
    grupo_id: z.coerce
      .number({ error: "Escolha um grupo" })
      .int("Escolha um grupo")
      .min(1, "Escolha um grupo"),
    unidade: z
      .string({ error: "A unidade é obrigatória" })
      .trim()
      .min(1, "A unidade é obrigatória")
      .max(20, "A unidade pode ter no máximo 20 caracteres"),
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
    rendimento: z.coerce
      .number({ error: "O rendimento deve ser um número" })
      .int("O rendimento deve ser um número inteiro")
      .min(1, "O rendimento deve ser pelo menos 1")
      .default(1),
    quantidade_estoque: inteiroNaoNegativo("A quantidade em estoque").default(0),
    estoque_minimo: inteiroNaoNegativo("O estoque mínimo").default(0),
    fornecedor: textoOpcional("O fornecedor", 120),
    especificacao: textoOpcional("A especificação", 500),
  })
  .transform(({ valor_pago, ...resto }) => ({
    ...resto,
    valor_pago_centavos: valor_pago,
  }));
