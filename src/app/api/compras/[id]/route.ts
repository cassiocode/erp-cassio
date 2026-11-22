import { NextResponse } from "next/server";
import { lerCorpo, lerId, respostaErros, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { hojeISO } from "@/lib/datas";
import {
  alterarPrevisaoCompra,
  apagarCompra,
  CompraInvalidaError,
  marcarCompraEntregue,
} from "@/lib/db/repositories/compras";
import { dataEntregaCompraSchema } from "@/lib/schemas/insumos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

/**
 * PATCH /api/compras/:id
 * - {"entregue": true, "data_entrega"?: "AAAA-MM-DD"} — a compra pendente chegou: soma ao estoque
 * - {"data_prevista_entrega": "AAAA-MM-DD"} — muda a previsão de entrega da compra pendente
 */
export async function PATCH(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const corpo = (await lerCorpo(request)) as { entregue?: unknown; data_entrega?: unknown; data_prevista_entrega?: unknown };

  try {
    if (corpo.entregue === true) {
      const data = dataEntregaCompraSchema.safeParse(corpo.data_entrega ?? hojeISO());
      if (!data.success) return respostaErros({ data_entrega: "Data inválida" }, 400);
      const compra = marcarCompraEntregue(id, data.data);
      return compra ? NextResponse.json(compra) : respostaNaoEncontrado("Compra", "a");
    }
    if (corpo.data_prevista_entrega !== undefined) {
      const data = dataEntregaCompraSchema.safeParse(corpo.data_prevista_entrega);
      if (!data.success || !corpo.data_prevista_entrega) {
        return respostaErros({ data_prevista_entrega: "Informe a nova previsão de entrega" }, 400);
      }
      const compra = alterarPrevisaoCompra(id, data.data);
      return compra ? NextResponse.json(compra) : respostaNaoEncontrado("Compra", "a");
    }
  } catch (erro) {
    if (erro instanceof CompraInvalidaError) return respostaErros({ geral: erro.message }, 409);
    throw erro;
  }
  return respostaErros({ geral: 'Envie {"entregue": true} ou {"data_prevista_entrega": "AAAA-MM-DD"}' }, 400);
}

// DELETE /api/compras/:id — apaga a compra (se já tinha chegado, a quantidade sai do estoque)
export async function DELETE(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  return apagarCompra(id) ? new NextResponse(null, { status: 204 }) : respostaNaoEncontrado("Compra", "a");
}
