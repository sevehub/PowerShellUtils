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

