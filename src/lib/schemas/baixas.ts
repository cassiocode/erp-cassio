import { z } from "zod";
import { hojeISO } from "../datas";

/** Baixa de estoque vinda da tela: insumo, quantidade, motivo (texto livre) e data. */
export const baixaSchema = z.object({
  insumo_id: z.coerce.number({ error: "Escolha o insumo" }).int("Escolha o insumo").min(1, "Escolha o insumo"),
  quantidade: z.coerce
    .number({ error: "A quantidade deve ser um número" })
    .int("A quantidade deve ser um número inteiro")
    .min(1, "A quantidade deve ser pelo menos 1"),
  motivo: z
    .string({ error: "Informe o motivo da baixa" })
    .trim()
    .min(1, "Informe o motivo da baixa")
    .max(500, "O motivo pode ter no máximo 500 caracteres"),
  data_baixa: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || hojeISO())
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), "Data inválida"),
});
