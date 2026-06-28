const path = require("path");
const { createRequire } = require("module");

const runtimeRequire = createRequire(path.join(__dirname, "../../.runtime/app/package.json"));
const mysql = runtimeRequire("mysql2/promise");

class MysqlService {
  constructor() {
    this.connection = null;
    this.config = null;
    this.currentDatabase = null;
  }

  async connect({ host, port, user, password }) {
    await this.close();
    const normalizedHost = String(host || "localhost").trim();
    this.config = {
      host: String(host || "localhost").trim(),
      port: Number(port || 3306),
      user: String(user || "").trim(),
      password: String(password || ""),
      waitForConnections: true,
      connectTimeout: 10000,
      multipleStatements: false,
      namedPlaceholders: false,
      timezone: "local"
    };

    try {
      this.connection = await mysql.createConnection(this.config);
      await this.connection.ping();
    } catch (error) {
      if (normalizedHost.toLowerCase() === "localhost") {
        this.config.host = "127.0.0.1";
        this.connection = await mysql.createConnection(this.config);
        await this.connection.ping();
      } else {
        throw error;
      }
    }
    return this.listDatabases();
  }

  async ensureConnection() {
    if (!this.connection) {
      throw new Error("Not connected to MySQL.");
    }

    try {
      await this.connection.ping();
    } catch {
      this.connection = await mysql.createConnection({
        ...this.config,
        database: this.currentDatabase || undefined
      });
    }

    return this.connection;
  }

  async listDatabases() {
    const connection = await this.ensureConnection();
    const [rows] = await connection.query("SHOW DATABASES");
    return rows.map((row) => row.Database || row.database || Object.values(row)[0]).filter(Boolean);
  }

  async useDatabase(database) {
    const connection = await this.ensureConnection();
    const dbName = String(database || "").trim();
    if (!dbName) {
      throw new Error("Database is required.");
    }
    await connection.changeUser({
      user: this.config.user,
      password: this.config.password,
      database: dbName
    });
    this.currentDatabase = dbName;
    return dbName;
  }

  async query(sql, params = [], options = {}) {
    const connection = await this.ensureConnection();
    const timeout = Number(options.timeout || 30000);
    return connection.query({ sql, timeout, rowsAsArray: false }, params);
  }

  async executeUserSql(sql) {
    const connection = await this.ensureConnection();
    return connection.query({
      sql,
      timeout: 30000,
      multipleStatements: false
    });
  }

  async close() {
    if (this.connection) {
      try {
        await this.connection.end();
      } catch {
        this.connection.destroy();
      }
    }
    this.connection = null;
    this.currentDatabase = null;
  }
}

module.exports = MysqlService;
