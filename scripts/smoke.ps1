$ErrorActionPreference = "Stop"

$createdEnvFile = $false

if (-not (Test-Path -LiteralPath ".env")) {
    Copy-Item -LiteralPath ".env.example" -Destination ".env"
    $createdEnvFile = $true
}

$RepoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
    }
}

function Invoke-InDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [scriptblock]$ScriptBlock
    )

    Push-Location -LiteralPath $Path
    try {
        & $ScriptBlock
    }
    finally {
        Pop-Location
    }
}

Invoke-InDirectory $RepoRoot {
    try {
        Invoke-NativeCommand docker @("compose", "--env-file", ".env.example", "config")

        Invoke-InDirectory (Join-Path $RepoRoot "apps/api") {
            Invoke-NativeCommand npm @("test")
            Invoke-NativeCommand npm @("run", "build")
        }

        Invoke-InDirectory (Join-Path $RepoRoot "apps/web") {
            Invoke-NativeCommand npm @("test")
            Invoke-NativeCommand npm @("run", "build")
        }

        Invoke-InDirectory (Join-Path $RepoRoot "apps/zalo-connector") {
            Invoke-NativeCommand go @("test", "./...")

            $ConnectorBuildOutput = Join-Path $env:TEMP "zalo-connector-smoke-$PID.exe"
            try {
                Invoke-NativeCommand go @("build", "-o", $ConnectorBuildOutput, "./cmd/connector")
            }
            finally {
                if (Test-Path -LiteralPath $ConnectorBuildOutput) {
                    Remove-Item -LiteralPath $ConnectorBuildOutput -Force
                }
            }
        }

        "Smoke checks passed"
    }
    finally {
        if ($createdEnvFile -and (Test-Path -LiteralPath ".env")) {
            Remove-Item -LiteralPath ".env"
        }
    }
}
