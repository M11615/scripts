###############################################################################
# Script Name: update-all-git-repositories.ps1
# Description: Batch update multiple Git repositories (git pull) from an external list file.
###############################################################################

# === Configuration Section ===================================================

# The external repository list file (one path per line)
$ScriptDirectoryPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepositoryListFile  = Join-Path $ScriptDirectoryPath "repositories.txt"
$LogFilePath         = Join-Path $ScriptDirectoryPath "update-all-git-repositories.ps1.log"

# === Load Repositories from File =============================================
if (-Not (Test-Path $RepositoryListFile)) {
    Write-Host "Repository list file not found: $RepositoryListFile"
    Write-Host "Please create it with one repository path per line."
    exit 1
}

# Read non-empty, non-comment lines
$RepositoryPathList = Get-Content $RepositoryListFile | Where-Object { $_ -and ($_ -notmatch "^\s*#") }

if ($RepositoryPathList.Count -eq 0) {
    Write-Host "No valid repository paths found in $RepositoryListFile"
    exit 1
}

# === Variables to Track the Results ==========================================
$TotalRepositories  = $RepositoryPathList.Count
$SuccessfulUpdates  = 0
$RetryCountMap      = @{}

# === Logging Helper ==========================================================
function Log($message) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $LogFilePath -Value "[$timestamp] $message"
}

# === Script Execution Section ===============================================

Log "====================================================================="
Log "Batch Git Pull Process Started at $(Get-Date)"
Log "Repositories file: $RepositoryListFile"
Log "====================================================================="

foreach ($RepositoryPath in $RepositoryPathList) {
    Log ""
    Log "-------------------------------------------------------------"
    Log "Processing repository: $RepositoryPath"
    Log "-------------------------------------------------------------"

    if (Test-Path -Path (Join-Path $RepositoryPath ".git")) {
        $UpdateSuccess = $false
        $RetryCount = 0

        while (-not $UpdateSuccess) {
            try {
                Set-Location $RepositoryPath
                Log "Executing: git pull"
                $Output = git pull 2>&1

                if ($LASTEXITCODE -eq 0) {
                    Log $Output
                    Log "Completed update for: $RepositoryPath"
                    $SuccessfulUpdates++
                    $UpdateSuccess = $true

                    # Update parent folder timestamp
                    $ParentDir = Split-Path $RepositoryPath -Parent
                    if (Test-Path $ParentDir) {
                        (Get-Item $ParentDir).LastWriteTime = Get-Date
                        Log "Updated parent directory timestamp: $ParentDir"
                    }
                } else {
                    Log "git pull failed for $RepositoryPath : $Output"
                    Log "Retrying..."
                    $RetryCount++
                    $RetryCountMap[$RepositoryPath] = $RetryCount
                    Start-Sleep -Seconds 5
                }
            }
            catch {
                Log "Unexpected error during git pull for $RepositoryPath : $_"
                Log "Retrying..."
                $RetryCount++
                $RetryCountMap[$RepositoryPath] = $RetryCount
                Start-Sleep -Seconds 5
            }
        }
    }
    else {
        Log "Warning: $RepositoryPath is not a valid Git repository."
    }
}

# === Summary =================================================================
Log ""
Log "====================================================================="
Log "Batch Git Pull Process Completed at $(Get-Date)"
Log "====================================================================="
Log "Total Repositories: $TotalRepositories"
Log "Successfully Updated: $SuccessfulUpdates"

if ($RetryCountMap.Count -gt 0) {
    Log "Repositories with Retries:"
    foreach ($repo in $RetryCountMap.Keys) {
        Log "$repo - Retries: $($RetryCountMap[$repo])"
    }
}
Log "====================================================================="

Set-Location $PSScriptRoot
Write-Host "All repositories processed. Log saved to: $LogFilePath"
