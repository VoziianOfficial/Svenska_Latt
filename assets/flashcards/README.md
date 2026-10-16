# Flashcard images

This folder contains both real downloaded photographs and historical AI-generated images.
The app stores local WebP images here. The generation notes below apply only to
the historical generated subset, not to downloaded Commons photographs.
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

## Photo completion and attribution — 17 October 2026

All 1006 word cards now have a local image. The original 991 mappings and every
existing image file were preserved. Fifteen real photographs were added; their
metadata and transformations are in `photo-credits-added.json`.

`photo-credits-imported.json` is the unchanged historical import registry (841
entries). Current source evidence, restored author names and unresolved issues
are recorded separately in `../../reports/photo-license-audit.json`.
Public attribution is in `../../photo-credits.html`, linked from the app footer.
Unknown authors are explicitly marked; imported Public domain labels do not
constitute a new rights clearance. CC BY-SA adaptations retain their stated
license; the application's proprietary license does not override photo licenses.

`../../reports/photo-review.html` is the private manual-review gallery. It and
the contact sheets are excluded from deploy. A visual flag is a request for
human judgement; no existing photograph was replaced.

To rebuild the audit and attribution offline, install Pillow in a virtual
environment and run `python scripts/build_photo_audit.py` from the project root.
The script checks decoding, original image hashes and original mappings.
`add_reviewed_photos.py` uses requests/Pillow and refuses to overwrite photos.
