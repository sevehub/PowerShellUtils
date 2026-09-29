# RGrep.ps1
#
# usage: .\Rgrep.ps1 -pattern "your_regex_pattern_here"
param(
    [string]$pattern
)

# Ensure ripgrep is installed and accessible
if (-not(Get-Command "rg" -ErrorAction SilentlyContinue)) {
    Write-Error "ripgrep (rg) is not installed or not in PATH."
    exit 1
}

# Search for the pattern using ripgrep
$rgOutput = rg --column --line-number --no-heading --color never $pattern -g "*" .

# Process the output to match the desired format
$rgOutput | ForEach-Object {
    $splitLine = $_ -split ':'
    $filePath = $splitLine[0]
    $line = $splitLine[1]
    $column = $splitLine[2]
    $textLine = $splitLine[3]
    # Correctly format the output
    "${filePath}:$($line):$($column):$textLine"
}
