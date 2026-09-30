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
# Define the directory to search for .exe files

$homeDir = $env:USERPROFILE
$directory = "$homeDir\workspace\toolbox\apps"
Write-Host $directory
# Use Get-ChildItem to find .exe files and pipe them to fzf
$selectedExe = Get-ChildItem -Path $directory -Filter *.exe -Recurse | 
    Select-Object -ExpandProperty FullName | 
    fzf

# Check if an executable was selected
if ($selectedExe) {
    # Run the selected executable
    Start-Process -FilePath $selectedExe
} else {
    Write-Host "No executable selected."
}
