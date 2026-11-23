import { NextResponse } from "next/server";
import { lerCorpo, lerId, respostaErros, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { buscarKitCadastro, salvarKit } from "@/lib/db/repositories/kits";
import { errosPorCampo } from "@/lib/schemas/comum";
import { kitSchema } from "@/lib/schemas/kits";
import { erroDoKit } from "../erros";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const kit = buscarKitCadastro(id);
  return kit ? NextResponse.json(kit) : respostaNaoEncontrado("Kit");
}

// PUT /api/kits/:id — altera nome, preço, ativo e categorias (vendas já gravadas não mudam)
export async function PUT(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const resultado = kitSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);
  try {
    const kit = salvarKit(id, resultado.data);
    return kit ? NextResponse.json(kit) : respostaNaoEncontrado("Kit");
  } catch (erro) {
    return erroDoKit(erro);
  }
}
