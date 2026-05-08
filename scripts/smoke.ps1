$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot

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
    docker compose config
}

Invoke-InDirectory (Join-Path $RepoRoot "apps/api") {
    npm test
    npm run build
}

Invoke-InDirectory (Join-Path $RepoRoot "apps/web") {
    npm test
    npm run build
}

Invoke-InDirectory (Join-Path $RepoRoot "apps/zalo-connector") {
    go test ./...
    go build -o bin/zalo-connector ./cmd/connector
}

"Smoke checks passed"
