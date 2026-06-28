const fs = require("fs/promises");
const os = require("os");
const path = require("path");

class SchemaService {
  constructor(mysqlService, tempRoot = os.tmpdir()) {
    this.mysqlService = mysqlService;
    this.tempRoot = tempRoot;
    this.schema = null;
    this.schemaFilePath = null;
  }

  async clearSchemaFile() {
    if (this.schemaFilePath) {
      await fs.rm(this.schemaFilePath, { force: true });
    }
    this.schemaFilePath = null;
    this.schema = null;
  }

  async loadSchema(database) {
    await this.clearSchemaFile();
    await this.mysqlService.useDatabase(database);

    const [columns] = await this.mysqlService.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [database]
    );

    const [foreignKeys] = await this.mysqlService.query(
      `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY TABLE_NAME, COLUMN_NAME`,
      [database]
    );

    const [indexes] = await this.mysqlService.query(
      `SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      [database]
    );

    const [tables] = await this.mysqlService.query(
      `SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS, TABLE_COMMENT
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [database]
    );

    const summary = buildSchemaSummary(database, tables, columns, foreignKeys, indexes);
    const fileName = `easy-sql-schema-${process.pid}-${Date.now()}.json`;
    this.schemaFilePath = path.join(this.tempRoot, fileName);
    this.schema = summary;
    await fs.writeFile(this.schemaFilePath, JSON.stringify(summary, null, 2), "utf8");
    return {
      database,
      schema: summary,
      tableCount: summary.tables.length,
      schemaFilePath: this.schemaFilePath
    };
  }

  getPromptSummary() {
    if (!this.schema) {
      throw new Error("No schema loaded.");
    }
    return JSON.stringify(this.schema, null, 2);
  }
}

function buildSchemaSummary(database, tableRows, columnRows, foreignKeyRows, indexRows) {
  const tablesByName = new Map();

  for (const table of tableRows) {
    tablesByName.set(table.TABLE_NAME, {
      name: table.TABLE_NAME,
      type: table.TABLE_TYPE,
      engine: table.ENGINE,
      estimatedRows: table.TABLE_ROWS,
      comment: table.TABLE_COMMENT,
      columns: [],
      primaryKeys: [],
      foreignKeys: [],
      indexes: []
    });
  }

  for (const column of columnRows) {
    const table = tablesByName.get(column.TABLE_NAME);
    if (!table) continue;
    const columnSummary = {
      name: column.COLUMN_NAME,
      type: column.COLUMN_TYPE,
      nullable: column.IS_NULLABLE === "YES",
      key: column.COLUMN_KEY,
      default: column.COLUMN_DEFAULT,
      extra: column.EXTRA
    };
    table.columns.push(columnSummary);
    if (column.COLUMN_KEY === "PRI") {
      table.primaryKeys.push(column.COLUMN_NAME);
    }
  }

  for (const fk of foreignKeyRows) {
    const table = tablesByName.get(fk.TABLE_NAME);
    if (!table) continue;
    table.foreignKeys.push({
      constraint: fk.CONSTRAINT_NAME,
      column: fk.COLUMN_NAME,
      referencesTable: fk.REFERENCED_TABLE_NAME,
      referencesColumn: fk.REFERENCED_COLUMN_NAME
    });
  }

  const indexGroups = new Map();
  for (const index of indexRows) {
    const key = `${index.TABLE_NAME}:${index.INDEX_NAME}`;
    if (!indexGroups.has(key)) {
      indexGroups.set(key, {
        tableName: index.TABLE_NAME,
        name: index.INDEX_NAME,
        unique: Number(index.NON_UNIQUE) === 0,
        columns: []
      });
    }
    indexGroups.get(key).columns.push(index.COLUMN_NAME);
  }

  for (const index of indexGroups.values()) {
    const table = tablesByName.get(index.tableName);
    if (!table) continue;
    table.indexes.push({
      name: index.name,
      unique: index.unique,
      columns: index.columns
    });
  }

  return {
    database,
    generatedAt: new Date().toISOString(),
    tables: Array.from(tablesByName.values())
  };
}

module.exports = SchemaService;
