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
# Get the current working directory
$workingDirectory = Get-Location

# Get all directories in the current working directory
$directories = Get-ChildItem -Path $workingDirectory -Directory

# Calculate the size of each directory
$directorySizes = foreach ($dir in $directories) {
    $size = (Get-ChildItem -Path $dir.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
    [PSCustomObject]@{
        Directory = $dir.FullName
        Size      = $size
    }
}

# Sort the directories by size and select the top 10
$largestDirectories = $directorySizes | Sort-Object -Property Size -Descending | Select-Object -First 10

# Display the results
$largestDirectories | Format-Table -AutoSize
