# CGx's pi-emote

**Live status dashboard & animated pixel-art emote** that lives in your pi TUI session. It provides a visual indicator of the agent's state while displaying critical session metadata like model info, context usage, and git status.

![pi-emote demo](pi-emote-demo.gif)

Requires a Kitty-graphics-capable terminal.

## Features

- **Animated Emote:** Reacts to agent actions (thinking, talking, reading, writing, etc.).
- **Status Dashboard:** Displays:
  - **Model & Thinking Level:** See which model is active and its current reasoning depth.
  - **Context Usage:** Real-time tracking of token usage vs. context window.
  - **Session Stats:** Accumulated input/output tokens and estimated session cost.
  - **Environment Info:** Current Working Directory (CWD).
  - **Git Integration:** Shows current branch and pending change stats (`git diff --shortstat`).
- **Cross-Terminal Support:**
  - **Kitty:** Full high-resolution image support.
  - **iTerm2:** High-resolution image support.
  - **ASCII Fallback:** Automatically switches to text-based emotes in other terminals.

## Install

```bash
pi install git:github.com/shennguyenrs/pi-emote
```

## States

| State   | Trigger                                 |
| ------- | --------------------------------------- |
| hi      | Session start / Character switch        |
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

`config.json` is looked for in the following locations (highest precedence first):

1. `.pi/extensions/pi-emote/emotes/config.json`
2. `~/.pi/agent/extensions/pi-emote/emotes/config.json`
3. Extension's built-in `emotes/config.json`

Example configuration:

```json
{
  "enabled": true,
  "size": 8,
  "character": "pi",
  "modelCharacters": {
    "gemini": "pi",
    "gpt": "ascii"
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

- `size` — Image width/height in terminal cells (for image-capable terminals).
- `character` — Global default character name. Use `"ascii"` to force text-mode.
- `modelCharacters` — Map of model names to character names. Uses case-insensitive partial matching (e.g., `"gemini"` matches `"google/gemini-2.0"`). Wildcards (`*`) are also supported.
- `hideBelow` — Hide the widget when terminal is narrower than this many columns.
- `holdDuration` — How long to stay in temporary states (`hi`, `success`, `failure`) in ms.
- `idle` & `talk` — Global default animation settings for all characters.

## Multi-Character Support

The extension scans three locations for characters:

1.  **Local:** `.pi/extensions/pi-emote/emotes/` (project-specific)
2.  **User:** `~/.pi/agent/extensions/pi-emote/emotes/` (global user-added)
3.  **Default:** Built-in `emotes/` folder.

### Switching Characters

Switch between characters in chat using:

- `/emote switch` — Set the global default character.
- `/emote set-model` — Set the character for the currently active model.

The selection is saved to your configuration. Model names are matched using case-insensitive partial matching (e.g., `"gemini"` matches `"google/gemini-pro"`). Wildcards (`*`) are also supported.

## Custom Emotes

Place PNGs into `~/.pi/agent/extensions/pi-emote/emotes/<character>/<state>/`. The extension auto-discovers frames per directory.

### Structure:

`~/.pi/agent/extensions/pi-emote/emotes/<character>/<state>/<frame>.png`

### Creating New Characters

To help you create consistent multi-frame emotes, we provide:

1.  **[EXAMPLE_PROMPT.md](./EXAMPLE_PROMPT.md):** Sample prompts for Image-to-Image generation.
2.  **[CHARACTER_TEMPLATE.md](./CHARACTER_TEMPLATE.md):** A generalized template for any character style.

### ASCII Fallback Emotes

Text-based emotes are defined in `emotes/ascii/fallback.json`. You can create your own by providing a character folder named `ascii` in your search path.

## License

MIT
