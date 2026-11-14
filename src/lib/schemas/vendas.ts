import { z } from "zod";
import { CUSTO_ENERGIA_CENTAVOS } from "../custos";
import { hojeISO } from "../datas";
import { lerPercentual } from "../descontos";
import { paraCentavos } from "../dinheiro";

const inteiroPositivo = (mensagem: string) => z.coerce.number({ error: mensagem }).int(mensagem).min(1, mensagem);

const textoOpcional = (rotulo: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${rotulo} pode ter no máximo ${max} caracteres`)
    .nullish()
    .transform((v) => v || null);

const dataValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const itensSchema = z
  .array(
    z.object({
      insumo_id: inteiroPositivo("Escolha o insumo"),
      quantidade: inteiroPositivo("A quantidade deve ser um número inteiro de pelo menos 1"),
    }),
    { error: "Adicione pelo menos um insumo" },
  )
  .min(1, "Adicione pelo menos um insumo");

const statusSchema = z.enum(["rascunho", "pre_venda", "concluida"], { error: "Status inválido" });

const dataPrevista = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || dataValida(v), "Data de entrega inválida");

/** Venda vinda da tela: preço em texto ("29,90"), itens com insumo e quantidade. */
export const vendaSchema = z
  .object({
    status: statusSchema.default("concluida"),
    data_prevista: dataPrevista,
    data_venda: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || hojeISO())
      .refine(dataValida, "Data inválida"),
    kits: z
      .array(
        z.object({
          kit_id: inteiroPositivo("Kit inválido"),
          quantidade: inteiroPositivo("A quantidade de canecas deve ser um número inteiro de pelo menos 1"),
        }),
      )
      .default([]),
    desconto_percentual: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v, ctx) => {
        const n = lerPercentual(String(v ?? ""));
        if (n === null) {
          ctx.addIssue({ code: "custom", message: "Desconto inválido. Use um número de 0 a 100, como 5 ou 20" });
          return z.NEVER;
        }
        return n;
      }),
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
    itens: itensSchema,
  })
  .refine((v) => v.status !== "pre_venda" || v.data_prevista !== null, {
    path: ["data_prevista"],
    message: "Informe a data prevista de entrega da pré-venda",
  })
  .transform(({ preco_venda, com_energia, ...resto }) => ({
    ...resto,
    preco_venda_centavos: preco_venda,
    custo_energia_centavos: com_energia ? CUSTO_ENERGIA_CENTAVOS : 0,
  }));

/** Pedido de alerta antes de salvar uma venda ou dar uma baixa: o que vai sair do estoque. */
export const alertaEstoqueSchema = z.object({
  venda_id: z.coerce.number().int().min(1).nullish().transform((v) => v ?? null),
  status: statusSchema.default("concluida"),
  data_prevista: dataPrevista,
  cliente: textoOpcional("O cliente", 120),
  itens: itensSchema,
});
