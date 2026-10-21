# Installs Crate (Spicetify custom app) from the latest GitHub release.
#   iwr -useb https://raw.githubusercontent.com/Tekno-Vex/crate/main/install.ps1 | iex
# Dev/testing only: $env:CRATE_ZIP = local zip instead of downloading; $env:CRATE_SKIP_APPLY = 1.

function Install-Crate {
  $ErrorActionPreference = 'Stop'
  $repo = 'Tekno-Vex/crate'

  if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    Write-Host 'Spicetify was not found. Install it first: https://spicetify.app' -ForegroundColor Red
    return
  }
  $version = (spicetify -v | Select-Object -Last 1).Trim()
  try {
    if ([version]$version -lt [version]'2.46.0') {
      Write-Host "Spicetify $version is older than 2.46 - right-click menus break on Spotify 1.3.5+." -ForegroundColor Yellow
      Write-Host "Update first: spicetify upgrade; spicetify restore backup apply" -ForegroundColor Yellow
    }
  } catch { }

  $configFile = (spicetify -c | Select-Object -Last 1).Trim()
  $dest = Join-Path (Split-Path $configFile) 'CustomApps\crate'

  $zip = $env:CRATE_ZIP
  $downloaded = $false
  if (-not $zip) {
    $zip = Join-Path ([IO.Path]::GetTempPath()) 'crate.zip'
    Write-Host 'Downloading Crate...'
    Invoke-WebRequest -UseBasicParsing "https://github.com/$repo/releases/latest/download/crate.zip" -OutFile $zip
    $downloaded = $true
  }
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $dest -Force
  if ($downloaded) { Remove-Item $zip }
  Write-Host "Installed to $dest"

  # Register once — custom_apps is a "|"-separated list in config-xpui.ini.
  $line = Select-String -Path $configFile -Pattern '^\s*custom_apps\s*=\s*(.*)$' | Select-Object -First 1
  $apps = if ($line) { $line.Matches[0].Groups[1].Value -split '\|' | ForEach-Object { $_.Trim() } } else { @() }
  if ($apps -notcontains 'crate') { spicetify config custom_apps crate }

  if ($env:CRATE_SKIP_APPLY) { Write-Host 'Skipping spicetify apply (CRATE_SKIP_APPLY).'; return }
  spicetify apply
  Write-Host 'Done - open Crate from the top bar in Spotify.' -ForegroundColor Green
}

Install-Crate
