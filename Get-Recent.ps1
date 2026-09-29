
# Get the current working directory
$directoryPath = Get-Location

# Get all directories in the directory and subdirectories
$directories = Get-ChildItem -Path $directoryPath -Recurse -Directory

# Sort the directories by LastWriteTime and select the top 10
$recentDirectories = $directories | Sort-Object LastWriteTime -Descending | Select-Object -First 10
function Get-ISOWeekNumber {
    param (
        [datetime]$date = (Get-Date)
    )
    $dayOfYear = $date.DayOfYear
    $jan1 = [datetime]::new($date.Year, 1, 1)
    $jan1DayOfWeek = [int]$jan1.DayOfWeek
    $weekNumber = [math]::Ceiling(($dayOfYear + $jan1DayOfWeek) / 7.0)
    return $weekNumber
}

function Get-WeekDate {
    param (
        [DateTime]$date = (Get-Date)  # Default to current date if no date is provided
    )

    # Get the year
    $year = $date.Year

    # Get the week number (ISO 8601 week number)
    $weekNumber = Get-ISOWeekNumber($date)


    # Get the day of the week (ISO 8601: Monday = 1, Sunday = 7)
    $dayOfWeek = [int]$date.DayOfWeek + 1
    if ($dayOfWeek -eq 7) {
        $dayOfWeek = 1  # Adjust Sunday to be 1
    } elseif ($dayOfWeek -eq 1) {
        $dayOfWeek = 7  # Adjust Monday to be 7
    }

    # Format the week date
    $weekDate = "{0}-W{1}-D{2}" -f $year, $weekNumber, $dayOfWeek

    return $weekDate
}


# Display the results
if ($recentDirectories.Count -eq 0) {
    Write-Host "Empty"
} else {
    $counter = 1
    foreach ($dir in $recentDirectories) {
        $isoWeekDate = Get-WeekDate($dir.LastWriteTime)
        Write-Host "$counter.  $($dir.FullName) - Last Modified: $($isoWeekDate)"
        $counter++
    }
}
