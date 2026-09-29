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
function Show-Tree {
    param (
        [string]$Path = ".",
        [string]$Indent = ""
    )

    $Children = Get-ChildItem -Path $Path
    foreach ($Child in $Children) {
        $Line = $Indent + "+-- " + $Child.Name
        Write-Host $Line

        if ($Child.PSIsContainer) {
            Show-Tree -Path $Child.FullName -Indent ($Indent + "|   ")
        }
    }
}

# Usage:
# Call the function with the path of the folder you want to list
Show-Tree -Path "."
