# CGx's pi-emote

Animated pixel-art emote that lives in the top-right corner of your pi TUI session. Reacts to what the agent is doing — thinking, talking, reading, writing, using tools, etc.

![pi-emote demo](pi-emote-demo.gif)

Requires a Kitty-graphics-capable terminal.

## Install

```bash
pi install git:github.com/cgxeiji/pi-emote
```

## States

| State   | Trigger                                 |
| ------- | --------------------------------------- |
| hi      | Session start                           |
| idle    | Nothing happening (blinks occasionally) |
| think   | Reasoning tokens streaming              |
| talk    | Text response streaming                 |
| read    | `read` tool / reading tool output       |
| write   | `write` or `edit` tool                  |
| tool    | Any other tool                          |
| success | Successful tool execution               |
| failure | Failed tool execution                   |
| compact | Context compaction                      |

## Config

`config.json` in the extension root:

```json
{
  "enabled": true,
  "size": 8,
  "readingSpeed": 4,
  "hideBelow": 80,
  "holdDuration": { "hi": 2000, "success": 1200, "failure": 1200 },
  "blinkInterval": [3000, 6000],
  "talkTickMs": 120,
  "cycleMs": 500
}
```

- `size` — image width/height in terminal cells
- `readingSpeed` — words/sec, controls how long talk mouth stays open after tokens stop
- `hideBelow` — hide emote when terminal is narrower than this many columns

## Multi-Character Support

You can have multiple characters by creating subfolders in `emotes/`:
`emotes/<character_name>/<state>/<frames>.png`

Switch between characters in chat using:
`/emote switch`

The selected character is saved in `config.json`.

## Custom emotes

Place PNGs into `emotes/<character>/<state>/`. The extension auto-discovers frames per directory. See `emotes/pi/emotes.json` for an example of per-character config (default frames, blink frames, talk mouth weights).

## License

MIT
