const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const root = path.resolve(__dirname, "..");
const buildRequire = createRequire(path.join(root, ".runtime", "build", "package.json"));
const electronDist = path.join(root, ".runtime", "electron", "node_modules", "electron", "dist");
const appRuntime = path.join(root, ".runtime", "app");
const iconPath = path.join(root, "src", "assets", "easy-sql.ico");
const distRoot = path.join(root, "dist");
const buildName = `Easy-SQL-win32-x64-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const buildDir = path.join(distRoot, buildName);
const resourcesApp = path.join(buildDir, "resources", "app");

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  if (!fs.existsSync(path.join(electronDist, "electron.exe"))) {
    throw new Error("Electron runtime is missing. Run npm start once, or run npm install first.");
  }

  if (!fs.existsSync(path.join(appRuntime, "node_modules", "mysql2"))) {
    throw new Error("App runtime is missing mysql2. Run npm install --prefix .runtime/app first.");
  }

  fs.mkdirSync(resourcesApp, { recursive: true });
  fs.cpSync(electronDist, buildDir, { recursive: true });
  fs.renameSync(path.join(buildDir, "electron.exe"), path.join(buildDir, "Easy-SQL.exe"));

  copyIntoApp("package.json");
  copyIntoApp("README.md");
  copyIntoApp("src");
  copyRuntimeApp();
  await tryStampExecutableIcon(path.join(buildDir, "Easy-SQL.exe"));

  console.log(`Packaged Easy-SQL at ${buildDir}`);
  console.log(`Run ${path.join(buildDir, "Easy-SQL.exe")}`);
}

function copyIntoApp(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(resourcesApp, relativePath);
  fs.cpSync(source, destination, { recursive: true });
}

function copyRuntimeApp() {
  const destination = path.join(resourcesApp, ".runtime", "app");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(appRuntime, destination, { recursive: true });
}

async function tryStampExecutableIcon(exePath) {
  try {
    const { rcedit } = buildRequire("rcedit");
    await rcedit(exePath, {
      icon: iconPath,
      "version-string": {
        FileDescription: "Easy-SQL",
        ProductName: "Easy-SQL"
      }
    });
    console.log("Applied Easy-SQL icon to executable.");
  } catch (error) {
    console.warn(`Executable icon stamping skipped: ${error.message}`);
  }
}
