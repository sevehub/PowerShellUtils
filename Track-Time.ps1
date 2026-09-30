<#
Copyright 2026 Sevetech

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
#>
# Load the TOML configuration
function Load-TomlConfig {
    param (
        [string]$filePath
    )

    $tomlContent = Get-Content -Path $filePath -Raw
    $config = @{}
    
    foreach ($line in $tomlContent -split "`n") {
        if ($line -match '^\s*$$([^$$]+)\]') {
            $currentSection = $matches[1]
        } elseif ($line -match '^\s*([^=]+)=(.*)') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"')
            $config[$currentSection][$key] = $value
        }
    }
    
    return $config
}

# Get the user's AppData directory
$appDataDir = [System.Environment]::GetFolderPath('ApplicationData')
$configFilePath = Join-Path -Path $appDataDir -ChildPath "TT\config.toml"

Write-Output $configFilePath
# Load configuration
$config = Load-TomlConfig -filePath $configFilePath
Write-Output $config
$csvFilePath = $config['settings']['csv_file']

# Ensure the directory for the CSV file exists
$csvDir = Split-Path -Path $csvFilePath -Parent
if (-not (Test-Path -Path $csvDir)) {
    New-Item -ItemType Directory -Path $csvDir -Force
}

# Function to track time
function Track-Time {
    param (
        [string]$projectName
    )

    $startTime = Get-Date
    Write-Host "Tracking time for project '$projectName'. Press Enter to stop..."
    Read-Host
    $endTime = Get-Date

    $duration = $endTime - $startTime
    $durationInMinutes = [math]::Round($duration.TotalMinutes, 2)

    # Create a record
    $record = [PSCustomObject]@{
        ProjectName = $projectName
        StartTime   = $startTime
        EndTime     = $endTime
        Duration    = $durationInMinutes
    }

    # Save to CSV
    if (-not (Test-Path -Path $csvFilePath)) {
        $record | Export-Csv -Path $csvFilePath -NoTypeInformation
    } else {
        $record | Export-Csv -Path $csvFilePath -NoTypeInformation -Append
    }

    Write-Host "Time tracked for project '$projectName': $durationInMinutes minutes."
}

# Main loop
while ($true) {
    $projectName = Read-Host "Enter project name (or type 'exit' to quit)"
    if ($projectName -eq 'exit') {
        break
    }
    Track-Time -projectName $projectName
}
