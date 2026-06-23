# vhs tape — records demo/repolish.gif. Regenerate with:  vhs demo/repolish.tape
Output demo/repolish.gif

Require bun

Set Shell bash
Set FontSize 16
Set Width 1180
Set Height 860
Set Padding 26
Set Theme "Catppuccin Mocha"
Set TypingSpeed 32ms

# --- setup (hidden): cd in, put the wrapper on PATH, paint the hero card ---
Hide
Type "cd /Users/hamza/Claude/Repolish" Enter
Type 'export PATH="$PWD/demo:$PATH"' Enter
Type "clear" Enter
Type "bash demo/intro.sh" Enter
Show

# Opening frame: the hero — name, tagline, what repolish does.
Sleep 3500ms

# 1) Run repolish on a repo whose README oversells itself.
Hide
Type "clear" Enter
Show
Type "repolish demo/sample-repo --write" Sleep 600ms Enter
Sleep 5500ms

# 2) Peek at the premium README it drafted.
Hide
Type "clear" Enter
Show
Type "head -22 demo/sample-repo/.repolish/README.draft.md" Sleep 600ms Enter
Sleep 4500ms
