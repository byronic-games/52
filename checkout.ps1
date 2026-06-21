param(
    [string]$Message = "Game updates",
    [string]$Branch = "main",
    [string]$Remote = "origin"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Always run git commands from the script's directory so callers can invoke
# this script from anywhere.
Set-Location -LiteralPath $PSScriptRoot

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Invoke-Git {
    param(
        [string[]]$GitArgs = @()
    )

    if ($GitArgs.Count -eq 0) {
        throw "Invoke-Git called without arguments."
    }

    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Invoke-GitCapture {
    param(
        [string[]]$GitArgs = @()
    )

    if ($GitArgs.Count -eq 0) {
        throw "Invoke-GitCapture called without arguments."
    }

    $output = & git @GitArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed.`n$output"
    }
    return ($output -join "`n").Trim()
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed or not on PATH. Install Git and restart your terminal."
}

$repoRoot = Invoke-GitCapture @("rev-parse", "--show-toplevel")
if (-not $repoRoot) {
    throw "No git repository found at '$PSScriptRoot'. Clone or initialize the repo in this folder first."
}

Write-Step "Syncing local branch '$Branch' from '$Remote/$Branch'"
Invoke-Git @("fetch", $Remote, $Branch)

Write-Step "Checking out '$Branch'"
& git show-ref --verify --quiet "refs/heads/$Branch"
if ($LASTEXITCODE -eq 0) {
    Invoke-Git @("checkout", $Branch)
} elseif ($LASTEXITCODE -eq 1) {
    Invoke-Git @("checkout", "-b", $Branch, "$Remote/$Branch")
} else {
    throw "Unable to determine whether local branch '$Branch' exists (exit code $LASTEXITCODE)."
}

Write-Step "Staging changes"
Invoke-Git @("add", "--all")

$hasChanges = $false
& git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    $hasChanges = $true
} elseif ($LASTEXITCODE -ne 0) {
    throw "git diff --cached --quiet failed with exit code $LASTEXITCODE."
}

if ($hasChanges) {
    Write-Step "Creating commit"
    Invoke-Git @("commit", "-m", $Message)
} else {
    Write-Step "No staged changes detected, skipping commit"
}

Write-Step "Rebasing onto '$Remote/$Branch'"
Invoke-Git @("pull", "--rebase", $Remote, $Branch)

Write-Step "Pushing to '$Remote/$Branch'"
Invoke-Git @("push", $Remote, $Branch)

Write-Host ""
Write-Host "Done. Branch '$Branch' is up to date on '$Remote'." -ForegroundColor Green
