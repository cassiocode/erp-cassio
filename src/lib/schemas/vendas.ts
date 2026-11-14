import { z } from "zod";
import { CUSTO_ENERGIA_CENTAVOS } from "../custos";
import { hojeISO } from "../datas";
import { paraCentavos } from "../dinheiro";

const inteiroPositivo = (mensagem: string) => z.coerce.number({ error: mensagem }).int(mensagem).min(1, mensagem);

const textoOpcional = (rotulo: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${rotulo} pode ter no máximo ${max} caracteres`)
    .nullish()
    .transform((v) => v || null);

/** Venda vinda da tela: preço em texto ("29,90"), itens com insumo e quantidade. */
export const vendaSchema = z
  .object({
    data_venda: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || hojeISO())
      .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), "Data inválida"),
    kit_id: z.coerce.number().int().min(1).nullish().transform((v) => v ?? null),
    cliente: textoOpcional("O cliente", 120),
    preco_venda: z
      .union([z.string(), z.number()], { error: "O preço de venda é obrigatório" })
      .transform((v, ctx) => {
        const centavos = paraCentavos(String(v));
        if (centavos === null) {
          ctx.addIssue({ code: "custom", message: "Preço inválido. Use um valor como 29,90 (não pode ser negativo)" });
          return z.NEVER;
        }
        return centavos;
      }),
    com_energia: z.boolean().default(true),
    observacao: textoOpcional("A observação", 500),
    itens: z
      .array(
        z.object({
          insumo_id: inteiroPositivo("Escolha o insumo"),
          quantidade: inteiroPositivo("A quantidade deve ser um número inteiro de pelo menos 1"),
        }),
        { error: "Adicione pelo menos um insumo" },
      )
      .min(1, "Adicione pelo menos um insumo"),
  })
  .transform(({ preco_venda, com_energia, ...resto }) => ({
    ...resto,
    preco_venda_centavos: preco_venda,
    custo_energia_centavos: com_energia ? CUSTO_ENERGIA_CENTAVOS : 0,
  }));
