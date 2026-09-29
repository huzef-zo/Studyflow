# Palette Learnings

## 2026-06-01 - System HUD Visual Pass & Contrast Verification
- **Contrast Rule Enforcement**: Glowing neon cyan `#4DD8E8` provides an ideal high-tech aesthetic, but must strictly be confined to borders, icons, progress fills, and large numeric readouts (`>= 18px` / bold). For small body text, labels, and secondary copy under 18px, desaturated high-contrast colors (`#E8F4F8` text primary, `#8FA3AD` secondary, `#71828C` muted) must be used to guarantee WCAG AA contrast ratio compliance (>= 4.5:1).
- **Bracketed Headers & Line Wrapping**: Bracketed uppercase section headers (`[ SECTION TITLE ]`) using monospace font must set `white-space: nowrap` to prevent orphan closing brackets `]` from wrapping onto a second line in compact cards or responsive viewports.
- **Focus Rings in Dark Themes**: Custom high-visibility focus indicators in dark HUD skins should utilize glowing cyan outlines (`outline: 2px solid #4DD8E8; outline-offset: 2px; box-shadow: 0 0 10px rgba(77,216,232,0.5)`) rather than default browser rings or removed outlines.
