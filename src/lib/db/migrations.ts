import type { DatabaseSync } from "node:sqlite";

interface Migration {
  versao: number;
  nome: string;
  sql: string;
}

/**
 * Lista de migrations em ordem. Para mudar o banco no futuro (vendas, etc.),
 * adicione uma nova entrada com versão maior. Nunca edite uma já aplicada.
 */
const migrations: Migration[] = [
  {
    versao: 1,
    nome: "criar_materiais",
    sql: `
      CREATE TABLE materiais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        categoria TEXT,
        unidade TEXT NOT NULL,
        custo_unitario_centavos INTEGER NOT NULL CHECK (custo_unitario_centavos >= 0),
        quantidade_estoque INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_estoque >= 0),
        estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
        ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_materiais_nome ON materiais (nome COLLATE NOCASE);
    `,
  },
  {
    versao: 2,
    nome: "insumos_e_grupos_insumo",
    sql: `
      CREATE TABLE grupos_insumo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_grupos_insumo_nome ON grupos_insumo (nome COLLATE NOCASE);

      -- As categorias de texto viram grupos
      INSERT INTO grupos_insumo (nome, criado_em, atualizado_em)
        SELECT trim(categoria), MIN(criado_em), MIN(criado_em)
          FROM materiais
         WHERE categoria IS NOT NULL AND trim(categoria) <> ''
         GROUP BY lower(trim(categoria));

      -- Materiais sem categoria vão para "Outros"
      INSERT INTO grupos_insumo (nome, criado_em, atualizado_em)
        SELECT 'Outros', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE EXISTS (SELECT 1 FROM materiais WHERE categoria IS NULL OR trim(categoria) = '')
           AND NOT EXISTS (SELECT 1 FROM grupos_insumo WHERE nome = 'Outros' COLLATE NOCASE);

      CREATE TABLE insumos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        grupo_id INTEGER NOT NULL REFERENCES grupos_insumo (id),
        unidade TEXT NOT NULL,
        valor_pago_centavos INTEGER NOT NULL CHECK (valor_pago_centavos >= 0),
        rendimento INTEGER NOT NULL DEFAULT 1 CHECK (rendimento >= 1),
        custo_unitario_centavos INTEGER NOT NULL CHECK (custo_unitario_centavos >= 0),
        quantidade_estoque INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_estoque >= 0),
        estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
        fornecedor TEXT,
        especificacao TEXT,
        ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_insumos_nome ON insumos (nome COLLATE NOCASE);
      CREATE INDEX idx_insumos_grupo ON insumos (grupo_id);

      -- Copia os materiais mantendo os ids (rendimento 1 = valor pago já era o custo por unidade)
      INSERT INTO insumos (
        id, nome, grupo_id, unidade, valor_pago_centavos, rendimento, custo_unitario_centavos,
        quantidade_estoque, estoque_minimo, ativo, criado_em, atualizado_em
      )
      SELECT
        m.id, m.nome,
        COALESCE(
          (SELECT g.id FROM grupos_insumo g WHERE g.nome = trim(m.categoria) COLLATE NOCASE),
          (SELECT g.id FROM grupos_insumo g WHERE g.nome = 'Outros' COLLATE NOCASE)
        ),
        m.unidade, m.custo_unitario_centavos, 1, m.custo_unitario_centavos,
        m.quantidade_estoque, m.estoque_minimo, m.ativo, m.criado_em, m.atualizado_em
      FROM materiais m;

      DROP TABLE materiais;
    `,
  },
  {
    versao: 3,
    nome: "simplificar_insumos",
    // Grupo, unidade, fornecedor e estoque mínimo saem; rendimento vira "quantidade comprada"
    // (12 canecas por R$ 126,00 = R$ 10,50 cada); especificação vira observação;
    // estoque pode ficar negativo.
    // O SQLite não remove CHECK com ALTER TABLE, então a tabela é recriada (ids mantidos).
    sql: `
      CREATE TABLE insumos_novo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        valor_pago_centavos INTEGER NOT NULL CHECK (valor_pago_centavos >= 0),
        quantidade_comprada INTEGER NOT NULL DEFAULT 1 CHECK (quantidade_comprada >= 1),
        custo_unitario_centavos INTEGER NOT NULL CHECK (custo_unitario_centavos >= 0),
        quantidade_estoque INTEGER NOT NULL DEFAULT 0,
        observacao TEXT,
        ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );

      INSERT INTO insumos_novo (
        id, nome, valor_pago_centavos, quantidade_comprada, custo_unitario_centavos,
        quantidade_estoque, observacao, ativo, criado_em, atualizado_em
      )
      SELECT id, nome, valor_pago_centavos, rendimento, custo_unitario_centavos,
             quantidade_estoque, especificacao, ativo, criado_em, atualizado_em
        FROM insumos;

      DROP TABLE insumos;
      DROP TABLE grupos_insumo;
      ALTER TABLE insumos_novo RENAME TO insumos;
      CREATE UNIQUE INDEX idx_insumos_nome ON insumos (nome COLLATE NOCASE);
    `,
  },
  {
    versao: 4,
    nome: "compras_insumo",
    // Cada compra soma ao estoque; o custo do insumo passa a ser a média ponderada das compras.
    // O total pago/quantidade de cada insumo vira a primeira compra dele (o estoque atual não muda).
    sql: `
      CREATE TABLE compras_insumo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        insumo_id INTEGER NOT NULL REFERENCES insumos (id),
        data_compra TEXT NOT NULL, -- AAAA-MM-DD
        quantidade INTEGER NOT NULL CHECK (quantidade >= 1),
        valor_pago_centavos INTEGER NOT NULL CHECK (valor_pago_centavos >= 0),
        observacao TEXT,
        criado_em TEXT NOT NULL
      );
      CREATE INDEX idx_compras_insumo_insumo ON compras_insumo (insumo_id);

      INSERT INTO compras_insumo (insumo_id, data_compra, quantidade, valor_pago_centavos, criado_em)
        SELECT id, substr(criado_em, 1, 10), quantidade_comprada, valor_pago_centavos, criado_em
          FROM insumos;

      ALTER TABLE insumos DROP COLUMN valor_pago_centavos;
      ALTER TABLE insumos DROP COLUMN quantidade_comprada;
      ALTER TABLE insumos DROP COLUMN custo_unitario_centavos;
    `,
  },
  {
    versao: 5,
    nome: "kits_e_vendas",
    // Kit = pré-definição da venda (caneca + caixa + preço sugerido).
    // A venda guarda uma cópia dos itens e do custo de cada insumo no dia, para o lucro não mudar depois.
    sql: `
      CREATE TABLE kits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        preco_venda_centavos INTEGER NOT NULL CHECK (preco_venda_centavos >= 0),
        ordem INTEGER NOT NULL DEFAULT 0,
        ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
      );
      CREATE UNIQUE INDEX idx_kits_nome ON kits (nome COLLATE NOCASE);

      CREATE TABLE kit_itens (
        kit_id INTEGER NOT NULL REFERENCES kits (id),
        insumo_id INTEGER NOT NULL REFERENCES insumos (id),
        quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade >= 1),
        PRIMARY KEY (kit_id, insumo_id)
      );

      CREATE TABLE vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_venda TEXT NOT NULL, -- AAAA-MM-DD
        kit_id INTEGER REFERENCES kits (id),
        cliente TEXT,
        preco_venda_centavos INTEGER NOT NULL CHECK (preco_venda_centavos >= 0),
        observacao TEXT,
        criado_em TEXT NOT NULL
      );
      CREATE INDEX idx_vendas_data ON vendas (data_venda);

      CREATE TABLE venda_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER NOT NULL REFERENCES vendas (id),
        insumo_id INTEGER NOT NULL REFERENCES insumos (id),
        quantidade INTEGER NOT NULL CHECK (quantidade >= 1),
        custo_unitario_centavos INTEGER NOT NULL CHECK (custo_unitario_centavos >= 0)
      );
      CREATE INDEX idx_venda_itens_venda ON venda_itens (venda_id);

      -- Kits padrão: caneca branca R$ 29,90 e caneca preta R$ 34,90, cada um com a caixa de porcelana 325 ml
      INSERT INTO kits (nome, preco_venda_centavos, ordem) VALUES ('Caneca branca', 2990, 1), ('Caneca preta', 3490, 2);

      -- Liga cada kit ao insumo pelo começo do nome (o primeiro ativo que achar; se não achar, fica sem)
      INSERT INTO kit_itens (kit_id, insumo_id)
        SELECT kit_id, insumo_id FROM (
          SELECT k.id AS kit_id,
                 (SELECT MIN(i.id) FROM insumos i WHERE i.ativo = 1 AND lower(i.nome) LIKE 'caneca branca%') AS insumo_id
            FROM kits k WHERE k.nome = 'Caneca branca'
          UNION ALL
          SELECT k.id, (SELECT MIN(i.id) FROM insumos i WHERE i.ativo = 1 AND lower(i.nome) LIKE 'caneca preta%')
            FROM kits k WHERE k.nome = 'Caneca preta'
          UNION ALL
          SELECT k.id, (SELECT MIN(i.id) FROM insumos i WHERE i.ativo = 1 AND lower(i.nome) LIKE 'caixa para caneca%')
            FROM kits k
        ) WHERE insumo_id IS NOT NULL;
    `,
  },
  {
    versao: 6,
    nome: "papel_sublimacao_nos_kits",
    sql: `
      -- Toda caneca vendida gasta 1 folha de papel de sublimação (o primeiro papel ativo que achar)
      INSERT OR IGNORE INTO kit_itens (kit_id, insumo_id, quantidade)
        SELECT k.id, p.id, 1
          FROM kits k,
               (SELECT MIN(i.id) AS id FROM insumos i WHERE i.ativo = 1 AND lower(i.nome) LIKE 'papel%sublima%') p
         WHERE p.id IS NOT NULL;
    `,
  },
  {
    versao: 7,
    nome: "custo_energia_na_venda",
    sql: `
      -- Custo fixo de energia guardado em cada venda (0 = sem energia). Vendas antigas ficam com 0.
      ALTER TABLE vendas ADD COLUMN custo_energia_centavos INTEGER NOT NULL DEFAULT 0
        CHECK (custo_energia_centavos >= 0);
    `,
  },
  {
    versao: 8,
    nome: "baixas_estoque",
    sql: `
      -- Baixa de estoque: insumo perdido/estragado/usado fora de venda. Tira a quantidade do estoque.
      CREATE TABLE baixas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        insumo_id INTEGER NOT NULL REFERENCES insumos (id),
        data_baixa TEXT NOT NULL, -- AAAA-MM-DD
        quantidade INTEGER NOT NULL CHECK (quantidade >= 1),
        motivo TEXT NOT NULL,
        custo_unitario_centavos INTEGER NOT NULL CHECK (custo_unitario_centavos >= 0), -- custo médio no dia
        criado_em TEXT NOT NULL
      );
      CREATE INDEX idx_baixas_insumo ON baixas (insumo_id);
      CREATE INDEX idx_baixas_data ON baixas (data_baixa);
    `,
  },
  {
    versao: 9,
    nome: "margem_lucro_insumo",
    sql: `
      -- Margem de lucro (%) opcional do insumo, usada só na venda: o insumo extra entra no preço com a margem.
      -- NULL = sem margem (não mexe no preço da venda).
      ALTER TABLE insumos ADD COLUMN margem_lucro_percentual REAL CHECK (margem_lucro_percentual >= 0);
    `,
  },
  {
    versao: 10,
    nome: "status_e_entrega_da_venda",
    sql: `
      -- rascunho: não mexe no estoque | pre_venda: já tirou do estoque, entrega futura | concluida: entregue
      ALTER TABLE vendas ADD COLUMN status TEXT NOT NULL DEFAULT 'concluida'
        CHECK (status IN ('rascunho', 'pre_venda', 'concluida'));
      ALTER TABLE vendas ADD COLUMN data_prevista TEXT; -- AAAA-MM-DD, previsão de entrega
      CREATE INDEX idx_vendas_status_prevista ON vendas (status, data_prevista);
    `,
  },
  {
    versao: 11,
    nome: "kits_com_quantidade_e_desconto",
    sql: `
      -- Uma venda pode ter vários kits (ex.: 2 canecas brancas + 2 pretas), cada um com quantidade
      CREATE TABLE venda_kits (
        venda_id INTEGER NOT NULL REFERENCES vendas (id),
        kit_id INTEGER NOT NULL REFERENCES kits (id),
        quantidade INTEGER NOT NULL CHECK (quantidade >= 1),
        preco_unitario_centavos INTEGER NOT NULL CHECK (preco_unitario_centavos >= 0), -- preço do kit no dia
        PRIMARY KEY (venda_id, kit_id)
      );
      -- Vendas antigas: 1 unidade do kit que já tinham
      INSERT INTO venda_kits (venda_id, kit_id, quantidade, preco_unitario_centavos)
        SELECT v.id, v.kit_id, 1, k.preco_venda_centavos FROM vendas v JOIN kits k ON k.id = v.kit_id;

      -- Desconto sobre o preço dos kits (progressivo ou digitado). Vendas antigas: sem desconto.
      ALTER TABLE vendas ADD COLUMN desconto_percentual REAL NOT NULL DEFAULT 0
        CHECK (desconto_percentual >= 0 AND desconto_percentual <= 100);
      ALTER TABLE vendas ADD COLUMN desconto_centavos INTEGER NOT NULL DEFAULT 0 CHECK (desconto_centavos >= 0);
    `,
  },
  {
    versao: 12,
    nome: "valor_ja_pago_da_venda",
    sql: `
      -- Quanto o cliente já pagou (sinal da pré-venda). O que falta = preço - pago.
      ALTER TABLE vendas ADD COLUMN valor_pago_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_pago_centavos >= 0);
    `,
  },
];

/** Aplica as migrations pendentes. `ateVersao` existe só para testar a migração passo a passo. */
export function rodarMigrations(db: DatabaseSync, ateVersao = Infinity): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      versao INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      aplicada_em TEXT NOT NULL
    )
  `);

  const aplicadas = new Set(
    db
      .prepare("SELECT versao FROM schema_migrations")
      .all()
      .map((linha) => Number(linha.versao)),
  );

  const registrar = db.prepare(
    "INSERT INTO schema_migrations (versao, nome, aplicada_em) VALUES (?, ?, ?)",
  );

  for (const m of migrations) {
    if (aplicadas.has(m.versao) || m.versao > ateVersao) continue;

    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      registrar.run(m.versao, m.nome, new Date().toISOString());
      db.exec("COMMIT");
    } catch (erro) {
      db.exec("ROLLBACK");
      throw erro;
    }
  }
}
