# Flashcard images

Generated with the built-in image_gen tool. The app stores local WebP images here.
Exact word IDs are mapped in `flashcard-media.js`; unknown words use a neutral
background. No category or hash-based photo selection is used for flashcards.

The complete per-word prompt set is in `generation-plan.json`; refined prompts
are in `revision-prompts.json`. `generation-status.json` records generated and
reviewed outputs. Only reviewed entries are published in the mapping.

`scripts/build_flashcard_media.py` registers built-in image_gen outputs, creates
contact sheets for visual review, and rebuilds the exact mapping after approval.
It does not invoke an API or generate images. The 768 × 768 WebP assets are
local project files; the original generation outputs remain untouched.

## work.webp

Reviewed scene: adult working at a laptop. Used for arbeta, jobba, jobb and arbete.
Generation prompt:

Use case: photorealistic-natural. Asset type: square full-bleed photo background for a Swedish language learning flashcard. Primary request: illustrate Swedish word 'arbeta' meaning 'to work'. Subject: one adult visibly working on a laptop at a tidy office desk, natural Scandinavian daylight, realistic editorial photography. Composition: clear action and person centered in upper two thirds, lower third visually quiet for app text overlay. No written text, no letters, no branding, no watermark. Single scene, no collage.
