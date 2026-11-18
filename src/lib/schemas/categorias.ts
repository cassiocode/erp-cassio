import { z } from "zod";

export const categoriaSchema = z.object({
  nome: z
    .string({ error: "O nome é obrigatório" })
    .trim()
    .min(1, "O nome é obrigatório")
    .max(80, "O nome pode ter no máximo 80 caracteres"),
});
