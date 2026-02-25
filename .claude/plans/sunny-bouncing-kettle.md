# Fix locate flash — refined ring pulse

## Context
Current locate animation uses 3 sharp opacity blinks (0→0.25→1 three times in 0.9s). Feels abrupt and crude ("tosco") on rounded cards. Need something smooth and elegant.

## Approach — Sonar ring pulse
Replace opacity blinks with a single outline ring that draws around the card, holds, then fades out. Like a focus ring / sonar ping.

- Uses `outline` (not box-shadow) — renders outside the element, respects `rounded-2xl`, no layout shift
- Single smooth pulse, not 3 rapid blinks
- Ring contracts inward slightly as it appears (offset 4px → 2px) for a "focusing" feel

## Changes

### `src/app/globals.css` (~line 190)
Replace blink keyframes + class:
```css
@keyframes locate-ring {
  0% { outline-color: transparent; outline-offset: 4px; }
  25% { outline-color: var(--text); outline-offset: 2px; }
  100% { outline-color: transparent; outline-offset: 0px; }
}
.locate-blink {
  outline: 2px solid transparent;
  border-radius: inherit;
  animation: locate-ring 1.2s ease-out;
}
```

### `src/app/page.tsx` (~line 487)
Update timeout from 900 → 1200 to match new duration:
```js
setTimeout(() => el.classList.remove("locate-blink"), 1200);
```

## Verification
Play a track → scroll away → click locate → card scrolls into view, then a smooth outline ring pulses once around it and fades.
