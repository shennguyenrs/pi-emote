# Character Emote Generation Template

This template is designed for **Image-to-Image** generation to create consistent multi-frame emote sheets for a new character.

## How to Use

1. **Define the Base Character:** Describe your character's core features (hair, eyes, outfit, accessories).
2. **Set the Aesthetic:** Choose a style (e.g., "kawaii", "cyberpunk", "gothic") and a visual effect theme.
3. **Replace Placeholders:** Fill in the `{{ }}` placeholders in the prompts below with your character's specifics.

### Common Placeholder Values

| Placeholder           | Example (Kawaii)   | Example (Cyberpunk) |
| :-------------------- | :----------------- | :------------------ |
| `{{STYLE_KEYWORD}}`   | manga/anime        | futuristic/glitch   |
| `{{STYLE_ADJECTIVE}}` | kawaii (cute)      | gritty/tech-savvy   |
| `{{VFX_PRIMARY}}`     | kira-kira sparkles | neon circuit trails |
| `{{VFX_SECONDARY}}`   | tiny hearts        | digital artifacts   |
| `{{THEMATIC_ICON}}`   | pink music note    | floating data cube  |
| `{{PRIMARY_COLOR}}`   | pastel pink        | electric blue       |
| `{{NEGATIVE_COLOR}}`  | deep blue          | error red           |
| `{{NEGATIVE_VFX}}`    | gloom cloud        | static interference |

---

## Global Style Guide (System Prompt)

> "Maintain 100% consistency with the base character: **{{CHARACTER_APPEARANCE_DESCRIPTION}}**. The output must be 4 distinct frames in a single image (sprite sheet format), 1024x1024 resolution per frame, chroma key green background. Transitions between frames must be incremental and fluid. In every frame, incorporate subtle {{STYLE_KEYWORD}} visual effects like {{VFX_EXAMPLES}} to ensure the character remains {{STYLE_ADJECTIVE}} throughout the animation."

---

## 1. Idle & Blink (2 Frames)

**Goal:** A simple, charming blinking cycle.

- **Frame 1:** Neutral pose, eyes wide and sparkling with a {{VFX_PRIMARY}} effect.
- **Frame 2:** Eyes gently closed, a tiny 'smile' curve to the eyelids.
  **Prompt:**
  > "Generate 2 frames of the character: 1) Neutral pose with wide sparkling eyes and {{VFX_PRIMARY}} effects, 2) Eyes closed happily in a gentle blink. Maintain all character details perfectly still."

---

## 2. Talk / Mouth Movement (4 Frames)

**Goal:** Smooth lip-sync with thematic flair.

- **Frame 1:** Mouth closed in a small {{MOOD_ADJECTIVE}} smile.
- **Frame 2:** Mouth slightly open in a small 'o' shape.
- **Frame 3:** Mouth moderately open with a floating {{THEMATIC_ICON}}.
- **Frame 4:** Mouth wide open in a happy 'D' shape with tiny {{VFX_SECONDARY}} inside.
  **Prompt:**
  > "Generate 4 frames of mouth movement: 1) Small closed smile, 2) Tiny 'o' mouth, 3) Moderate 'a' mouth with a floating {{THEMATIC_ICON}}, 4) Wide happy 'D' mouth with tiny {{VFX_SECONDARY}}. Ensure eyes remain wide and {{STYLE_ADJECTIVE}}."

---

## 3. Think / Pondering (4 Frames)

**Goal:** A {{STYLE_ADJECTIVE}} intellectual progression.

- **Frame 1:** Looking up-left, index finger near the mouth.
- **Frame 2:** Tapping chin with finger, a small '?' symbol appearing.
- **Frame 3:** Eyes closed, head tilted slightly, a small '...' bubble.
- **Frame 4:** 'Aha!' moment: wide eyes, finger raised, surrounded by bright {{THEMATIC_VFX}} and {{VFX_PRIMARY}} effects.
  **Prompt:**
  > "Generate 4 frames of thinking: 1) Looking up-left, finger near chin, 2) Tapping chin with '?' symbol, 3) Eyes closed in thought with '...' bubble, 4) 'Aha!' realization with wide eyes and bright {{THEMATIC_VFX}}."

---

## 4. Read (4 Frames)

**Goal:** Studious and {{STYLE_ADJECTIVE}} (optional: with glasses).

- **Frame 1:** {{OPTIONAL_GLASSES_OR_BOOK_STYLE}}, eyes at the top of a book.
- **Frame 2:** Head tilting down slightly, eyes scanning the middle.
- **Frame 3:** Adjusting {{OPTIONAL_GLASSES}} or posture, a tiny {{THEMATIC_ICON}} appearing.
- **Frame 4:** Turning the page with a stylized 'swoosh' line and a satisfied {{VFX_SECONDARY}}.
  **Prompt:**
  > "Generate 4 frames of reading: 1) Looking at top of book, 2) Head tilting down scanning pages, 3) Subtle interaction with book/glasses with a tiny floating {{THEMATIC_ICON}}, 4) Turning the page with a 'swoosh' motion line and a {{VFX_SECONDARY}}."

---

## 5. Write (4 Frames)

**Goal:** Graceful writing with thematic trails.

- **Frame 1:** Holding a {{WRITING_TOOL}} up, a 'ping' {{VFX_SECONDARY}} at the tip.
- **Frame 2:** Lowering it to write, a faint trail of {{PRIMARY_COLOR}} light.
- **Frame 3:** Scribbling motion with small {{THEMATIC_VFX}} 'popping' out.
- **Frame 4:** Lifting the {{WRITING_TOOL}} with a joyful expression and a 'finished' {{SUCCESS_VFX}} effect.
  **Prompt:**
  > "Generate 4 frames of writing: 1) {{WRITING_TOOL}} raised with a 'ping' {{VFX_SECONDARY}}, 2) Writing with a {{PRIMARY_COLOR}} light trail, 3) Scribbling with popping {{THEMATIC_VFX}}, 4) Lifting pen with a '{{SUCCESS_VFX}}' success effect."

---

## 6. Tool / Work (4 Frames)

**Goal:** Productive effort in the character's style.

- **Frame 1:** Holding a {{WORK_TOOL}} with a determined face.
- **Frame 2:** Raising the tool with small 'dash' motion lines.
- **Frame 3:** Moving the tool down with a stylized {{THEMATIC_VFX}} impact pop.
- **Frame 4:** Wiping brow with a tiny 'phew' cloud and a {{STYLE_ADJECTIVE}} wink.
  **Prompt:**
  > "Generate 4 frames of work: 1) Determined {{STYLE_ADJECTIVE}} face holding {{WORK_TOOL}}, 2) Raising tool with motion lines, 3) Impact with a stylized {{THEMATIC_VFX}} pop, 4) Wiping brow with 'phew' cloud and a wink."

---

## 7. Interaction: Hi & Success (4 Frames)

**Goal:** High-energy appeal.

- **Frame 1:** Small wave with a tiny {{THEMATIC_ICON}} near the hand.
- **Frame 2:** Big wave with eyes closed happily and {{STYLE_ADJECTIVE}} {{VFX_PRIMARY}} effects.
- **Frame 3:** Thumbs up with a giant, {{PRIMARY_COLOR}} {{VFX_PRIMARY}} sparkle.
- **Frame 4:** Two-handed 'V' (peace) signs with floating {{THEMATIC_ICON}}s and {{VFX_SECONDARY}}.
  **Prompt:**
  > "Generate 4 frames of high-energy interaction: 1) Small wave with {{THEMATIC_ICON}}, 2) Big happy wave with {{VFX_PRIMARY}} background, 3) Thumbs up with {{PRIMARY_COLOR}} sparkle, 4) Double peace signs with {{THEMATIC_ICON}}s and {{VFX_SECONDARY}}."

---

## 8. Failure / Error (4 Frames)

**Goal:** Thematic disappointment.

- **Frame 1:** Worried look with small 'tremble' lines.
- **Frame 2:** One hand over an eye, a large {{NEGATIVE_COLOR}} 'stress' gradient.
- **Frame 3:** Eyes as white spirals (or {{NEGATIVE_VFX}}), a small {{NEGATIVE_ICON}} symbol.
- **Frame 4:** Slumped with a giant {{NEGATIVE_COLOR}} sweat drop and a {{NEGATIVE_VFX}} cloud.
  **Prompt:**
  > "Generate 4 frames of failure: 1) Worried with tremble lines, 2) Hand over eye with {{NEGATIVE_COLOR}} stress lines, 3) {{NEGATIVE_VFX}} eyes and {{NEGATIVE_ICON}}, 4) Slumped with giant sweat drop and {{NEGATIVE_VFX}} cloud."

---

## 9. Compact (4 Frames)

**Goal:** A "compacting" or "shrinking" animation.

- **Frame 1:** Squatting down with a playful smile, preparing to "shrink".
- **Frame 2:** Curling into a tight, {{STYLE_ADJECTIVE}} ball.
- **Frame 3:** Surrounded by a stylized 'box' or 'zip' graphic with {{VFX_PRIMARY}}.
- **Frame 4:** Transformed into a tiny, simplified 'mini' version of the character.
  **Prompt:**
  > "Generate 4 frames of 'compact' animation: 1) Character squatting down playfully, 2) Curled into a ball, 3) Surrounded by a stylized {{THEMATIC_VFX}} box/zip graphic with {{VFX_PRIMARY}}, 4) A tiny simplified mini-character with {{VFX_PRIMARY}} effects."
