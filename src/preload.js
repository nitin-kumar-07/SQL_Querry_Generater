const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("easySql", {
  connectMysql: (payload) => ipcRenderer.invoke("mysql:connect", payload),
  listDatabases: () => ipcRenderer.invoke("mysql:listDatabases"),
  selectDatabase: (database) => ipcRenderer.invoke("mysql:selectDatabase", database),
  listOllamaModels: (baseUrl) => ipcRenderer.invoke("ollama:listModels", baseUrl),
  generateSql: (payload) => ipcRenderer.invoke("ollama:generateSql", payload),
  classifySql: (sql) => ipcRenderer.invoke("sql:classify", sql),
  runSql: (payload) => ipcRenderer.invoke("sql:run", payload),
  listHistory: () => ipcRenderer.invoke("history:list"),
  clearHistory: () => ipcRenderer.invoke("history:clear")
});
