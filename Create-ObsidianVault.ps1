
# --- Configuration ---
$VaultName = "MyKnowledgeVault"
$RootPath = Join-Path $HOME "Documents\$VaultName"

# Define the folder structure
# Using a numbered system (e.g., 00, 10) keeps folders sorted logically regardless of name
$Folders = @(
    "00_Inbox",          # Quick notes, raw thoughts, unsorted idea
    "10_Blog_Drafts",    # Your specific area for the Vim -> Typst pipeline
    "20_Knowledge",      # Your permanent Zettelkasten/Wiki/Atlas
    "30_Projects",       # Active projects
    "40_Archive",        # Completed projects and old notes
    "Attachments",       # Images, PDFs, and assets (keeps the root clean)
    "Templates"          # Reusable Markdown structures
)

Write-Host "Creating Obsidian Vault at: $RootPath" -ForegroundColor Cyan

# Create the root directory
if (!(Test-Path $RootPath)) {
    New-Item -ItemType Directory -Path $RootPath | Out-Null
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
# Welcome to your Vault

This vault was created via PowerShell to ensure 1:1 alignment with Vim.

## Quick Start
- Use `00_Inbox` for raw thoughts.
- Use `10_Blog_Drafts` for your Typst-Vim9Script pipeline.
- Store all images in `Attachments`.

## Alignment Check
This is a standard Markdown paragraph. No bullets here, so it will look exactly the same in Vim and Obsidian.
"@

Set-Content -Path $WelcomeFile -Value $WelcomeContent

Write-Host "`nSuccess! You can now start adding .md files to this folder using Vim." -ForegroundColor Cyan
Write-Host "When you install Obsidian, simply select 'Open folder as vault' and choose: $RootPath" -ForegroundColor Yellow
