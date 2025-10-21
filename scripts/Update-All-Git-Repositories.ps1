###############################################################################
# Script Name: Update-All-Git-Repositories.ps1
# Description: This PowerShell script performs a batch "git pull" operation on
#              multiple repositories to keep them synchronized with remote sources.
###############################################################################

# === Configuration Section ===================================================

# Define a list containing full paths to your repositories
$RepositoryPathList = @(
    "D:\Private\Projects\2dust\v2rayNG",
    "D:\Private\Projects\aria2\aria2",
    "D:\Private\Projects\dotnet\sdk",
    "D:\Private\Projects\git\git",
    "D:\Private\Projects\ip7z\7zip",
    "D:\Private\Projects\Klocman\Bulk-Crap-Uninstaller",
    "D:\Private\Projects\MBackspace\nextjs",
    "D:\Private\Projects\microsoft\PowerToys",
    "D:\Private\Projects\microsoft\vscode",
    "D:\Private\Projects\nodejs\node",
    "D:\Private\Projects\npm\cli",
    "D:\Private\Projects\obsproject\obs-studio",
    "D:\Private\Projects\openjdk\jdk",
    "D:\Private\Projects\pbatard\rufus",
    "D:\Private\Projects\pnpm\pnpm",
    "D:\Private\Projects\python\cpython",
    "D:\Private\Projects\rclone\rclone",
    "D:\Private\Projects\v2rayA\v2rayA",
    "D:\Private\Projects\yarnpkg\berry",
    "D:\Private\Projects\yarnpkg\yarn"
)

# Define a log file to record the update process
$ScriptDirectoryPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$LogFilePath = Join-Path $ScriptDirectoryPath "Update-All-Git-Repositories.ps1.log"

# === Variables to Track the Results =======================================
$TotalRepositories = $RepositoryPathList.Count
$SuccessfulUpdates = 0
$RetryCountMap = @{}  # To keep track of retry counts for each repository

# === Script Execution Section ===============================================

Add-Content -Path $LogFilePath -Value ("=====================================================================")
Add-Content -Path $LogFilePath -Value ("Batch Git Pull Process Started at $(Get-Date)")
Add-Content -Path $LogFilePath -Value ("=====================================================================")

foreach ($RepositoryPath in $RepositoryPathList) {
    Add-Content -Path $LogFilePath -Value ""
    Add-Content -Path $LogFilePath -Value ("-------------------------------------------------------------")
    Add-Content -Path $LogFilePath -Value ("Processing repository: $RepositoryPath")
    Add-Content -Path $LogFilePath -Value ("-------------------------------------------------------------")

    if (Test-Path -Path (Join-Path $RepositoryPath ".git")) {
        $UpdateSuccess = $false
        $RetryCount = 0

        while (-not $UpdateSuccess) {
            try {
                Set-Location $RepositoryPath
                Add-Content -Path $LogFilePath -Value ("Executing: git pull")
                $Output = git pull 2>&1

                # Check if the command was successful by the exit code
                if ($?) {
                    Add-Content -Path $LogFilePath -Value $Output
                    Add-Content -Path $LogFilePath -Value ("Completed update for: $RepositoryPath")
                    $SuccessfulUpdates++
                    $UpdateSuccess = $true

                    # === Update parent folder timestamp ===
                    $ParentDir = Split-Path $RepositoryPath -Parent
                    if (Test-Path $ParentDir) {
                        (Get-Item $ParentDir).LastWriteTime = Get-Date
                        Add-Content -Path $LogFilePath -Value ("Updated parent directory timestamp: $ParentDir")
                    }
                } else {
                    Add-Content -Path $LogFilePath -Value ("Error during git pull for $RepositoryPath : $Output")
                    Add-Content -Path $LogFilePath -Value ("Retrying...")

                    # Increment retry count
                    $RetryCount++
                    $RetryCountMap[$RepositoryPath] = $RetryCount

                    # Sleep before retrying
                    Start-Sleep -Seconds 5
                }
            }
            catch {
                Add-Content -Path $LogFilePath -Value ("Unexpected error during git pull for $RepositoryPath : $_")
                Add-Content -Path $LogFilePath -Value ("Retrying...")

                # Increment retry count
                $RetryCount++
                $RetryCountMap[$RepositoryPath] = $RetryCount

                # Sleep before retrying
                Start-Sleep -Seconds 5
            }
        }
    }
    else {
        Add-Content -Path $LogFilePath -Value ("Warning: $RepositoryPath is not a valid Git repository.")
    }
}

Add-Content -Path $LogFilePath -Value ""
Add-Content -Path $LogFilePath -Value ("=====================================================================")
Add-Content -Path $LogFilePath -Value ("Batch Git Pull Process Completed at $(Get-Date)")
Add-Content -Path $LogFilePath -Value ("=====================================================================")

# Summary statistics
Add-Content -Path $LogFilePath -Value ("Total Repositories: $TotalRepositories")
Add-Content -Path $LogFilePath -Value ("Successfully Updated Repositories: $SuccessfulUpdates")

# Only display "Repositories with Retries:" if there are any retries
if ($RetryCountMap.Count -gt 0) {
    Add-Content -Path $LogFilePath -Value ("Repositories with Retries:")
    foreach ($repo in $RetryCountMap.Keys) {
        Add-Content -Path $LogFilePath -Value ("$repo - Retries: $($RetryCountMap[$repo])")
    }
}

Add-Content -Path $LogFilePath -Value ("=====================================================================")

# Reset the working directory back to where the script was started
Set-Location $PSScriptRoot
