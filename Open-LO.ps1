# Define a parameter for the script
param([string]$file)

# Get the current working folder
$folder = Get-Location

# Combine the folder and the file name into a full path
$path = Join-Path $folder $file

# Open the file with LibreOffice
Start-Process "C:\Program Files\LibreOffice\program\soffice.exe" $path
