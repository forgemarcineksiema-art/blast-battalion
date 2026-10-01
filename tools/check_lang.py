"""Checks the translations (src/lang_*.js) after an edit:
- every character they use exists in the bitmap font (src/gfx.js);
- every language has the same phrases (the keys of the English text).

    python tools/check_lang.py          every language
    python tools/check_lang.py it tr    only these (the phrases are compared with Spanish)

Dev-only (never shipped). Exit code 1 when something is wrong.
"""
import io
import os
import re
import sys

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')
CODES = ['pl', 'es', 'pt', 'de', 'fr', 'it', 'tr']
STR = r"""(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")"""

# the font: plain glyphs, accented capitals and the extra tall ones (Ł ¡ ¿)
gfx = io.open(os.path.join(SRC, 'gfx.js'), encoding='utf-8').read()
font = gfx[gfx.index('const G = {'):gfx.index('const chars')]
glyphs = set(re.findall(r"""['"](.)['"]: \[""", font))
glyphs |= set(re.findall(r"""['"](.)['"]: '[A-Z] \w+'""", font))
glyphs |= set(re.findall(r"""TALL\['(.)'\]""", font))
glyphs.add(' ')

ok = True
langs = {}
ONLY = [a for a in sys.argv[1:] if not a.startswith('-')]
for code in ['es'] + [c for c in (ONLY or CODES) if c != 'es']:
    path = os.path.join(SRC, 'lang_%s.js' % code)
    if not os.path.exists(path):
        print(code, 'MISSING FILE', path)
        ok = False
        continue
    src = io.open(path, encoding='utf-8').read()
    words = src[src.index('words: {'):]
    table = {}
    for a, b, c, d in re.findall(STR + ': ' + STR, words):
        table[a or b] = c or d
    rules = src[src.index('rules: {'):src.index('words: {')]
    templates = [x or y for x, y in re.findall(r'\w+: ' + STR, rules)]
    bad = []
    for key, text in list(table.items()) + [('rule', t) for t in templates]:
        t = re.sub(r'\{[^}]*\}', '', text).replace('\\u00AD', '')  # placeholders, soft hyphens
        bad += [(ch, text) for ch in t if ch not in glyphs]
    langs[code] = table
    print(code, len(table), 'phrases', len(templates), 'rules', 'NOT IN THE FONT:' if bad else 'ok')
    for ch, text in bad[:40]:
        print('   ', repr(ch), '|', text[:80])
    ok = ok and not bad

base = set(langs['es'])  # the reference: every language has the same phrases as Spanish
for code, table in langs.items():
    miss, extra = base - set(table), set(table) - base
    if miss or extra:
        ok = False
        print(code, 'missing', sorted(miss)[:30], 'extra', sorted(extra)[:30])
sys.exit(0 if ok else 1)
