import { NextResponse } from "next/server";

/** Lê um id de rota (/api/x/[id]); null se não for inteiro positivo. */
export function lerId(texto: string): number | null {
  const id = Number(texto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function respostaErros(erros: Record<string, string>, status: number) {
  return NextResponse.json({ erros }, { status });
}

export const respostaIdInvalido = () => respostaErros({ geral: "ID inválido" }, 400);

export const respostaNaoEncontrado = (oque: string) =>
  respostaErros({ geral: `${oque} não encontrado` }, 404);

/** Lê o corpo JSON; devolve {} se vier vazio ou inválido (o zod reporta os campos faltando). */
export async function lerCorpo(request: Request): Promise<unknown> {
  return (await request.json().catch(() => null)) ?? {};
}
