# PowerShellUtils
A collection of Powershell scripts (toolbox).

# Minivim

minivim is a single-file, dependency-free vim clone for Node.js with a built-in terminal pane, designed for editing and running PowerShell scripts without leaving the console. It starts instantly, needs no installation beyond Node, and is intended as a lightweight alternative to Notepad for quick script work.

Node.js 16 or later is required. PowerShell (`pwsh` or Windows PowerShell) is detected automatically and used for the terminal pane and for running scripts. When neither is found, the pane falls back to the system shell and `:run` is unavailable.

Browsers and SmartScreen commonly block or warn on downloaded `.js` files, so the recommended way to obtain the file is from PowerShell. 


```powershell
irm https://github.com/sevehub/PowerShellUtils/minivim.js -OutFile minivim.js
node minivim.js script.ps1
```

Editing follows vim conventions. Files without a name can be saved with `:w name.ps1`. Pressing F5 in any mode, or entering `:run [args]`, saves the buffer and executes it with `powershell -File`, with the output shown in the pane below the code. When the run reports errors, the `At file.ps1:12 char:5` locations are collected, and `:cn` and `:cp` jump to the next and previous location. PowerShell syntax highlighting (comments including `<# #>` blocks, strings, variables, Verb-Noun cmdlets, keywords, parameters, numbers) is enabled automatically for `.ps1`, `.psm1`, and `.psd1` files and can be toggled with `:syntax on|off`.

The terminal pane is opened with `:term` and closed with `:termclose`. Ctrl-W moves focus between the editor and the pane, and Esc inside the pane returns to the editor. Commands typed in the pane are executed through PowerShell, `cd`, `sl`, and `Set-Location` change the pane directory, and Ctrl-C stops a running process. The up and down keys recall command history, and `:!command` runs a single command in the pane from the editor. `:resize N` sets the pane height.

Any PowerShell command or script can be run against the buffer as a filter. `:[range]!command` pipes the lines of the range into the command, where they are available as `$input`, and replaces the range with the output. The range can be `%` (whole buffer), `N,M`, `.`, `$`, or the visual selection, which is entered by pressing `:` in visual mode. When the command does not mention `$input`, the lines are piped into it automatically, so `:%!Sort-Object -Unique` and `:%!.\fix-tabs.ps1` both work, the latter passing the lines to the script's own `$input`. The filter is a single undo step. The buffer is left unchanged, and the error text is shown in the pane, when the exit code is non-zero or anything is written to the error stream. `:[range]w !command` sends the lines to a command and shows the output in the pane without modifying the buffer, and `:r !command` inserts output below the cursor line. 


Scripts started from minivim can read `$env:MINIVIM_FILE`, `$env:MINIVIM_LINE`, and `$env:MINIVIM_COL` to locate the cursor. Filters are synchronous with a 30 second timeout, so the editor waits while one runs.

Several files can be open at once, and each file given on the command line becomes a buffer (`node minivim.js a.ps1 b.ps1`). A buffer line appears at the top of the screen when more than one buffer exists. `:e file` opens a file or switches to it when already open, `:bn` and `:bp` (or `gt` and `gT`) cycle through buffers, `:b N`, `:b name`, and `:b#` jump directly, `:ls` lists them, `:bd` closes the current one, `:enew` opens an empty one, and `:wa` writes all modified buffers. `:q` refuses to quit while any buffer has unsaved changes, `:qa!` quits regardless, and `:wqa` saves everything and quits. Undo history is kept separately for each buffer.

```
Modes      i a I A o O   insert          v V   visual (char / line)
           :             command         /     search (n, N)
Motions    h j k l  w b e  0 ^ $  gg G  Ctrl-D Ctrl-U   (counts supported)
Operators  d y c + motion, dd yy cc, x X D C s S Y, p P, J, r
Undo       u   Ctrl-R
Ex         :w [file]  :q  :q!  :wq  :x  :N (goto line)  :e! (reload)
           :run [args]  :cn  :cp  :syntax on|off
           :[range]!cmd  :[range]w !cmd  :r !cmd  :r file
           :e file  :enew  :bn  :bp  :b N|name|#  :ls  :bd[!]  :wa  :qa[!]  :wqa
           :term [cmd]  :termclose  :resize N  :!cmd
Keys       F5 run script   Ctrl-W switch pane focus   gt / gT next / previous buffer
```

The current version has known limitations. The terminal pane uses plain pipes instead of a pseudo-terminal, so full-screen or prompt-driven programs (vim, htop, interactive REPLs) do not work correctly, while ordinary commands and scripts do. Tabs are converted to two spaces on load. Dot-repeat, text objects such as `diw` and `ci"`, named registers, marks, macros, and split windows are not implemented. Undo is snapshot-based and is intended for files of moderate size.

Planned work depends on feedback and may include a real terminal through the optional `node-pty` package, text objects, dot-repeat, and a single-executable build. Issues and suggestions are welcome.
