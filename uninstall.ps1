# Removes Crate.
#   iwr -useb https://raw.githubusercontent.com/Tekno-Vex/crate/main/uninstall.ps1 | iex

function Uninstall-Crate {
  $ErrorActionPreference = 'Stop'
  if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    Write-Host 'Spicetify was not found.' -ForegroundColor Red
    return
  }
  $configFile = (spicetify -c | Select-Object -Last 1).Trim()
  spicetify config custom_apps crate-
  spicetify apply
  $dest = Join-Path (Split-Path $configFile) 'CustomApps\crate'
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Write-Host 'Crate removed.' -ForegroundColor Green
}

Uninstall-Crate
