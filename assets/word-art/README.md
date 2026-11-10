# Realistic vocabulary cutouts

409 realistic illustrations with a transparent alpha channel, mapped to all
1,006 vocabulary IDs. The set replaces the Fluent Emoji thumbnails in word
cards. The historical Fluent assets are retained for other existing surfaces.

Generated with the built-in `image_gen` tool. Art direction: realistic
Scandinavian studio product photography, natural materials, restrained colors,
isolated subjects, and genuine transparency. Human emotions use photographic
portraits; abstract concepts use physical symbols. No emoji tile backgrounds.

`generation-plan.json` contains the exact subjects, cell order and vocabulary
mapping. `generation-prompts.json` preserves the final prompt set.
`generation-sources.json` records the untouched original generation outputs.
These production notes are excluded by the deployment script's asset allowlist.

`manifest.json` maps each word ID to its final local WebP image.
`illustrations.json` links the final images back to their source atlas cells.
The extra furniture and appliance illustrations correct older broad aliases,
including vacuum cleaner, eraser, table, washing machine and dishwasher.

Rebuild the optimized 224 × 224 transparent WebP assets after visual review:

```sh
python3 scripts/build_word_art.py
```

The script does not call an image API. It extracts cells from the generated
atlases, trims transparent margins and resizes them without changing subjects.
Only almost invisible alpha values of 1–3 outside the cutouts are cleared.
The generated source PNGs are never overwritten or removed.
