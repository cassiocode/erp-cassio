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
