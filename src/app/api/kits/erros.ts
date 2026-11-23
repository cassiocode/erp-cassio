import { NomeDuplicadoError } from "@/lib/db/erros";
import { CategoriaInvalidaError } from "@/lib/db/repositories/kits";
import { respostaErros } from "@/lib/api";

/** Erros de negócio do kit como resposta da API. */
export function erroDoKit(erro: unknown) {
  if (erro instanceof NomeDuplicadoError) return respostaErros({ nome: erro.message }, 409);
  if (erro instanceof CategoriaInvalidaError) return respostaErros({ itens: erro.message }, 400);
  throw erro;
}

