# Credits

## Code

- Game concept and direction: ShinDongSoo
- Implementation collaboration: ShinDongSoo and OpenAI Codex
- Source-code license: [MIT License](LICENSE)

## Visual assets

### Player and museum guard

- Files: `public/assets/characters/*.png`
- Purpose: player, guard and four-direction walking animation sheets
- Source: generated specifically for Shadow Heist V2 from developer-provided character direction and references
- Tool: OpenAI image generation through Codex
- Post-processing: transparent-background cleanup, resizing and sprite-sheet integration performed inside this project
- Usage: project-original generated assets; no third-party game asset pack was imported

## Audio

- `public/assets/audio/guard-footstep.mp3` — guard footsteps, supplied by the developer for this project.
- Player footsteps, alerts, radio cues, doors and ambient sounds are synthesized at runtime with the Web Audio API.
- Guard-footstep positioning, distance attenuation and wall filtering are processed at runtime with the Web Audio API.

## Fonts

- IBM Plex Mono — loaded from Google Fonts
- Noto Sans KR — loaded from Google Fonts
- Font license information is provided by the Google Fonts service.

## Libraries and tools

- TypeScript
- Vite
- Browser Canvas 2D API
- Web Audio API
