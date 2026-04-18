# Changelog

All notable changes to Hearth are documented here.

## [1.0.1] - 2026-04-16

### Added
- Multilingual foundation for the web app with `en`, `ms`, and `zh-CN` locale support.
- Faster access to starting a conversation with a dedicated new-chat action in the chat header.
- A cleaner mobile-style chat header with a centered model selector, merged chat actions menu, and conversation title subtitle.

### Changed
- Refined the chat header layout to better match the intended mobile-first design language.
- Wrote down post-release progress in a proper changelog so shipped changes are easier to track between versions.
- Bumped the web app build version to `0.0.118` to support clean PWA update rollout.

### Fixed
- Fixed broken chat header labels that were rendering raw translation keys instead of user-facing text.
- Fixed Hearth progress session-key routing lookup for plugin callback delivery.
- Fixed API NestJS dev startup by adding the missing multer types.

### Docs
- Improved README positioning and presentation.
- Added README banner art and a social preview image.

## [1.0.0] - 2026-04-04

First public release of Hearth.

### Added
- Multi-conversation chat with independent context.
- Multi-user household accounts with PIN and WebAuthn auth.
- Owner/member role-based permissions.
- Reminders with critical repeat-until-acknowledged behavior.
- Cross-member notifications.
- Real-time token streaming over SSE.
- Fast and Deep model presets per conversation.
- Image attachments and AI image generation.
- Text-to-speech playback.
- Dark-theme installable PWA.
- HTTPS via Caddy with automatic certificates.
- One-line install flow, update command, and service install support.
