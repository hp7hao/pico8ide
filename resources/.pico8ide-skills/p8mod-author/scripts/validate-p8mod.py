#!/usr/bin/env python3
"""Validate Pico-8 IDE .p8mod structure.

Usage:
  python3 .codex/skills/p8mod-author/scripts/validate-p8mod.py path/to/game.p8mod
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HEADER = "pico-8 cartridge // http://www.pico-8.com"
STANDARD_SECTIONS = ["lua", "gfx", "gff", "map", "sfx", "music"]
CUSTOM_SECTIONS = ["meta", "i18n"]
SECTION_RE = re.compile(r"^__(\w+)__$")


def fail(errors: list[str], message: str) -> None:
    errors.append(f"ERROR: {message}")


def warn(warnings: list[str], message: str) -> None:
    warnings.append(f"WARNING: {message}")


def parse_sections(lines: list[str]) -> tuple[dict[str, list[str]], list[tuple[str, int]], list[str]]:
    sections: dict[str, list[str]] = {}
    order: list[tuple[str, int]] = []
    duplicates: list[str] = []
    current: str | None = None

    for line_no, line in enumerate(lines, start=1):
        match = SECTION_RE.match(line)
        if match:
            current = match.group(1)
            if current in sections:
                duplicates.append(current)
            sections[current] = []
            order.append((current, line_no))
        elif current is not None:
            sections[current].append(line)

    return sections, order, duplicates


def validate_json_object(name: str, body: str, errors: list[str]) -> object | None:
    if not body.strip():
        fail(errors, f"__{name}__ section is empty")
        return None
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        fail(errors, f"__{name}__ invalid JSON: {exc}")
        return None
    if not isinstance(parsed, dict):
        fail(errors, f"__{name}__ must be a JSON object")
        return None
    return parsed


def validate_meta(meta: object, errors: list[str]) -> None:
    if not isinstance(meta, dict):
        return
    for key in ("title", "author", "template"):
        if key in meta and not isinstance(meta[key], str):
            fail(errors, f"__meta__.{key} must be a string")


def validate_i18n(i18n: object, lua_body: str, errors: list[str], warnings: list[str]) -> None:
    if not isinstance(i18n, dict):
        return

    locales = i18n.get("locales")
    entries = i18n.get("entries")
    output_locale = i18n.get("outputLocale", "")

    if not isinstance(locales, list) or not all(isinstance(loc, str) and loc for loc in locales):
        fail(errors, "__i18n__.locales must be an array of non-empty strings")
        locales = []
    if not isinstance(entries, list):
        fail(errors, "__i18n__.entries must be an array")
        entries = []
    if not isinstance(output_locale, str):
        fail(errors, "__i18n__.outputLocale must be a string")
    elif output_locale and output_locale not in locales:
        fail(errors, f'__i18n__.outputLocale "{output_locale}" is not in locales')

    seen_keys: set[str] = set()
    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            fail(errors, f"__i18n__.entries[{idx}] must be an object")
            continue
        key = entry.get("key")
        translations = entry.get("translations")
        if not isinstance(key, str) or not key:
            fail(errors, f"__i18n__.entries[{idx}].key must be a non-empty string")
            continue
        if key in seen_keys:
            fail(errors, f'duplicate i18n key "{key}"')
        seen_keys.add(key)
        if not isinstance(translations, dict):
            fail(errors, f'entry "{key}" translations must be an object')
            continue
        for loc in locales:
            value = translations.get(loc)
            if not isinstance(value, str):
                fail(errors, f'entry "{key}" missing string translation for locale "{loc}"')

    tx_keys = set(re.findall(r'tx\(\s*["\']([^"\']+)["\']', lua_body))
    for key in sorted(tx_keys - seen_keys):
        fail(errors, f'Lua calls tx("{key}") but __i18n__ has no matching entry')
    for key in sorted(seen_keys - tx_keys):
        warn(warnings, f'__i18n__ entry "{key}" is not referenced by tx() in __lua__')
    if tx_keys and "_txi()" not in lua_body:
        warn(warnings, "Lua uses tx() but _txi() was not found")


def validate(path: Path) -> int:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        fail(errors, "file is not valid UTF-8 text")
        text = ""

    lines = text.splitlines()
    if not lines or lines[0] != HEADER:
        fail(errors, f"first line must be exactly: {HEADER}")
    if len(lines) < 2 or lines[1] != "version 42":
        fail(errors, "second line must be exactly: version 42")
    if text and not text.endswith("\n"):
        warn(warnings, "file should end with a trailing newline")

    sections, order, duplicates = parse_sections(lines)
    for duplicate in duplicates:
        fail(errors, f"duplicate section __{duplicate}__")
    for section in STANDARD_SECTIONS:
        if section not in sections:
            fail(errors, f"missing required section __{section}__")

    known = set(STANDARD_SECTIONS + CUSTOM_SECTIONS)
    for section, line_no in order:
        if section not in known:
            warn(warnings, f"unknown section __{section}__ at line {line_no}")

    section_names = [name for name, _ in order]
    expected_standard = [name for name in STANDARD_SECTIONS if name in sections]
    actual_standard = [name for name in section_names if name in STANDARD_SECTIONS]
    if actual_standard != expected_standard:
        fail(errors, "standard sections must appear in order: " + ", ".join(f"__{s}__" for s in STANDARD_SECTIONS))
    if any(name in CUSTOM_SECTIONS for name in section_names):
        first_custom = min(i for i, name in enumerate(section_names) if name in CUSTOM_SECTIONS)
        if any(name in STANDARD_SECTIONS for name in section_names[first_custom + 1 :]):
            fail(errors, "custom sections must appear after all standard sections")

    gfx = sections.get("gfx", [])
    if len(gfx) != 128:
        fail(errors, f"__gfx__ must contain 128 lines, found {len(gfx)}")
    for idx, line in enumerate(gfx, start=1):
        if not re.fullmatch(r"[0-9a-f]{128}", line):
            fail(errors, f"__gfx__ line {idx} must be 128 lowercase hex characters")
            break

    gff = sections.get("gff", [])
    if len(gff) != 2:
        fail(errors, f"__gff__ must contain 2 lines, found {len(gff)}")
    for idx, line in enumerate(gff, start=1):
        if not re.fullmatch(r"[0-9a-f]{256}", line):
            fail(errors, f"__gff__ line {idx} must be 256 lowercase hex characters")
            break

    for idx, line in enumerate(sections.get("map", []), start=1):
        if not re.fullmatch(r"[0-9a-f]{256}", line):
            fail(errors, f"__map__ line {idx} must be 256 lowercase hex characters")
            break
    if len(sections.get("map", [])) > 32:
        fail(errors, "__map__ must not contain more than 32 lines")

    for idx, line in enumerate(sections.get("sfx", []), start=1):
        if not re.fullmatch(r"[0-9a-f]{168}", line):
            fail(errors, f"__sfx__ line {idx} must be 168 lowercase hex characters")
            break
    if len(sections.get("sfx", [])) > 64:
        fail(errors, "__sfx__ must not contain more than 64 lines")

    for idx, line in enumerate(sections.get("music", []), start=1):
        if not re.fullmatch(r"[0-9a-f]{2} [0-9a-f]{8}", line):
            fail(errors, f"__music__ line {idx} must match 'ff cccccccc' lowercase hex format")
            break
    if len(sections.get("music", [])) > 64:
        fail(errors, "__music__ must not contain more than 64 lines")

    if "meta" in sections:
        meta = validate_json_object("meta", "\n".join(sections["meta"]), errors)
        validate_meta(meta, errors)
    if "i18n" in sections:
        i18n = validate_json_object("i18n", "\n".join(sections["i18n"]), errors)
        validate_i18n(i18n, "\n".join(sections.get("lua", [])), errors, warnings)

    for message in warnings:
        print(message)
    for message in errors:
        print(message)

    if errors:
        print(f"FAILED: {path} has {len(errors)} error(s)")
        return 1
    print(f"OK: {path} is a structurally valid .p8mod file")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip())
        return 2
    path = Path(argv[1])
    if not path.is_file():
        print(f"ERROR: file not found: {path}")
        return 1
    return validate(path)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
