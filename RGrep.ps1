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
# usage: .\RGrep.ps1 -pattern "your_regex_pattern_here" [-NoIgnore]
# Respects .gitignore, .ignore, .rgignore, .git/info/exclude and the global gitignore.
# -NoIgnore searches everything, ignore files included (hidden files stay skipped).
param(
    [Parameter(Mandatory)][string]$pattern,
    [switch]$NoIgnore
)

# Ensure ripgrep is installed and accessible
if (-not(Get-Command "rg" -ErrorAction SilentlyContinue)) {
    Write-Error "ripgrep (rg) is not installed or not in PATH."
    exit 1
}

# Search for the pattern using ripgrep
# Note: an explicit -g glob overrides ignore files, so none is passed here.
# --no-require-git applies .gitignore rules even when the folder is not a git repository.
$rgArgs = @('--column', '--line-number', '--no-heading', '--color', 'never', '--no-require-git')
if ($NoIgnore) { $rgArgs += '--no-ignore' }
$rgOutput = rg @rgArgs -- $pattern .

# Process the output to match the desired format
$rgOutput | ForEach-Object {
    $splitLine = $_ -split ':', 4   # limit 4 so colons inside the matched text are kept
    $filePath = $splitLine[0]
    $line = $splitLine[1]
    $column = $splitLine[2]
    $textLine = $splitLine[3]
    # Correctly format the output
    "${filePath}:$($line):$($column):$textLine"
}







