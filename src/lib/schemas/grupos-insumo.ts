import { z } from "zod";

export const grupoInsumoSchema = z.object({
  nome: z
    .string({ error: "O nome do grupo é obrigatório" })
    .trim()
    .min(1, "O nome do grupo é obrigatório")
    .max(60, "O nome do grupo pode ter no máximo 60 caracteres"),
});
