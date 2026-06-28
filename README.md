# Easy-SQL

Easy-SQL is a modern Electron desktop assistant for generating, reviewing, and running MySQL queries with a local or configurable Ollama model. It connects with the MySQL username and password entered by the user, reads only the databases visible to that MySQL account, sends selected schema context to Ollama, and keeps the generated SQL editable before anything runs.

The SQL editor is the source of truth. If you edit, replace, restore, or clear generated SQL, Easy-SQL classifies and executes exactly the SQL currently visible in the editor after the required approval flow.

## Interface Highlights

- Premium SaaS-style desktop UI with glass panels, subtle gradients, soft shadows, animations, and responsive layouts.
- Responsive navbar with Home, Dashboard, SQL Generator, Query History, Documentation, User Profile, and Settings.
- Hero view with an AI/SQL visual, project summary, and quick actions.
- Dashboard with real history-based statistics, recent queries, usage analytics, activity charts, saved query cards, connection status, and local user activity.
- SQL Generator workspace with natural-language prompt input, editable SQL output, syntax-highlighted preview, copy, download, generate, regenerate, run, explanation, and optimization suggestions.
- Query History page with restore and copy actions.
- Dark and light mode toggle, toast notifications, loading skeletons, modern modals, custom scrollbar, empty states, and keyboard shortcuts.

## Run From Source

```powershell
npm install
npm start
```

Electron and app runtime dependencies are installed in isolated `.runtime` folders during `npm install`. This avoids Windows file-lock issues if an editor or desktop shell is holding an old Electron binary in the root `node_modules` folder.

## Download And Run

Download `Easy-SQL.exe` from the GitHub Releases page, then run it directly on Windows.

Before using the app, make sure:

- MySQL Server is running, usually on `localhost:3306`.
- Ollama is running, usually on `http://localhost:11434`.
- At least one coding model is installed in Ollama.

In the app:

1. Open **Settings** from the navbar.
2. Enter your MySQL host, port, username, and password.
3. Click **Connect MySQL**.
4. Choose a visible database in **Settings** or the **SQL Generator** database panel.
5. Choose an Ollama model.
6. Open **SQL Generator**.
7. Type a natural-language request.
8. Click **Generate**.
9. Review or edit the SQL output.
10. Use **Copy**, **Download SQL**, **Regenerate**, or **Run Query** as needed.

## Keyboard Shortcuts

- `Ctrl+Enter`: generate SQL from the current natural-language request.
- `Ctrl+R`: run the SQL currently visible in the editor.
- `Ctrl+K`: copy the current SQL.
- `Esc`: close open modals.

## MySQL Setup

Run a local or reachable MySQL server and log in with a real MySQL account. Easy-SQL does not use a hidden root account or bypass permissions. The app uses the entered username and password for:

- `SHOW DATABASES`
- schema loading from `INFORMATION_SCHEMA`
- query execution

If MySQL rejects a query because that account lacks privileges, Easy-SQL shows a permission message. Grant access in MySQL if the user should be allowed to see a database or run a query.

## Ollama Setup

Install and start Ollama, then pull at least one coding-capable model:

```powershell
ollama pull qwen2.5-coder:3b
ollama pull codegemma:7b
```

The default Ollama URL is:

```text
http://localhost:11434
```

You can change it in **Settings**. Easy-SQL fetches installed models from `/api/tags` and shows them in the model dropdown.

Recommended coding models: qwen2.5-coder:3b or greater, codegemma:7b or greater.

## How It Works

1. Log in with a MySQL host, port, username, and password.
2. Choose one of the databases visible to that MySQL user.
3. Easy-SQL loads columns, foreign keys, indexes, and table metadata from `INFORMATION_SCHEMA`.
4. The schema summary is stored in memory and as a temporary file in the system temp folder.
5. Choose an Ollama model.
6. Ask for a query in natural language.
7. Ollama generates one MySQL statement using the selected database schema.
8. The generated SQL appears in an editable SQL output editor.
9. Easy-SQL classifies the visible SQL and shows a read/write badge.
10. Run the query only after reviewing or editing it.

Schema temp files never include MySQL passwords. The current schema temp file is deleted when you switch databases and when the app quits.

## SQL Editing And Execution

The SQL editor is intentionally editable. Easy-SQL does not execute SQL immediately after generation, and it does not execute the original generated SQL if you changed it.

When **Run Query** is clicked:

- Empty editor shows: `Please enter or generate SQL before running.`
- Read queries (`SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN`, read-only `WITH`) run after the normal Run click.
- Write, structure, permission, admin, and other non-read queries require an additional Yes/No confirmation.
- The app executes exactly the final SQL currently visible in the editor.

Multiple SQL statements are blocked by default. Run one statement at a time.

## Results, Analytics, And History

SELECT results are displayed in a table with headers and can be exported to CSV. Large result sets are displayed up to an app-side limit, and SELECT queries without `LIMIT` show a warning.

The dashboard and charts use real local history data. If no history exists yet, the UI shows empty states instead of fake data.

History is stored locally in Electron app data and includes:

- timestamp
- selected database
- selected model
- natural-language request
- original generated SQL
- final SQL executed from the editor
- whether the SQL was manually edited
- execution status or error

History does not store passwords or query results.

## Security Notes

- MySQL credentials are kept in the main process memory only.
- Passwords are not saved to disk.
- The renderer cannot access credentials directly.
- Electron uses `contextBridge`, `ipcMain`, context isolation, and disabled `nodeIntegration`.
- Internal metadata queries use prepared parameters.
- User-generated or edited SQL is only executed after explicit user action and, for non-read queries, confirmation.
- MySQL remains the final authority for permissions.

## Development

```powershell
npm test
npm start
npm run package
npm run setup
```

Important files:

- `src/main/main.js` registers safe IPC handlers.
- `src/main/mysqlService.js` owns the active MySQL connection.
- `src/main/schemaService.js` loads and stores schema summaries.
- `src/main/ollamaService.js` fetches models and generates SQL.
- `src/main/queryClassifier.js` classifies the current editor SQL.
- `src/preload.js` exposes the limited renderer API.
- `src/renderer/app.js` implements the redesigned UI and frontend behavior.
- `src/renderer/styles.css` contains the responsive visual system.
