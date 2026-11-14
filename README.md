# Estoque de Canecas

Controle simples de insumos (e, nas próximas etapas, produtos e vendas) para uso pessoal, rodando local.
Next.js + TypeScript + SQLite (`node:sqlite`, embutido no Node) + Tailwind + zod.

## Requisitos
- Node.js 24 ou superior (usa o módulo `node:sqlite`, sem dependências nativas)

## Instalar
```bash
npm install
```

## Rodar
```bash
npm run dev
```
Abra http://localhost:3000 (vai para `/insumos`).

## Telas
- **Vendas** (`/vendas`): cada lançamento é **Venda** (entregue, tira do estoque e não volta), **Pré-venda**
  (entrega futura com data prevista; já tira do estoque, cancelar devolve) ou **Rascunho** (não mexe no
  estoque). A lista mostra as pré-vendas no topo, pela entrega mais próxima. **Concluir** uma pré-venda não
  baixa de novo. Se uma venda, pré-venda ou baixa deixar o estoque negativo, aparece o aviso de para qual
  pré-venda vai faltar material (a entrega mais próxima tem prioridade) e a pré-venda fica marcada com
  "Falta". Lista com faturamento, custo e lucro (só vendas concluídas). **Nova venda** (`/vendas/nova`): escolha o kit
  (caneca branca R$ 29,90 ou caneca preta R$ 34,90, os dois já com a caixa de porcelana 325 ml), ajuste
  quantidades, adicione outros insumos (laço...) e edite o preço. Os kits já trazem 1 folha de papel de
  sublimação. Toda venda soma um custo fixo de energia de R$ 0,50 (dá para desmarcar). A venda tira os
  insumos do estoque e guarda o custo do dia; apagar a venda devolve os insumos.
  Insumos com **margem de lucro** (definida no cadastro do insumo) somam no preço quando adicionados fora do
  kit: custo × (1 + margem). Ex.: trufa de R$ 5,99 com 50% soma R$ 8,99.
- **Insumos** (`/insumos`): itens que compõem o custo dos produtos (canecas branca e preta, caixas,
  embalagens, papel, tinta, brindes). No cadastro você informa a primeira compra: **total pago** e
  **quantidade comprada** (ex.: 12 canecas por R$ 126,00 = R$ 10,50 cada). Ao digitar o nome, aparecem
  os insumos já cadastrados. A quantidade em estoque pode ficar negativa.
- **Compras do insumo** (`/insumos/:id/compras`): lance novas compras (8 em estoque + 12 comprados = 20).
  O custo do insumo é a **média ponderada** das compras. Apagar uma compra tira a quantidade do estoque.

- **Baixas** (`/baixas`): tira insumos do estoque sem venda (estrago, quebra...), com quantidade e motivo
  em texto livre. Guarda o custo médio do dia (para o futuro dashboard). Apagar a baixa devolve ao estoque.

O custo total de cada produto (soma dos insumos usados) fica na futura tela de produtos.

## Banco de dados
- Arquivo: `data/estoque.db` (criado automaticamente). Ele **vai para o git** (repositório privado);
  backups e os arquivos `-wal`/`-shm` do SQLite ficam fora.
- Antes de commitar o banco, grave as alterações pendentes no arquivo principal: `npm run db:checkpoint`.
- Para usar outro caminho: variável de ambiente `DB_PATH`.
- Migrations rodam sozinhas na primeira conexão (tabela `schema_migrations`).
  Antes de atualizar o sistema, vale fazer backup: **pare o `npm run dev`** e copie `data/estoque.db`
  (com o sistema rodando, as alterações recentes ficam no arquivo `estoque.db-wal` e a cópia sai incompleta).

## Dados de exemplo
```bash
npm run db:seed
```
Insere insumos de exemplo (caneca branca, caneca preta, caixa, plástico bolha, papel, tinta,
fita térmica, bombom). Não duplica se já existirem.

## Testes
```bash
npm test
```
Os testes usam banco em memória e não mexem em `data/estoque.db`.

## Observação
Insumos não são apagados: use **Inativar/Reativar**, para preservar o histórico de produtos e vendas.
