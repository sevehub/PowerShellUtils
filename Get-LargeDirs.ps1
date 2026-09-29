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
