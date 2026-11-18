import { hojeISO } from "../src/lib/datas";
import { caminhoDoBanco } from "../src/lib/db/connection";
import { NomeDuplicadoError } from "../src/lib/db/erros";
import { criarCategoria, listarCategorias } from "../src/lib/db/repositories/categorias";
import { criarInsumo } from "../src/lib/db/repositories/insumos";

/** Id da categoria pelo nome (cria se não existir). */
function categoria(nome: string): number {
  return listarCategorias().find((c) => c.nome.toLowerCase() === nome.toLowerCase())?.id ?? criarCategoria(nome).id;
}

// Valores de exemplo: ajuste depois pela tela de insumos. Cada um vira a primeira compra do insumo.
const exemplos = [
  { nome: "Caneca branca 325ml", categoria: "Caneca cor branca", valor_pago_centavos: 12600, quantidade_comprada: 12, observacao: "Cerâmica branca para sublimação, classe AAA" },
  { nome: "Caneca preta 325ml", categoria: "Caneca Cor Preta c/ Tarja Branca", valor_pago_centavos: 20280, quantidade_comprada: 12, observacao: "Cerâmica preta com área para sublimação" },
  { nome: "Caixa para caneca", categoria: "Caixa para caneca", valor_pago_centavos: 12000, quantidade_comprada: 25, observacao: null },
  { nome: "Plástico bolha", categoria: "Embalagem", valor_pago_centavos: 1890, quantidade_comprada: 20, observacao: "Rolo que embala cerca de 20 canecas" },
  { nome: "Papel sublimático A4", categoria: "Papel de sublimação", valor_pago_centavos: 4500, quantidade_comprada: 100, observacao: "Pacote com 100 folhas" },
  { nome: "Tinta sublimática (kit 4 cores)", categoria: "Tinta de sublimação", valor_pago_centavos: 12000, quantidade_comprada: 400, observacao: "Rende cerca de 400 canecas" },
  { nome: "Fita térmica", categoria: "Outros", valor_pago_centavos: 1800, quantidade_comprada: 200, observacao: null },
  { nome: "Bombom", categoria: "Chocolate", valor_pago_centavos: 3000, quantidade_comprada: 20, observacao: null },
];

let criados = 0;
for (const insumo of exemplos) {
  try {
    const { categoria: nomeCategoria, ...dados } = insumo;
    criarInsumo({ ...dados, categoria_id: categoria(nomeCategoria), data_compra: hojeISO() });
    criados++;
  } catch (erro) {
    if (!(erro instanceof NomeDuplicadoError)) throw erro;
  }
}

console.log(`Seed concluído em ${caminhoDoBanco()}: ${criados} criado(s), ${exemplos.length - criados} já existia(m).`);
