import { NextResponse } from "next/server";
import { lerCorpo, respostaErros } from "@/lib/api";
import { faltasAoSalvar } from "@/lib/db/repositories/vendas";
import { errosPorCampo } from "@/lib/schemas/comum";
import { alertaEstoqueSchema } from "@/lib/schemas/vendas";

export const dynamic = "force-dynamic";

/**
 * POST /api/estoque/alertas — antes de salvar uma venda/pré-venda ou dar uma baixa, diz para quais
 * pré-vendas vai faltar material. Não grava nada. Para baixa, mande status "concluida" e os itens.
 */
export async function POST(request: Request) {
  const resultado = alertaEstoqueSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);
  const { venda_id, ...dados } = resultado.data;
  return NextResponse.json(faltasAoSalvar(venda_id, dados));
}
