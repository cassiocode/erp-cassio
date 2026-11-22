import { z } from "zod";
import { hojeISO } from "../datas";
import { paraCentavos } from "../dinheiro";

const nome = z
  .string({ error: "O nome é obrigatório" })
  .trim()
  .min(1, "O nome é obrigatório")
  .max(120, "O nome pode ter no máximo 120 caracteres");

/** Valor em reais digitado ("126,00") -> centavos. */
const valorPago = z
  .union([z.string(), z.number()], { error: "O total pago é obrigatório" })
  .transform((v, ctx) => {
    const centavos = paraCentavos(String(v));
    if (centavos === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Use um valor como 12,50 (não pode ser negativo)" });
      return z.NEVER;
    }
    return centavos;
  });

const quantidadeComprada = z.coerce
  .number({ error: "A quantidade comprada deve ser um número" })
  .int("A quantidade comprada deve ser um número inteiro")
  .min(1, "A quantidade comprada deve ser pelo menos 1");

const dataCompra = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || hojeISO())
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), "Data inválida");

/** "Já chegou?" (padrão: sim). */
const entregue = z.boolean({ error: "Informe se a compra já chegou" }).default(true);

const dataPrevistaEntrega = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Data inválida");

/** Compra pendente de entrega precisa da previsão; a que já chegou não guarda previsão. */
function exigirPrevisao(dados: { entregue: boolean; data_prevista_entrega: string | null }, ctx: z.RefinementCtx) {
  if (!dados.entregue && !dados.data_prevista_entrega) {
    ctx.addIssue({ code: "custom", path: ["data_prevista_entrega"], message: "Informe a previsão de entrega" });
  }
}

const observacao = z
  .string()
  .trim()
  .max(500, "A observação pode ter no máximo 500 caracteres")
  .nullish()
  .transform((v) => v || null);

/** Margem de lucro em % ("50", "33,5"). Vazio = sem margem (null). */
const margemLucro = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v, ctx) => {
    const texto = String(v ?? "").trim().replace("%", "").replace(",", ".").trim();
    if (texto === "") return null;
    const numero = Number(texto);
    if (!Number.isFinite(numero) || numero < 0 || numero > 1000) {
      ctx.addIssue({ code: "custom", message: "Margem inválida. Use um número como 50 ou 33,5 (de 0 a 1000)" });
      return z.NEVER;
    }
    return Math.round(numero * 100) / 100;
  });

/** Categoria escolhida no cadastro (obrigatória). */
const categoria = z.coerce
  .number({ error: "Escolha a categoria" })
  .int("Escolha a categoria")
  .positive("Escolha a categoria");

/** Cadastro de insumo novo: o total pago e a quantidade viram a primeira compra. */
export const novoInsumoSchema = z
  .object({
    nome,
    valor_pago: valorPago,
    quantidade_comprada: quantidadeComprada.default(1),
    data_compra: dataCompra,
    observacao,
    margem_lucro: margemLucro,
    categoria_id: categoria,
    entregue,
    data_prevista_entrega: dataPrevistaEntrega,
  })
  .superRefine(exigirPrevisao)
  .transform(({ valor_pago, margem_lucro, ...resto }) => ({
    ...resto,
    valor_pago_centavos: valor_pago,
    margem_lucro_percentual: margem_lucro,
  }));

/** Edição do insumo. Estoque pode ser negativo (ex.: usou antes de lançar a compra). */
export const edicaoInsumoSchema = z
  .object({
    nome,
    quantidade_estoque: z.coerce
      .number({ error: "A quantidade em estoque deve ser um número" })
      .int("A quantidade em estoque deve ser um número inteiro"),
    observacao,
    margem_lucro: margemLucro,
    categoria_id: categoria,
  })
  .transform(({ margem_lucro, ...resto }) => ({ ...resto, margem_lucro_percentual: margem_lucro }));

/** Nova compra de um insumo já cadastrado. */
export const compraSchema = z
  .object({
    data_compra: dataCompra,
    quantidade: quantidadeComprada,
    valor_pago: valorPago,
    observacao,
    entregue,
    data_prevista_entrega: dataPrevistaEntrega,
  })
  .superRefine(exigirPrevisao)
  .transform(({ valor_pago, ...resto }) => ({ ...resto, valor_pago_centavos: valor_pago }));

/** Data da entrega/previsão na tela de compras (vazio = hoje). */
export const dataEntregaCompraSchema = dataCompra;
