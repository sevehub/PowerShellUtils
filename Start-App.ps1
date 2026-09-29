
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
