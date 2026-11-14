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
- **Insumos** (`/insumos`): itens que compõem o custo dos produtos (canecas branca e preta, caixas,
  embalagens, papel, tinta, brindes). Cada insumo tem **valor pago** e **rendimento**; o sistema calcula
  o **custo por unidade** (ex.: pacote de papel R$ 45,00 que rende 100 folhas = R$ 0,45 por folha).
- **Grupos de insumo** (`/insumos/grupos`): grupos cadastrados conforme a necessidade (Caneca, Embalagem...).

O custo total de cada produto (soma dos insumos usados) fica na futura tela de produtos.

## Banco de dados
- Arquivo: `data/estoque.db` (criado automaticamente; a pasta `data/` não vai para o git).
- Para usar outro caminho: variável de ambiente `DB_PATH`.
- Migrations rodam sozinhas na primeira conexão (tabela `schema_migrations`).
  Antes de atualizar o sistema, vale copiar `data/estoque.db` como backup.

## Dados de exemplo
```bash
npm run db:seed
```
Insere grupos e insumos de exemplo (caneca branca, caneca preta, caixa, plástico bolha, papel, tinta,
fita térmica, bombom). Não duplica se já existirem.

## Testes
```bash
npm test
```
Os testes usam banco em memória e não mexem em `data/estoque.db`.

## Observação
Insumos e grupos não são apagados: use **Inativar/Reativar**, para preservar o histórico de produtos e vendas.
