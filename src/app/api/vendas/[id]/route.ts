import { NextResponse } from "next/server";
import { lerCorpo, lerId, respostaErros, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { hojeISO } from "@/lib/datas";
import {
  apagarVenda,
  buscarVenda,
  concluirVenda,
  ItemInvalidoError,
  salvarVenda,
  StatusInvalidoError,
} from "@/lib/db/repositories/vendas";
import { errosPorCampo } from "@/lib/schemas/comum";
import { vendaSchema } from "@/lib/schemas/vendas";

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

// PUT /api/vendas/:id — altera rascunho ou pré-venda (o estoque é ajustado pela diferença)
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

// PATCH /api/vendas/:id {"status":"concluida"} — conclui (entrega) o rascunho ou a pré-venda
export async function PATCH(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const corpo = (await lerCorpo(request)) as { status?: unknown };
  if (corpo.status !== "concluida") return respostaErros({ status: "Só é possível concluir a venda" }, 400);
  try {
    const venda = concluirVenda(id, hojeISO());
    return venda ? NextResponse.json(venda) : respostaNaoEncontrado("Venda", "a");
  } catch (erro) {
    return tratarErro(erro);
  }
}

// DELETE /api/vendas/:id — apaga rascunho ou cancela pré-venda (devolve ao estoque); concluída: 409
export async function DELETE(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  try {
    return apagarVenda(id) ? new NextResponse(null, { status: 204 }) : respostaNaoEncontrado("Venda", "a");
  } catch (erro) {
    return tratarErro(erro);
  }
}
