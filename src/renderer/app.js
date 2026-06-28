const api = window.easySql;

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "dashboard", label: "Dashboard" },
  { id: "generator", label: "SQL Generator" },
  { id: "history", label: "Query History" },
  { id: "docs", label: "Documentation" },
  { id: "profile", label: "User Profile" },
  { id: "settings", label: "Settings" }
];

const state = {
  connected: false,
  databases: [],
  selectedDatabase: "",
  schemaStatus: "Connect in Settings, then choose a database.",
  ollamaUrl: "http://localhost:11434",
  models: [],
  selectedModel: "",
  userRequest: "",
  sqlPreview: "",
  originalGeneratedSql: "",
  classification: "",
  result: null,
  history: [],
  loading: "",
  message: null,
  activePage: "home",
  modal: null,
  theme: localStorage.getItem("easySqlTheme") || "dark",
  modelsLoadedFor: "",
  toasts: [],
  mobileNavOpen: false
};

const app = document.getElementById("app");

function setState(patch) {
  Object.assign(state, patch);
  render();
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  app.innerHTML = `
    <div class="aurora aurora-one"></div>
    <div class="aurora aurora-two"></div>
    <div class="app-shell">
      ${renderNavbar()}
      <main class="page-frame">
        ${renderActivePage()}
      </main>
      ${renderModal()}
      ${renderToasts()}
    </div>
  `;
  bindEvents();
}

function renderNavbar() {
  const navLinks = NAV_ITEMS.map((item) => `
    <button class="nav-link ${state.activePage === item.id ? "active" : ""}" data-page="${item.id}">
      ${escapeHtml(item.label)}
    </button>
  `).join("");

  return `
    <header class="navbar">
      <button class="brand-button" data-page="home" aria-label="Go to home">
        <span class="brand-mark">
          <img src="../assets/easy-sql-icon.svg" alt="" />
        </span>
        <span>
          <strong>Easy-SQL</strong>
          <small>${escapeHtml(state.selectedDatabase || "No database selected")}</small>
        </span>
      </button>
      <nav class="nav-links ${state.mobileNavOpen ? "open" : ""}" aria-label="Primary navigation">
        ${navLinks}
      </nav>
      <div class="navbar-actions">
        <span class="status-pill ${state.connected ? "online" : ""}">
          <span></span>${state.connected ? "Online" : "Offline"}
        </span>
        <button id="themeToggle" class="icon-button" title="Toggle dark and light mode" aria-label="Toggle dark and light mode">
          ${state.theme === "dark" ? "D" : "L"}
        </button>
        <button id="mobileNavToggle" class="icon-button mobile-only" title="Open navigation" aria-label="Open navigation">Menu</button>
      </div>
    </header>
  `;
}

function renderActivePage() {
  if (state.activePage === "dashboard") return renderDashboard();
  if (state.activePage === "generator") return renderGeneratorPage();
  if (state.activePage === "history") return renderHistoryPage();
  if (state.activePage === "docs") return renderDocsPage();
  if (state.activePage === "profile") return renderProfilePage();
  if (state.activePage === "settings") return renderSettingsPage();
  return renderHomePage();
}

function renderHomePage() {
  const stats = getStats();
  return `
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">AI SQL workspace for MySQL</span>
        <h1>Generate, review, and run SQL from natural language.</h1>
        <p>Easy-SQL combines your live database schema, local Ollama models, execution history, and result exports inside a polished desktop command center.</p>
        <div class="hero-actions">
          <button class="primary-button" data-page="generator">Open SQL Generator</button>
          <button class="secondary-button" data-page="dashboard">View Dashboard</button>
        </div>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="particle-grid"></div>
        <div class="orbital-card card-a">NL</div>
        <div class="orbital-card card-b">SQL</div>
        <div class="orbital-card card-c">DB</div>
        <div class="query-stream">
          <span>SELECT customers.name</span>
          <span>FROM orders</span>
          <span>WHERE status = "active"</span>
        </div>
      </div>
    </section>
    <section class="overview-grid">
      ${renderStatCard("Queries", stats.total, "Total generated and executed entries")}
      ${renderStatCard("Success", stats.success, "Completed SQL runs")}
      ${renderStatCard("Errors", stats.errors, "Queries needing attention")}
      ${renderStatCard("Tables", state.selectedDatabase ? "Loaded" : "Pending", state.schemaStatus)}
    </section>
    <section class="split-grid">
      ${renderConnectionCard()}
      ${renderRecentQueries()}
    </section>
  `;
}

function renderDashboard() {
  const stats = getStats();
  return `
    <section class="page-heading">
      <div>
        <span class="eyebrow">Dashboard</span>
        <h2>Operational snapshot</h2>
      </div>
      <button class="secondary-button" id="refreshHistoryDashboard">Refresh analytics</button>
    </section>
    <section class="overview-grid">
      ${renderStatCard("Total Queries", stats.total, "History records")}
      ${renderStatCard("Generated", stats.generated, "AI generations")}
      ${renderStatCard("Executed", stats.executed, "Queries sent to MySQL")}
      ${renderStatCard("Read Ratio", `${stats.readPercent}%`, "SELECT-oriented workload")}
    </section>
    <section class="dashboard-grid">
      ${renderChartPanel("Query Activity", getActivitySeries())}
      ${renderChartPanel("Performance Metrics", getStatusSeries())}
      ${renderRecentQueries()}
      ${renderSavedQueries()}
      ${renderConnectionCard()}
      ${renderUserActivityPanel()}
    </section>
  `;
}

function renderGeneratorPage() {
  return `
    <section class="generator-layout">
      <div class="generator-main">
        <section class="glass-panel prompt-panel">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Natural language</span>
              <h2>Describe your query</h2>
            </div>
            ${renderClassification()}
          </div>
          <textarea id="userRequest" class="prompt-input" placeholder="Example: Show monthly revenue by product category for the last 6 months.">${escapeHtml(state.userRequest)}</textarea>
          <div class="button-row">
            <button id="generateSql" class="primary-button" ${!canGenerate() || state.loading ? "disabled" : ""}>${state.loading === "generate" ? "Generating..." : "Generate"}</button>
            <button id="regenerateSql" class="secondary-button" ${!canRegenerate() || state.loading ? "disabled" : ""}>Regenerate</button>
            <button id="clearSql" class="ghost-button">Clear</button>
          </div>
          ${state.loading === "generate" ? renderSkeleton("wide") : ""}
          ${renderMessageFor("query")}
        </section>
        <section class="glass-panel editor-panel">
          <div class="panel-header">
            <div>
              <span class="eyebrow">SQL output editor</span>
              <h2>Review before execution</h2>
            </div>
            <div class="button-row compact">
              <button id="copySql" class="secondary-button" ${!state.sqlPreview ? "disabled" : ""}>Copy</button>
              <button id="downloadSql" class="secondary-button" ${!state.sqlPreview ? "disabled" : ""}>Download SQL</button>
            </div>
          </div>
          <textarea id="sqlPreview" class="sql-editor" spellcheck="false" placeholder="Generated or handwritten SQL appears here.">${escapeHtml(state.sqlPreview)}</textarea>
          <div class="syntax-card">
            <div class="mini-label">Syntax highlighting</div>
            <pre>${highlightSql(state.sqlPreview || "-- SQL preview will appear here")}</pre>
          </div>
          <div class="button-row">
            <button id="runSql" class="primary-button" ${state.loading ? "disabled" : ""}>${state.loading === "run" ? "Running..." : "Run Query"}</button>
            <button id="openSettingsFromGenerator" class="secondary-button">Connection Settings</button>
          </div>
        </section>
      </div>
      <aside class="generator-side">
        ${renderDatabasePanel()}
        ${renderExplanationPanel()}
        ${renderOptimizationPanel()}
      </aside>
    </section>
    ${renderResultsSection()}
  `;
}

function renderHistoryPage() {
  const items = state.history.map(renderHistoryItem).join("");
  return `
    <section class="page-heading">
      <div>
        <span class="eyebrow">Query History</span>
        <h2>Audit trail</h2>
      </div>
      <div class="button-row compact">
        <button id="refreshHistory" class="secondary-button">Refresh</button>
        <button id="clearHistory" class="danger-button" ${state.history.length ? "" : "disabled"}>Clear history</button>
      </div>
    </section>
    <section class="history-shell">
      ${items || renderEmptyState("No query history yet", "Generate or run SQL and the records will appear here.")}
    </section>
  `;
}

function renderDocsPage() {
  return `
    <section class="page-heading">
      <div>
        <span class="eyebrow">Documentation</span>
        <h2>Workspace guide</h2>
      </div>
    </section>
    <section class="docs-grid">
      ${renderDocCard("1", "Connect MySQL", "Open Settings, enter host, port, username, and password, then choose a visible database.")}
      ${renderDocCard("2", "Choose Ollama model", "Use a coding model exposed by your Ollama server. Recommended models are marked in the picker when available.")}
      ${renderDocCard("3", "Generate SQL", "Describe the data you need. Easy-SQL sends your selected schema context to the backend generator.")}
      ${renderDocCard("4", "Review and run", "Edit the generated SQL, inspect the classification badge, then run one statement at a time.")}
      ${renderDocCard("KB", "Keyboard shortcuts", "Ctrl+Enter generates SQL. Ctrl+R runs SQL. Ctrl+K copies SQL. Esc closes modals.")}
    </section>
  `;
}

function renderProfilePage() {
  const stats = getStats();
  return `
    <section class="profile-layout">
      <div class="profile-card glass-panel">
        <div class="avatar">ES</div>
        <h2>Local SQL Operator</h2>
        <p>${escapeHtml(state.selectedModel || "No model selected")}</p>
        <button class="secondary-button" data-page="settings">Edit profile settings</button>
      </div>
      <div class="profile-details">
        ${renderStatCard("Active Database", state.selectedDatabase || "None", state.schemaStatus)}
        ${renderStatCard("Model", state.selectedModel || "Pending", "Ollama generation model")}
        ${renderStatCard("History", stats.total, "Saved local records")}
        ${renderUserActivityPanel()}
      </div>
    </section>
  `;
}

function renderSettingsPage() {
  return `
    <section class="page-heading">
      <div>
        <span class="eyebrow">Settings</span>
        <h2>Connections and model routing</h2>
      </div>
    </section>
    <section class="settings-grid">
      ${renderMysqlSettings()}
      ${renderOllamaSettings()}
      ${renderDatabasePanel()}
    </section>
  `;
}

function renderDatabasePanel() {
  const options = state.databases.map((database) => `<option value="${escapeHtml(database)}" ${database === state.selectedDatabase ? "selected" : ""}>${escapeHtml(database)}</option>`).join("");
  return `
    <section class="glass-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Database</span>
          <h3>Schema context</h3>
        </div>
        <button id="refreshDatabases" class="icon-button" title="Refresh databases" ${!state.connected || state.loading ? "disabled" : ""}>R</button>
      </div>
      <label class="field-label">Visible databases
        <select id="databaseSelect" ${!state.connected ? "disabled" : ""}>
          <option value="">Choose database</option>
          ${options}
        </select>
      </label>
      <div class="status-card ${state.connected ? "ok" : ""}">
        <strong>${state.connected ? "Connected" : "Disconnected"}</strong>
        <span>${escapeHtml(state.schemaStatus)}</span>
      </div>
    </section>
  `;
}

function renderMysqlSettings() {
  return `
    <section class="glass-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">MySQL</span>
          <h3>Database login</h3>
        </div>
      </div>
      <form id="loginForm" class="form-grid">
        <div class="field-row">
          <label class="field-label">Host<input id="mysqlHost" value="localhost" autocomplete="off" /></label>
          <label class="field-label">Port<input id="mysqlPort" type="number" value="3306" min="1" max="65535" /></label>
        </div>
        <label class="field-label">Username<input id="mysqlUser" autocomplete="username" /></label>
        <label class="field-label">Password<input id="mysqlPassword" type="password" autocomplete="current-password" /></label>
        <button type="submit" class="primary-button" ${state.loading ? "disabled" : ""}>${state.loading === "login" ? "Connecting..." : "Connect MySQL"}</button>
        ${state.loading === "login" ? renderSkeleton("stack") : ""}
        ${renderMessageFor("login")}
      </form>
    </section>
  `;
}

function renderOllamaSettings() {
  const modelOptions = state.models.map((model) => {
    const label = model.recommended ? `${model.name} recommended` : model.name;
    return `<option value="${escapeHtml(model.name)}" ${model.name === state.selectedModel ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");

  return `
    <section class="glass-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Ollama</span>
          <h3>AI model</h3>
        </div>
      </div>
      <div class="form-grid">
        <label class="field-label">Ollama URL<input id="ollamaUrl" value="${escapeHtml(state.ollamaUrl)}" /></label>
        <label class="field-label">Model
          <select id="modelSelect" ${state.loading === "models" ? "disabled" : ""}>
            <option value="">${state.loading === "models" ? "Loading models..." : "Choose model"}</option>
            ${modelOptions}
          </select>
        </label>
        <div class="hint">Recommended coding models: qwen2.5-coder:3b or greater, codegemma:7b or greater.</div>
        ${state.loading === "models" ? renderSkeleton("stack") : ""}
        ${renderMessageFor("ollama")}
      </div>
    </section>
  `;
}

function renderConnectionCard() {
  return `
    <section class="glass-panel connection-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Connection status</span>
          <h3>${state.connected ? "Database online" : "Database not connected"}</h3>
        </div>
        <span class="pulse ${state.connected ? "online" : ""}"></span>
      </div>
      <div class="connection-grid">
        <div><span>Database</span><strong>${escapeHtml(state.selectedDatabase || "Not selected")}</strong></div>
        <div><span>Model</span><strong>${escapeHtml(state.selectedModel || "Not selected")}</strong></div>
        <div><span>Schema</span><strong>${escapeHtml(state.schemaStatus)}</strong></div>
      </div>
    </section>
  `;
}

function renderRecentQueries() {
  const items = state.history.slice(0, 5).map((item) => `
    <article class="compact-query">
      <span>${escapeHtml(new Date(item.timestamp).toLocaleString())}</span>
      <strong>${escapeHtml(item.userRequest || "Manual SQL")}</strong>
      <code>${escapeHtml(item.finalSqlExecuted || item.originalGeneratedSql || "")}</code>
    </article>
  `).join("");

  return `
    <section class="glass-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Recent queries</span>
          <h3>Latest work</h3>
        </div>
        <button class="ghost-button" data-page="history">View all</button>
      </div>
      <div class="query-list">${items || renderEmptyState("No recent queries", "Your latest generated and executed SQL will show here.")}</div>
    </section>
  `;
}

function renderSavedQueries() {
  const saved = state.history.filter((item) => item.originalGeneratedSql).slice(0, 4);
  const items = saved.map((item) => `
    <article class="saved-query">
      <strong>${escapeHtml(item.selectedDatabase || "No database")}</strong>
      <pre>${escapeHtml(item.originalGeneratedSql || "")}</pre>
      <button class="secondary-button restore-sql" data-sql="${escapeHtmlAttr(item.originalGeneratedSql || "")}" data-request="${escapeHtmlAttr(item.userRequest || "")}">Restore</button>
    </article>
  `).join("");
  return `
    <section class="glass-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Saved queries</span>
          <h3>Generated SQL</h3>
        </div>
      </div>
      <div class="saved-grid">${items || renderEmptyState("Nothing saved yet", "Generated SQL records will be available here.")}</div>
    </section>
  `;
}

function renderUserActivityPanel() {
  const stats = getStats();
  return `
    <section class="glass-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">User activity</span>
          <h3>Local session</h3>
        </div>
      </div>
      <div class="activity-list">
        <div><span>Generation events</span><strong>${stats.generated}</strong></div>
        <div><span>Execution events</span><strong>${stats.executed}</strong></div>
        <div><span>Manual edits</span><strong>${stats.edited}</strong></div>
        <div><span>Last activity</span><strong>${escapeHtml(stats.lastActivity)}</strong></div>
      </div>
    </section>
  `;
}

function renderResultsSection() {
  if (!state.result) {
    return `
      <section class="glass-panel results-empty">
        ${state.loading === "run" ? renderSkeleton("table") : renderEmptyState("No results yet", "Run a query to show returned rows, affected rows, warnings, or MySQL errors.")}
      </section>
    `;
  }

  if (state.result.kind === "rows") {
    const headers = state.result.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
    const rows = state.result.rows.map((row) => `
      <tr>${state.result.columns.map((column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`).join("")}</tr>
    `).join("");
    const warning = state.result.selectWithoutLimit
      ? `<div class="notice warn">This read query has no LIMIT. Showing up to ${state.result.displayLimit} rows.</div>`
      : "";
    return `
      <section class="glass-panel results-panel">
        <div class="panel-header">
          <div>
            <span class="eyebrow">Results</span>
            <h3>${state.result.rowCount} row(s) returned</h3>
          </div>
          <button id="exportCsv" class="secondary-button">Export CSV</button>
        </div>
        ${warning}
        <div class="results-wrap">
          <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
        </div>
      </section>
    `;
  }

  return `
    <section class="glass-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Results</span>
          <h3>Execution complete</h3>
        </div>
      </div>
      <div class="notice ok">${escapeHtml(state.result.message)}</div>
      <p class="muted">Affected rows: ${state.result.affectedRows}. Warnings: ${state.result.warningStatus}.</p>
    </section>
  `;
}

function renderExplanationPanel() {
  const explanation = buildExplanation();
  return `
    <section class="glass-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Explanation</span>
          <h3>Query summary</h3>
        </div>
      </div>
      <p class="assistant-copy">${escapeHtml(explanation)}</p>
    </section>
  `;
}

function renderOptimizationPanel() {
  const suggestions = buildSuggestions().map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <section class="glass-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Optimization</span>
          <h3>Suggestions</h3>
        </div>
      </div>
      <ul class="suggestion-list">${suggestions}</ul>
    </section>
  `;
}

function renderChartPanel(title, series) {
  const max = Math.max(1, ...series.map((item) => item.value));
  const bars = series.map((item) => {
    const bucket = Math.max(1, Math.min(10, Math.ceil((item.value / max) * 10)));
    return `
      <div class="bar-item">
        <span class="bar bar-h-${bucket}"></span>
        <small>${escapeHtml(item.label)}</small>
      </div>
    `;
  }).join("");
  return `
    <section class="glass-panel chart-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Analytics</span>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </div>
      ${state.history.length ? `<div class="bar-chart">${bars}</div>` : renderEmptyState("No analytics yet", "Charts use your real query history.")}
    </section>
  `;
}

function renderStatCard(label, value, detail) {
  return `
    <article class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function renderHistoryItem(item) {
  const sql = item.finalSqlExecuted || item.originalGeneratedSql || "";
  return `
    <article class="history-item">
      <div class="history-meta">
        <time>${escapeHtml(new Date(item.timestamp).toLocaleString())}</time>
        <span>${escapeHtml(item.status || "generated")}</span>
      </div>
      <h3>${escapeHtml(item.userRequest || "Manual SQL")}</h3>
      <p>${escapeHtml(item.selectedDatabase || "No database")} | ${escapeHtml(item.selectedModel || "No model")}</p>
      <pre>${escapeHtml(sql)}</pre>
      <div class="button-row compact">
        <button class="secondary-button copy-history" data-sql="${escapeHtmlAttr(sql)}">Copy SQL</button>
        <button class="ghost-button restore-sql" data-sql="${escapeHtmlAttr(sql)}" data-request="${escapeHtmlAttr(item.userRequest || "")}">Restore</button>
      </div>
    </article>
  `;
}

function renderDocCard(step, title, body) {
  return `
    <article class="doc-card">
      <span>${escapeHtml(step)}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function renderClassification() {
  if (state.classification === "READ_QUERY") return `<span id="classificationLabel" class="classification read">Read query</span>`;
  if (state.classification === "WRITE_OR_STRUCTURE_QUERY") return `<span id="classificationLabel" class="classification write">Write or structure query</span>`;
  return `<span id="classificationLabel" class="classification">Not classified</span>`;
}

function renderModal() {
  if (!state.modal) return "";
  const title = state.modal === "settings" ? "Get connected" : "Dialog";
  return `
    <div class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtmlAttr(title)}">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Setup</span>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <button id="closeModal" class="icon-button" aria-label="Close modal">X</button>
        </div>
        <div class="settings-grid modal-settings">
          ${renderMysqlSettings()}
          ${renderOllamaSettings()}
        </div>
      </section>
    </div>
  `;
}

function renderToasts() {
  return `<div class="toast-stack">${state.toasts.map((toast) => `<div class="toast ${toast.type}">${escapeHtml(toast.text)}</div>`).join("")}</div>`;
}

function renderMessageFor(area) {
  if (!state.message || state.message.area !== area) return "";
  return `<div class="notice ${state.message.type}">${escapeHtml(state.message.text)}</div>`;
}

function renderSkeleton(type) {
  const rows = type === "table" ? 6 : type === "stack" ? 3 : 2;
  return `<div class="skeleton ${type}">${Array.from({ length: rows }, () => "<span></span>").join("")}</div>`;
}

function renderEmptyState(title, body) {
  return `
    <div class="empty-state">
      <div class="empty-illustration"><span></span><span></span><span></span></div>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-page]").forEach((element) => {
    element.addEventListener("click", async () => {
      const page = element.dataset.page;
      state.mobileNavOpen = false;
      state.activePage = page;
      state.modal = null;
      if (page === "history" || page === "dashboard") await loadHistory(false);
      render();
    });
  });

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

  const mobileNavToggle = document.getElementById("mobileNavToggle");
  if (mobileNavToggle) mobileNavToggle.addEventListener("click", () => setState({ mobileNavOpen: !state.mobileNavOpen }));

  const closeModal = document.getElementById("closeModal");
  if (closeModal) closeModal.addEventListener("click", () => setState({ modal: null }));

  document.querySelector(".modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) setState({ modal: null });
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", connectMysql);

  const refreshButton = document.getElementById("refreshDatabases");
  if (refreshButton) refreshButton.addEventListener("click", refreshDatabases);

  const databaseSelect = document.getElementById("databaseSelect");
  if (databaseSelect) databaseSelect.addEventListener("change", selectDatabase);

  const modelSelect = document.getElementById("modelSelect");
  if (modelSelect) modelSelect.addEventListener("change", (event) => {
    state.selectedModel = event.target.value;
    updateGenerateButton();
    toast("Model selected.");
  });

  const ollamaUrl = document.getElementById("ollamaUrl");
  if (ollamaUrl) {
    ollamaUrl.addEventListener("change", async (event) => {
      state.ollamaUrl = event.target.value;
      state.modelsLoadedFor = "";
      await refreshModelsIfNeeded();
    });
    ollamaUrl.addEventListener("input", (event) => {
      state.ollamaUrl = event.target.value;
    });
  }

  const userRequest = document.getElementById("userRequest");
  if (userRequest) userRequest.addEventListener("input", (event) => {
    state.userRequest = event.target.value;
    updateGenerateButton();
  });

  const sqlPreview = document.getElementById("sqlPreview");
  if (sqlPreview) sqlPreview.addEventListener("input", onSqlPreviewInput);

  document.getElementById("generateSql")?.addEventListener("click", generateSql);
  document.getElementById("regenerateSql")?.addEventListener("click", generateSql);
  document.getElementById("runSql")?.addEventListener("click", runSql);
  document.getElementById("clearSql")?.addEventListener("click", () => setState({ userRequest: "", sqlPreview: "", classification: "", result: null, message: null }));
  document.getElementById("copySql")?.addEventListener("click", () => copyText(state.sqlPreview, "SQL copied."));
  document.getElementById("downloadSql")?.addEventListener("click", downloadSql);
  document.getElementById("openSettingsFromGenerator")?.addEventListener("click", () => setState({ activePage: "settings" }));
  document.getElementById("refreshHistory")?.addEventListener("click", async () => {
    await loadHistory(false);
    render();
    toast("History refreshed.");
  });
  document.getElementById("refreshHistoryDashboard")?.addEventListener("click", async () => {
    await loadHistory(false);
    render();
    toast("Analytics refreshed.");
  });
  document.getElementById("clearHistory")?.addEventListener("click", clearHistoryEntries);
  document.getElementById("exportCsv")?.addEventListener("click", exportCsv);

  document.querySelectorAll(".copy-history").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.sql || "", "SQL copied from history."));
  });

  document.querySelectorAll(".restore-sql").forEach((button) => {
    button.addEventListener("click", async () => {
      state.sqlPreview = button.dataset.sql || "";
      state.userRequest = button.dataset.request || state.userRequest;
      state.activePage = "generator";
      await classifyCurrentSql();
      render();
      toast("Query restored.");
    });
  });
}

async function connectMysql(event) {
  event.preventDefault();
  const payload = {
    host: document.getElementById("mysqlHost").value,
    port: document.getElementById("mysqlPort").value,
    user: document.getElementById("mysqlUser").value,
    password: document.getElementById("mysqlPassword").value
  };
  setState({ loading: "login", message: null });
  const response = await api.connectMysql(payload);
  if (response.ok) {
    state.connected = true;
    state.databases = response.databases;
    state.selectedDatabase = "";
    state.schemaStatus = "Choose a visible database.";
    state.loading = "";
    state.message = { area: "login", type: "ok", text: "Connected to MySQL." };
    state.modal = null;
    render();
    toast("Connected to MySQL.");
  } else {
    setState({ loading: "", message: { area: "login", type: "error", text: response.error } });
    toast(response.error, "error");
  }
}

async function refreshDatabases() {
  setState({ loading: "databases", message: null });
  const response = await api.listDatabases();
  setState(response.ok
    ? { databases: response.databases, loading: "", schemaStatus: "Database list refreshed." }
    : { loading: "", message: { area: "query", type: "error", text: response.error } });
  toast(response.ok ? "Database list refreshed." : response.error, response.ok ? "ok" : "error");
}

async function selectDatabase(event) {
  const database = event.target.value;
  if (!database) return;
  setState({ loading: "schema", schemaStatus: "Loading schema...", selectedDatabase: database, sqlPreview: "", originalGeneratedSql: "", result: null });
  const response = await api.selectDatabase(database);
  if (response.ok) {
    setState({ loading: "", schemaStatus: `Loaded ${response.tableCount} table(s).` });
    toast(`Schema loaded for ${database}.`);
  } else {
    setState({ loading: "", schemaStatus: response.error, message: { area: "query", type: "error", text: response.error } });
    toast(response.error, "error");
  }
}

async function refreshModelsIfNeeded() {
  if (state.loading || state.modelsLoadedFor === state.ollamaUrl) return;
  state.loading = "models";
  render();
  const response = await api.listOllamaModels(state.ollamaUrl);
  if (response.ok) {
    const recommended = response.models.find((model) => model.recommended);
    setState({
      models: response.models,
      selectedModel: state.selectedModel || (recommended ? recommended.name : (response.models[0] && response.models[0].name) || ""),
      modelsLoadedFor: state.ollamaUrl,
      loading: "",
      message: null
    });
  } else {
    setState({
      models: [],
      selectedModel: "",
      modelsLoadedFor: "",
      loading: "",
      message: { area: "ollama", type: "error", text: response.error }
    });
  }
}

async function generateSql() {
  setState({ loading: "generate", message: null, result: null, activePage: "generator" });
  const response = await api.generateSql({
    baseUrl: state.ollamaUrl,
    model: getEffectiveModel(),
    userRequest: state.userRequest
  });
  if (response.ok) {
    const history = await api.listHistory();
    setState({
      loading: "",
      sqlPreview: response.sql,
      originalGeneratedSql: response.sql,
      classification: response.classification,
      history: history.history || [],
      message: { area: "query", type: "ok", text: "SQL generated. Review or edit it before running." }
    });
    toast("SQL generated.");
  } else {
    setState({ loading: "", message: { area: "query", type: "error", text: response.error } });
    toast(response.error, "error");
  }
}

async function onSqlPreviewInput(event) {
  state.sqlPreview = event.target.value;
  await classifyCurrentSql();
}

async function classifyCurrentSql() {
  const response = await api.classifySql(state.sqlPreview);
  if (response.ok) {
    state.classification = response.classification;
    updateClassificationLabel();
  }
}

async function runSql() {
  setState({ loading: "run", message: null, result: null, activePage: "generator" });
  const response = await api.runSql({
    sql: state.sqlPreview,
    originalGeneratedSql: state.originalGeneratedSql,
    userRequest: state.userRequest,
    model: getEffectiveModel()
  });

  if (response.ok && response.cancelled) {
    await loadHistory(false);
    setState({ loading: "", message: { area: "query", type: "warn", text: "Query cancelled." } });
    toast("Query cancelled.", "warn");
    return;
  }

  if (response.ok) {
    await loadHistory(false);
    setState({ loading: "", result: response, classification: response.classification, message: { area: "query", type: "ok", text: "Query completed." } });
    toast("Query completed.");
  } else {
    await loadHistory(false);
    setState({ loading: "", classification: response.classification || state.classification, message: { area: "query", type: "error", text: response.error } });
    toast(response.error, "error");
  }
}

async function loadHistory(shouldRender = true) {
  const response = await api.listHistory();
  if (response.ok) {
    state.history = response.history || [];
    if (shouldRender) render();
  }
}

async function clearHistoryEntries() {
  const confirmed = window.confirm("Clear all saved history?");
  if (!confirmed) return;
  const response = await api.clearHistory();
  if (response.ok) {
    setState({ history: response.history || [] });
    toast("History cleared.");
  }
}

function exportCsv() {
  if (!state.result || state.result.kind !== "rows") return;
  const csv = [
    state.result.columns.map(csvValue).join(","),
    ...state.result.rows.map((row) => state.result.columns.map((column) => csvValue(row[column])).join(","))
  ].join("\n");
  downloadBlob(csv, `easy-sql-results-${Date.now()}.csv`, "text/csv;charset=utf-8");
}

function downloadSql() {
  if (!state.sqlPreview) return;
  downloadBlob(state.sqlPreview, `easy-sql-query-${Date.now()}.sql`, "text/sql;charset=utf-8");
  toast("SQL file downloaded.");
}

function downloadBlob(text, filename, type) {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function copyText(text, successMessage) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  toast(successMessage);
}

function toast(text, type = "ok") {
  const id = Date.now() + Math.random();
  state.toasts.push({ id, text, type });
  render();
  window.setTimeout(() => {
    state.toasts = state.toasts.filter((item) => item.id !== id);
    render();
  }, 2800);
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("easySqlTheme", state.theme);
  render();
}

function getStats() {
  const total = state.history.length;
  const executed = state.history.filter((item) => item.executed).length;
  const generated = state.history.filter((item) => item.status === "generated" || item.originalGeneratedSql).length;
  const success = state.history.filter((item) => String(item.status || "").startsWith("success")).length;
  const errors = state.history.filter((item) => String(item.status || "").startsWith("error")).length;
  const reads = state.history.filter((item) => String(item.status || "").includes("READ_QUERY")).length;
  const edited = state.history.filter((item) => item.manuallyEdited).length;
  const last = state.history[0] && state.history[0].timestamp ? new Date(state.history[0].timestamp).toLocaleString() : "No activity yet";
  return {
    total,
    executed,
    generated,
    success,
    errors,
    edited,
    readPercent: total ? Math.round((reads / total) * 100) : 0,
    lastActivity: last
  };
}

function getActivitySeries() {
  const buckets = new Map();
  state.history.slice().reverse().forEach((item) => {
    const date = new Date(item.timestamp);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    buckets.set(label, (buckets.get(label) || 0) + 1);
  });
  return Array.from(buckets.entries()).slice(-7).map(([label, value]) => ({ label, value }));
}

function getStatusSeries() {
  const stats = getStats();
  return [
    { label: "Gen", value: stats.generated },
    { label: "Run", value: stats.executed },
    { label: "OK", value: stats.success },
    { label: "Err", value: stats.errors },
    { label: "Edit", value: stats.edited }
  ];
}

function buildExplanation() {
  const sql = state.sqlPreview.trim();
  if (!sql) return "Generate or paste SQL to see a practical summary here.";
  const verb = (sql.match(/^\s*(\w+)/) || [])[1] || "SQL";
  if (/^select/i.test(sql)) return "This read query retrieves rows from the selected database. Review filters, joins, sorting, and limits before running.";
  if (/^(insert|update|delete|alter|drop|create|truncate)/i.test(sql)) return `This ${verb.toUpperCase()} statement can change data or schema. Easy-SQL will ask for confirmation before execution.`;
  return `This statement starts with ${verb.toUpperCase()}. Review it carefully before running against the active database.`;
}

function buildSuggestions() {
  const sql = state.sqlPreview.trim();
  if (!sql) return ["Generate SQL to receive query-specific optimization suggestions."];
  const suggestions = [];
  if (/^select/i.test(sql) && !/\blimit\b/i.test(sql)) suggestions.push("Add a LIMIT while exploring large tables.");
  if (/\bwhere\b/i.test(sql)) suggestions.push("Check that filtered columns are indexed for faster reads.");
  if (/\border\s+by\b/i.test(sql)) suggestions.push("For large result sets, pair ORDER BY with an indexed column when possible.");
  if (/\bjoin\b/i.test(sql)) suggestions.push("Verify join keys and indexes on both joined tables.");
  if (!suggestions.length) suggestions.push("Run EXPLAIN in MySQL for detailed execution planning.");
  return suggestions;
}

function highlightSql(sql) {
  return escapeHtml(sql)
    .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|LIMIT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|VALUES|SET|AND|OR|AS|COUNT|SUM|AVG|MIN|MAX)\b/gi, '<span class="sql-keyword">$1</span>')
    .replace(/(&quot;.*?&quot;|'.*?')/g, '<span class="sql-string">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="sql-number">$1</span>');
}

function canGenerate() {
  return Boolean(state.selectedDatabase && getEffectiveModel() && state.userRequest.trim());
}

function canRegenerate() {
  return Boolean(state.originalGeneratedSql && canGenerate());
}

function updateGenerateButton() {
  const button = document.getElementById("generateSql");
  if (button) button.disabled = !canGenerate() || Boolean(state.loading);
  const regenerate = document.getElementById("regenerateSql");
  if (regenerate) regenerate.disabled = !canRegenerate() || Boolean(state.loading);
}

function updateClassificationLabel() {
  const label = document.getElementById("classificationLabel");
  if (!label) return;
  label.className = "classification";
  if (state.classification === "READ_QUERY") {
    label.classList.add("read");
    label.textContent = "Read query";
  } else if (state.classification === "WRITE_OR_STRUCTURE_QUERY") {
    label.classList.add("write");
    label.textContent = "Write or structure query";
  } else {
    label.textContent = "Not classified";
  }
}

function getEffectiveModel() {
  return state.selectedModel;
}

function formatCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function csvValue(value) {
  const text = formatCell(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.modal) setState({ modal: null });
  if (event.ctrlKey && event.key === "Enter") {
    event.preventDefault();
    if (canGenerate() && !state.loading) generateSql();
  }
  if (event.ctrlKey && event.key.toLowerCase() === "r") {
    event.preventDefault();
    if (state.sqlPreview && !state.loading) runSql();
  }
  if (event.ctrlKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    copyText(state.sqlPreview, "SQL copied.");
  }
});

async function init() {
  await loadHistory(false);
  render();
  await refreshModelsIfNeeded();
}

init();
