
# Define a list of common keyboard shortcuts
$shortcuts = @(
    @{ Shortcut = "Ctrl + C"; Action = "Copy" },
    @{ Shortcut = "Ctrl + V"; Action = "Paste" },
    @{ Shortcut = "Ctrl + X"; Action = "Cut" },
    @{ Shortcut = "Ctrl + Z"; Action = "Undo" },
    @{ Shortcut = "Ctrl + Y"; Action = "Redo" },
    @{ Shortcut = "Ctrl + A"; Action = "Select All" },
    @{ Shortcut = "Alt + Tab"; Action = "Switch between open applications" },
    @{ Shortcut = "Alt + F4"; Action = "Close the active window" },
    @{ Shortcut = "Windows + D"; Action = "Show desktop" },
    @{ Shortcut = "Windows + L"; Action = "Lock your PC" },
    @{ Shortcut = "Windows + E"; Action = "Open File Explorer" },
    @{ Shortcut = "Windows + R"; Action = "Open Run dialog" },
    @{ Shortcut = "F2"; Action = "Rename selected item" },
    @{ Shortcut = "F5"; Action = "Refresh the active window" },
    @{ Shortcut = "Ctrl + Shift + Esc"; Action = "Open Task Manager" },
    @{ Shortcut = "Windows + I"; Action = "Open Settings" }
)

# Display the shortcuts
Write-Host "Common Keyboard Shortcuts:" -ForegroundColor Cyan
Write-Host "---------------------------" -ForegroundColor Cyan

foreach ($shortcut in $shortcuts) {
    Write-Host "$($shortcut.Shortcut) - $($shortcut.Action)"
}
