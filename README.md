# CGx's pi-emote

Animated pixel-art emote that lives in the top-right corner of your pi TUI session. Reacts to what the agent is doing — thinking, talking, reading, writing, using tools, etc.

![pi-emote demo](pi-emote-demo.gif)

Requires a Kitty-graphics-capable terminal.

## Install

```bash
pi install git:github.com/shennguyenrs/pi-emote
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
  "character": "pi",
  "modelCharacters": {
    "gpt-4o": "compact",
    "claude-3.5-sonnet": "pi"
  },
  "hideBelow": 80,
  "holdDuration": { "hi": 2000, "success": 1200, "failure": 1200 },
  "blinkInterval": [3000, 6000],
  "talkTickMs": 120,
  "cycleMs": 500,
  "idle": { "default": "idle.png", "blink": "idle_blink.png" },
  "talk": {
    "weights": {
      "talk_close.png": 0.15,
      "talk_small.png": 0.3,
      "talk_mid.png": 0.35,
      "talk_wide.png": 0.2
    }
  }
}
```

- `size` — image width/height in terminal cells
- `readingSpeed` — words/sec, controls how long talk mouth stays open after tokens stop
- `character` — global default character name
- `modelCharacters` — a map of model names to character names (e.g., `"gpt-4o": "compact"`)
- `hideBelow` — hide emote when terminal is narrower than this many columns
- `idle` & `talk` — global default animation settings for all characters

## Multi-Character Support

The extension scans two locations for characters:

1.  **Local:** `emotes/` folder inside the extension directory.
2.  **Global:** `~/.pi/agent/emote/` in your home directory (ideal for user-added characters).

If a character exists in both locations, the **Global** version takes precedence.

### Model-Specific Defaults

You can define which character to use for each AI model in the `modelCharacters` config. If a model is not listed, or if the specified character cannot be found, the extension falls back to the global `character` default.

### Switching Characters

Switch between characters in chat using:
`/emote switch`

The selected character is saved as the global `character` in `config.json`.

## Custom emotes

Place PNGs into `~/.pi/agent/emote/<character>/<state>/`. The extension auto-discovers frames per directory.

### Structure:

`~/.pi/agent/emote/<character>/<state>/<frame>.png`

### Creating New Characters

To help you create consistent multi-frame emotes for new characters, we provide two resources:

1.  **[EXAMPLE_PROMPT.md](./EXAMPLE_PROMPT.md):** The original prompts used to generate the a custom character. Use these as a reference for Image-to-Image generation.
2.  **[CHARACTER_TEMPLATE.md](./CHARACTER_TEMPLATE.md):** A generalized template with placeholders (like `{{STYLE_ADJECTIVE}}`, `{{VFX_PRIMARY}}`) that you can fill out to generate emotes for any character style (e.g., Cyberpunk, Gothic, Kawaii).

**Recommended Workflow:**

1.  Choose or create a **Base Character** image.
2.  Use the prompts in the template/prompts files with an Image-to-Image model (like Midjourney, DALL-E 3, or Stable Diffusion).
3.  Generate 4-frame sprite sheets for each state.
4.  Crop and save the frames into the appropriate folders.

### Optional Config:

You can add an `emotes.json` inside your character folder to override global animation settings (like mouth weights or specific blink frames). If omitted, the character will use the defaults defined in the root `config.json`.

## License

MIT
