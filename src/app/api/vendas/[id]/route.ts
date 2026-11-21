import { NextResponse } from "next/server";
import { lerCorpo, lerId, respostaErros, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { hojeISO } from "@/lib/datas";
import {
  alterarDataPrevista,
  apagarVenda,
  buscarVenda,
  concluirVenda,
  ItemInvalidoError,
  salvarVenda,
  StatusInvalidoError,
} from "@/lib/db/repositories/vendas";
import { errosPorCampo } from "@/lib/schemas/comum";
import { dataEntregaSchema, vendaSchema } from "@/lib/schemas/vendas";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

function tratarErro(erro: unknown) {
  if (erro instanceof ItemInvalidoError) return respostaErros({ itens: erro.message }, 400);
  if (erro instanceof StatusInvalidoError) return respostaErros({ geral: erro.message }, 409);
  throw erro;
}

export async function GET(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const venda = buscarVenda(id);
  return venda ? NextResponse.json(venda) : respostaNaoEncontrado("Venda", "a");
}

// PUT /api/vendas/:id — altera rascunho, pré-venda ou venda (o estoque é ajustado pela diferença)
export async function PUT(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const resultado = vendaSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);
  try {
    const venda = salvarVenda(id, resultado.data);
    return venda ? NextResponse.json(venda) : respostaNaoEncontrado("Venda", "a");
  } catch (erro) {
    return tratarErro(erro);
  }
}

/**
 * PATCH /api/vendas/:id
 * - {"status":"concluida"} — conclui (entrega) o rascunho ou a pré-venda
 * - {"data_prevista":"AAAA-MM-DD"} — muda a data de entrega (tela de entregas)
 */
export async function PATCH(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const corpo = (await lerCorpo(request)) as { status?: unknown; data_prevista?: unknown };
  if (corpo.data_prevista !== undefined) {
    const data = dataEntregaSchema.safeParse(corpo.data_prevista);
    if (!data.success) return respostaErros({ data_prevista: data.error.issues[0].message }, 400);
    try {
      const venda = alterarDataPrevista(id, data.data);
      return venda ? NextResponse.json(venda) : respostaNaoEncontrado("Venda", "a");
    } catch (erro) {
      return tratarErro(erro);
    }
  }
  if (corpo.status !== "concluida") return respostaErros({ status: "Só é possível concluir a venda" }, 400);
  try {
    const venda = concluirVenda(id, hojeISO());
    return venda ? NextResponse.json(venda) : respostaNaoEncontrado("Venda", "a");
  } catch (erro) {
    return tratarErro(erro);
  }
}

// DELETE /api/vendas/:id — cancela venda ou pré-venda (devolve ao estoque) ou apaga rascunho
export async function DELETE(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  try {
    return apagarVenda(id) ? new NextResponse(null, { status: 204 }) : respostaNaoEncontrado("Venda", "a");
  } catch (erro) {
    return tratarErro(erro);
  }
}
