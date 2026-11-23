import { z } from "zod";
import { paraCentavos } from "../dinheiro";

/** Kit (padrão da venda): nome, preço da caneca e as categorias que entram em cada uma. */
export const kitSchema = z
  .object({
    nome: z
      .string({ error: "O nome é obrigatório" })
      .trim()
      .min(1, "O nome é obrigatório")
      .max(80, "O nome pode ter no máximo 80 caracteres"),
    preco_venda: z.union([z.string(), z.number()], { error: "O preço é obrigatório" }).transform((v, ctx) => {
      const centavos = paraCentavos(String(v));
      if (centavos === null) {
        ctx.addIssue({ code: "custom", message: "Preço inválido. Use um valor como 34,90" });
        return z.NEVER;
      }
      return centavos;
    }),
    ativo: z.boolean().default(true),
    itens: z
      .array(
        z.object({
          categoria_id: z.coerce.number().int().positive("Escolha a categoria"),
          quantidade: z.coerce
            .number({ error: "A quantidade deve ser um número" })
            .int("A quantidade deve ser um número inteiro")
            .min(1, "A quantidade deve ser pelo menos 1"),
        }),
        { error: "Informe os itens do kit" },
      )
      .min(1, "Coloque pelo menos uma categoria no kit"),
  })
  .transform(({ preco_venda, ...resto }) => ({ ...resto, preco_venda_centavos: preco_venda }));
