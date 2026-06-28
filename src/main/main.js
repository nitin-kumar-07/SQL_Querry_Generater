const path = require("path");
const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const MysqlService = require("./mysqlService");
const SchemaService = require("./schemaService");
const HistoryService = require("./historyService");
const { fetchModels, generateSql } = require("./ollamaService");
const {
  READ_QUERY,
  WRITE_OR_STRUCTURE_QUERY,
  classifySql,
  hasMultipleStatements,
  hasSelectLimit
} = require("./queryClassifier");

const mysqlService = new MysqlService();
let schemaService;
let historyService;
let mainWindow;
let state = {
  selectedDatabase: "",
  selectedModel: "",
  lastGeneratedSql: "",
  lastUserRequest: ""
};

const runtimeDataPath = path.join(__dirname, "../../.runtime/user-data");
app.setPath("userData", runtimeDataPath);
app.setPath("sessionData", path.join(runtimeDataPath, "session"));
app.commandLine.appendSwitch("disk-cache-dir", path.join(runtimeDataPath, "cache"));
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 680,
    title: "Easy-SQL",
    icon: path.join(__dirname, "../assets/easy-sql.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  historyService = new HistoryService(app.getPath("userData"));
  schemaService = new SchemaService(mysqlService, app.getPath("temp"));
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async (event) => {
  event.preventDefault();
  app.removeAllListeners("before-quit");
  await cleanup();
  app.quit();
});

async function cleanup() {
  await schemaService.clearSchemaFile();
  await mysqlService.close();
}

function registerIpcHandlers() {
  ipcMain.handle("mysql:connect", async (_event, input) => {
    try {
      const payload = validateLogin(input);
      const databases = await mysqlService.connect(payload);
      return { ok: true, databases };
    } catch (error) {
      return {
        ok: false,
        error: friendlyLoginError(error)
      };
    }
  });

  ipcMain.handle("mysql:listDatabases", async () => {
    try {
      return { ok: true, databases: await mysqlService.listDatabases() };
    } catch {
      return { ok: false, error: "This MySQL user cannot access the selected database or table." };
    }
  });

  ipcMain.handle("mysql:selectDatabase", async (_event, database) => {
    try {
      const safeDatabase = validateRequiredString(database, "Database");
      const result = await schemaService.loadSchema(safeDatabase);
      state.selectedDatabase = safeDatabase;
      return { ok: true, ...result };
    } catch {
      return { ok: false, error: "Could not load schema for this database." };
    }
  });

  ipcMain.handle("ollama:listModels", async (_event, baseUrl) => {
    try {
      return { ok: true, models: await fetchModels(validateOllamaUrl(baseUrl)) };
    } catch {
      return {
        ok: false,
        error: "Could not connect to Ollama. Make sure Ollama is running or update the Ollama URL."
      };
    }
  });

  ipcMain.handle("ollama:generateSql", async (_event, input) => {
    try {
      const payload = validateGenerationInput(input);
      const sql = await generateSql({
        ...payload,
        database: state.selectedDatabase,
        schemaSummary: schemaService.getPromptSummary()
      });
      state.selectedModel = payload.model;
      state.lastGeneratedSql = sql;
      state.lastUserRequest = payload.userRequest;
      await historyService.add({
        selectedDatabase: state.selectedDatabase,
        selectedModel: payload.model,
        userRequest: payload.userRequest,
        originalGeneratedSql: sql,
        executed: false,
        status: "generated"
      });
      return { ok: true, sql, classification: classifySql(sql) };
    } catch (error) {
      const message = /Selected model/.test(error.message)
        ? "Selected model is not available in Ollama. Please install it or choose another model."
        : "Could not connect to Ollama. Make sure Ollama is running or update the Ollama URL.";
      return { ok: false, error: message };
    }
  });

  ipcMain.handle("sql:classify", async (_event, sql) => {
    const classification = classifySql(validateSqlText(sql, true));
    return {
      ok: true,
      classification,
      hasMultipleStatements: hasMultipleStatements(sql),
      selectWithoutLimit: classification === READ_QUERY && !hasSelectLimit(sql)
    };
  });

  ipcMain.handle("sql:run", async (_event, input) => {
    const sql = validateSqlText(input && input.sql, false);
    if (!sql) {
      return { ok: false, error: "Please enter or generate SQL before running." };
    }

    const classification = classifySql(sql);
    const multipleStatements = hasMultipleStatements(sql);
    if (multipleStatements) {
      return {
        ok: false,
        error: "Multiple SQL statements are not supported. Please run one statement at a time."
      };
    }

    if (classification !== READ_QUERY && !input.confirmed) {
      const confirmed = await confirmWriteQuery();
      if (!confirmed) {
        await recordExecution(input, sql, classification, false, "cancelled", "");
        return { ok: true, cancelled: true, classification };
      }
    }

    try {
      const [rows, fields] = await mysqlService.executeUserSql(sql);
      const result = formatQueryResult(rows, fields, classification);
      await recordExecution(input, sql, classification, true, "success", "");
      return {
        ok: true,
        classification,
        selectWithoutLimit: classification === READ_QUERY && !hasSelectLimit(sql),
        ...result
      };
    } catch (error) {
      const message = friendlyMysqlError(error);
      await recordExecution(input, sql, classification, true, "error", message);
      return { ok: false, classification, error: message };
    }
  });

  ipcMain.handle("history:list", async () => ({ ok: true, history: await historyService.list() }));
  ipcMain.handle("history:clear", async () => ({ ok: true, history: await historyService.clear() }));
}

function validateLogin(input) {
  const host = validateRequiredString(input && input.host, "Host");
  const port = Number(input && input.port);
  const user = validateRequiredString(input && input.user, "Username");
  const password = String((input && input.password) || "");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid port.");
  }
  return { host, port, user, password };
}

function validateGenerationInput(input) {
  return {
    baseUrl: validateOllamaUrl(input && input.baseUrl),
    model: validateRequiredString(input && input.model, "Model"),
    userRequest: validateRequiredString(input && input.userRequest, "Request")
  };
}

function validateRequiredString(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > 4000) throw new Error(`${label} is too long.`);
  return text;
}

function validateSqlText(value, allowEmpty) {
  const text = String(value || "").trim();
  if (!allowEmpty && !text) return "";
  if (text.length > 100000) throw new Error("SQL is too long.");
  return text;
}

function validateOllamaUrl(value) {
  const text = String(value || "http://localhost:11434").trim();
  const url = new URL(text);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Invalid Ollama URL.");
  }
  return url.toString().replace(/\/+$/, "");
}

async function confirmWriteQuery() {
  const response = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Yes", "No"],
    defaultId: 1,
    cancelId: 1,
    title: "Confirm query",
    message: "This query may change the database or server. Are you sure you want to run it?"
  });
  return response.response === 0;
}

function formatQueryResult(rows, fields, classification) {
  if (classification === READ_QUERY && Array.isArray(rows)) {
    return {
      kind: "rows",
      columns: fields.map((field) => field.name),
      rows: rows.slice(0, 1000),
      rowCount: rows.length,
      displayLimit: 1000
    };
  }

  return {
    kind: "status",
    affectedRows: Number(rows && rows.affectedRows) || 0,
    warningStatus: Number(rows && rows.warningStatus) || 0,
    message: Number(rows && rows.affectedRows) === 0
      ? "Query completed, but no rows were affected."
      : "Query completed successfully."
  };
}

function friendlyMysqlError(error) {
  const code = String((error && error.code) || "");
  if (["ER_TABLEACCESS_DENIED_ERROR", "ER_COLUMNACCESS_DENIED_ERROR", "ER_PROCACCESS_DENIED_ERROR", "ER_DBACCESS_DENIED_ERROR", "ER_SPECIFIC_ACCESS_DENIED_ERROR"].includes(code)) {
    return "You do not have permission to run this query with the current MySQL user.";
  }
  if (code.includes("ACCESS_DENIED")) {
    return "You do not have permission to run this query with the current MySQL user.";
  }
  return (error && error.sqlMessage) || (error && error.message) || "MySQL could not run this query.";
}

function friendlyLoginError(error) {
  const detail = [error && error.code, error && error.sqlMessage].filter(Boolean).join(": ");
  return detail
    ? `Login failed. Please check your MySQL username, password, host, and port. (${detail})`
    : "Login failed. Please check your MySQL username, password, host, and port.";
}

async function recordExecution(input, sql, classification, executed, status, error) {
  await historyService.add({
    selectedDatabase: state.selectedDatabase,
    selectedModel: (input && input.model) || state.selectedModel,
    userRequest: (input && input.userRequest) || state.lastUserRequest,
    originalGeneratedSql: (input && input.originalGeneratedSql) || state.lastGeneratedSql,
    finalSqlExecuted: sql,
    manuallyEdited: sql.trim() !== String((input && input.originalGeneratedSql) || state.lastGeneratedSql || "").trim(),
    executed,
    status: `${status}:${classification}`,
    error
  });
}

module.exports = {
  validateOllamaUrl
};
