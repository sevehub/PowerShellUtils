
<#
.SYNOPSIS
    Creates a structured Obsidian Vault directory optimized for Vim alignment.

.DESCRIPTION
    This script sets up a curated folder hierarchy for a Personal Knowledge Management (PKM) 
    system. It is specifically designed to avoid "Outliner's Tax" by using a linear Markdown 
    structure compatible with Vim and static site generators.

.PARAMETER VaultName
    The name of the vault folder to be created. Defaults to 'MyKnowledgeVault'.

.PARAMETER SetLocal
    If specified, the vault will be created in the same directory as the script 
    instead of the user's Documents folder.

.EXAMPLE
    .\CreateVault.ps1 -VaultName "SecondBrain"
    Creates a vault named 'SecondBrain' in the Documents folder.

.EXAMPLE
    .\CreateVault.ps1 -VaultName "WorkVault" -SetLocal
    Creates a vault named 'WorkVault' in the current local directory.
#>
param (
    [Parameter(HelpMessage = "Name of the Obsidian Vault")]
    [string]$VaultName = "MyKnowledgeVault",

    [Parameter(HelpMessage = "Create the vault in the current local folder")]
    [switch]$SetLocal
)

# Determine Root Path
if ($SetLocal) {
    # $PSScriptRoot is the directory where the .ps1 file is located
    $BaseDir = $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($BaseDir)) { 
        # Fallback if script is run as a selection in some consoles
        $BaseDir = Get-Location 
    }
} else {
    $BaseDir = Join-Path $HOME "Documents"
}

$RootPath = Join-Path $BaseDir $VaultName

# Define the folder structure
$Folders = @(
    "00_Inbox",          # Quick notes, raw thoughts, unsorted idea
    "10_Blog_Drafts",    # Specific area for the Vim -> Typst pipeline
    "20_Knowledge",      # Permanent Zettelkasten/Wiki/Atlas
    "30_Projects",       # Active projects
    "40_Archive",        # Completed projects and old notes
    "Attachments",       # Images, PDFs, and assets
    "Templates"          # Reusable Markdown structures
)

Write-Host "`n--- Obsidian Vault Initializer ---" -ForegroundColor Cyan
Write-Host "Target Location: $RootPath" -ForegroundColor White

# Create the root directory
if (!(Test-Path $RootPath)) {
    try {
        New-Item -ItemType Directory -Path $RootPath -ErrorAction Stop | Out-Null
        Write-Host "[+] Root directory created." -ForegroundColor Green
    } catch {
        Write-Error "Failed to create root directory: $($_.Exception.Message)"
        return
    }
} else {
    Write-Host "[!] Root directory already exists. Adding subfolders..." -ForegroundColor Yellow
}

# Create subfolders
foreach ($Folder in $Folders) {
    $FolderPath = Join-Path $RootPath $Folder
    if (!(Test-Path $FolderPath)) {
        New-Item -ItemType Directory -Path $FolderPath | Out-Null
        Write-Host "  [+] Created: $Folder" -ForegroundColor Green
    }
}

# Create a welcome file to test alignment
$WelcomeFile = Join-Path $RootPath "Welcome.md"
$WelcomeContent = @"
# Welcome to your Vault: $VaultName

This vault was created via PowerShell to ensure 1:1 alignment with Vim.

## Quick Start
- Use `00_Inbox` for raw thoughts.
- Use `10_Blog_Drafts` for your Typst-Vim9Script pipeline.
- Store all images in `Attachments`.

## Alignment Check
This is a standard Markdown paragraph. No bullets here, so it will look exactly the same in Vim and Obsidian.
"@

Set-Content -Path $WelcomeFile -Value $WelcomeContent

Write-Host "`nSuccess! You can now start adding .md files using Vim." -ForegroundColor Cyan
Write-Host "In Obsidian: Select 'Open folder as vault' -> $RootPath" -ForegroundColor Yellow
Write-Host "----------------------------------`n"


