param (
    [string]$executablePath
)

# Check if the executable path is provided
if (-not $executablePath) {
    Write-Host "Please provide the path to the executable."
    exit
}

# Measure the startup time
$timeTaken = Measure-Command {
    Start-Process -FilePath $executablePath -Wait
}

# Output the time taken
Write-Host "Startup time: $($timeTaken.TotalMilliseconds) ms"
