param(
  [string]$EDrawingsPath = "",
  [string]$PythonPath = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HelperPath = Join-Path $ScriptDir "edrawings_helper.py"
if (-not (Test-Path -LiteralPath $HelperPath)) {
  throw "edrawings_helper.py not found: $HelperPath"
}

if (-not $PythonPath) {
  $PythonPath = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
}

if (-not $PythonPath) {
  $PythonPath = (Get-Command py.exe -ErrorAction SilentlyContinue).Source
}

if (-not $PythonPath) {
  throw "python.exe or py.exe was not found."
}

$AppDir = Join-Path $env:APPDATA "ZGG"
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null

$ConfigPath = Join-Path $AppDir "edrawings-helper.json"
@{
  edrawings_exe_path = $EDrawingsPath
} | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

if ((Split-Path -Leaf $PythonPath).ToLowerInvariant() -eq "py.exe") {
  $Command = "`"$PythonPath`" -3 `"$HelperPath`" `"%1`""
} else {
  $Command = "`"$PythonPath`" `"$HelperPath`" `"%1`""
}

$BaseKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\zgg-edrawings")
$BaseKey.SetValue("", "URL:ZGG eDrawings Protocol", [Microsoft.Win32.RegistryValueKind]::String)
$BaseKey.SetValue("URL Protocol", "", [Microsoft.Win32.RegistryValueKind]::String)
$BaseKey.Close()

$CommandKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\zgg-edrawings\shell\open\command")
$CommandKey.SetValue("", $Command, [Microsoft.Win32.RegistryValueKind]::String)
$CommandKey.Close()

Write-Host "Registered zgg-edrawings protocol."
Write-Host "Helper: $HelperPath"
Write-Host "Config: $ConfigPath"
