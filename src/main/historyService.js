const fs = require("fs/promises");
const path = require("path");

class HistoryService {
  constructor(appDataPath) {
    this.filePath = path.join(appDataPath, "history.json");
  }

  async list() {
    try {
      const text = await fs.readFile(this.filePath, "utf8");
      const history = JSON.parse(text);
      return Array.isArray(history) ? history : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async add(entry) {
    const history = await this.list();
    const nextEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
      selectedDatabase: entry.selectedDatabase || "",
      selectedModel: entry.selectedModel || "",
      userRequest: entry.userRequest || "",
      originalGeneratedSql: entry.originalGeneratedSql || "",
      finalSqlExecuted: entry.finalSqlExecuted || "",
      manuallyEdited: Boolean(entry.manuallyEdited),
      executed: Boolean(entry.executed),
      status: entry.status || "unknown",
      error: entry.error || ""
    };
    history.unshift(nextEntry);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(history.slice(0, 200), null, 2), "utf8");
    return nextEntry;
  }

  async clear() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, "[]", "utf8");
    return [];
  }
}

module.exports = HistoryService;
