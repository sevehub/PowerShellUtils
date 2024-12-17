<#
    Copyright (c) 2024 S. Tessarin
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


param (
    [switch]$Help,
    [string]$Exe,
    [switch]$Clip
)


# Function to display help information
function Show-Help {
    Write-Host "SYNOPSIS"
    Write-Host "    Get the full path of an executable using Get-Command."
    Write-Host ""
    Write-Host "DESCRIPTION"
    Write-Host "    This script retrieves the full path of an executable using Get-Command."
    Write-Host "    You can optionally copy the path to the clipboard using the -Clip switch."
    Write-Host ""
    Write-Host "PARAMETER ExecutableName"
    Write-Host "    The name of the executable to query."
    Write-Host ""
    Write-Host "SWITCH Clip"
    Write-Host "    Copy the path to the clipboard."
    Write-Host ""
    Write-Host "SWITCH Help"
    Write-Host "    Display this help message."
    Write-Host ""
    Write-Host "EXAMPLE"
    Write-Host "    .\Where.ps1 -Exe 'ninja'"
    Write-Host "    Retrieves and displays the path to the 'ninja' executable."
    Write-Host ""
    Write-Host "    .\Where.ps1 -Exe 'pwsh' -Clip"
    Write-Host "    Retrieves the path to 'pwsh' and copies it to the clipboard."
}

# Check if the Help switch is provided
if ($Help) {
    Show-Help
    exit
}


# Check if the Exe parameter is provided and not empty
if (-not $Exe) {
    Write-Host "Error: The -Exe parameter is required."
    Show-Help
    exit 1
}

# Check if the executable exists
$command = Get-Command -Name $Exe -ErrorAction SilentlyContinue

if ($null -eq $command) {
    Write-Host "Error: The executable '$Exe' was not found in the system PATH."
    exit 1
}

# Get the path of the executable
$ExecutablePath = $command.Source
Write-Host "Path to '$Exe': $ExecutablePath"

if ($Clip) {
    $ExecutablePath | Set-Clipboard
    Write-Host "Path copied to clipboard."
}

<#
.SYNOPSIS
    Get the full path of an executable using Get-Command.

.DESCRIPTION
    This script retrieves the full path of an executable using Get-Command.
    You can optionally copy the path to the clipboard using the -Clip switch.

.PARAMETER ExecutableName
    The name of the executable to query.

.SWITCH Clip
    Copy the path to the clipboard.

.EXAMPLE
    .\Where.ps1 -ExecutableName "ninja"
    Retrieves and displays the path to the 'ninja' executable.

.EXAMPLE
    .\Where.ps1 -ExecutableName "pwsh" -Clip
    Retrieves the path to 'pwsh' and copies it to the clipboard.
#>
