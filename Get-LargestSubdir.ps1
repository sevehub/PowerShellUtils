
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

# Find the largest 5 subdirectories in the current directory with size in MB
Get-ChildItem -Directory | 
    ForEach-Object { 
        $sizeBytes = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::round($sizeBytes / 1MB, 2)  # Convert size to MB and round to 2 decimal places
        [PSCustomObject]@{
            Name = $_.FullName
            SizeMB = $sizeMB
        }
    } | 
    Sort-Object -Property SizeMB -Descending | 
    Select-Object -First 5

