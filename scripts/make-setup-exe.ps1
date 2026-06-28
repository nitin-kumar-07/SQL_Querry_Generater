param(
  [string]$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
)

$ErrorActionPreference = "Stop"

$distRoot = Join-Path $ProjectRoot "dist"
$setupRoot = Join-Path $ProjectRoot "setup"
$workRoot = Join-Path $setupRoot "setup-build"
$outputExe = Join-Path $setupRoot "Easy-SQL-Setup.exe"
$iconPath = Join-Path $ProjectRoot "src\assets\easy-sql.ico"

$latestBuild = Get-ChildItem -LiteralPath $distRoot -Directory |
  Where-Object { $_.Name -like "Easy-SQL-win32-x64-*" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $latestBuild) {
  throw "No Easy-SQL build found. Run npm run package first."
}

New-Item -ItemType Directory -Force -Path $setupRoot | Out-Null
Remove-Item -Recurse -Force -LiteralPath $workRoot -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $workRoot | Out-Null

$payloadZip = Join-Path $workRoot "Easy-SQL.zip"
$sourceFile = Join-Path $workRoot "EasySqlSetup.cs"

Push-Location $latestBuild.FullName
try {
  & "$env:WINDIR\system32\tar.exe" -a -cf $payloadZip *
  if ($LASTEXITCODE -ne 0) {
    throw "tar.exe failed to create setup payload."
  }
}
finally {
  Pop-Location
}

@'
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;

class EasySqlSetup
{
    [STAThread]
    static int Main()
    {
        try
        {
            string installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                "Easy-SQL");
            string exePath = Path.Combine(installDir, "Easy-SQL.exe");
            string tempZip = Path.Combine(Path.GetTempPath(), "Easy-SQL-" + Guid.NewGuid().ToString("N") + ".zip");

            if (Directory.Exists(installDir))
            {
                Directory.Delete(installDir, true);
            }
            Directory.CreateDirectory(installDir);

            using (Stream source = Assembly.GetExecutingAssembly().GetManifestResourceStream("EasySQL.Payload.zip"))
            using (FileStream target = File.Create(tempZip))
            {
                if (source == null) throw new Exception("Installer payload was not found.");
                source.CopyTo(target);
            }

            ZipFile.ExtractToDirectory(tempZip, installDir);
            File.Delete(tempZip);

            CreateShortcut(
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Easy-SQL.lnk"),
                exePath,
                installDir);

            string programsDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Microsoft",
                "Windows",
                "Start Menu",
                "Programs",
                "Easy-SQL");
            Directory.CreateDirectory(programsDir);
            CreateShortcut(Path.Combine(programsDir, "Easy-SQL.lnk"), exePath, installDir);

            Process.Start(exePath);
            return 0;
        }
        catch (Exception ex)
        {
            System.Windows.Forms.MessageBox.Show(
                ex.Message,
                "Easy-SQL Setup",
                System.Windows.Forms.MessageBoxButtons.OK,
                System.Windows.Forms.MessageBoxIcon.Error);
            return 1;
        }
    }

    static void CreateShortcut(string shortcutPath, string targetPath, string workingDirectory)
    {
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(shellType);
        object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
        Type shortcutType = shortcut.GetType();
        shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
        shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workingDirectory });
        shortcutType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { targetPath + ",0" });
        shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
        Marshal.FinalReleaseComObject(shortcut);
        Marshal.FinalReleaseComObject(shell);
    }
}
'@ | Set-Content -LiteralPath $sourceFile -Encoding ASCII

$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
  throw "Could not find .NET C# compiler at $csc"
}

Remove-Item -Force -LiteralPath $outputExe -ErrorAction SilentlyContinue
& $csc `
  /nologo `
  /target:winexe `
  /optimize+ `
  /win32icon:$iconPath `
  /out:$outputExe `
  /resource:$payloadZip,EasySQL.Payload.zip `
  /reference:System.IO.Compression.dll `
  /reference:System.IO.Compression.FileSystem.dll `
  /reference:System.Windows.Forms.dll `
  $sourceFile

if ($LASTEXITCODE -ne 0) {
  throw "csc.exe failed to create setup exe."
}

if (-not (Test-Path $outputExe)) {
  throw "Setup exe was not created."
}

Write-Host "Created setup installer at $outputExe"
