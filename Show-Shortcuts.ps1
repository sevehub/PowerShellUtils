<#
Copyright 2026 Sevetech

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
#>
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
