"""Mojibake repair (see fix_mojibake_content.py).

R-1  stored NVIDIA-SSE corruption round-trips back to the original text
R-2  smart-quote/accent sequences (clichÃ©â) repair in a single pass
R-3  clean text is never touched
R-4  text that fails the Latin-1 round-trip is left untouched (fail-loud)
R-5  double-encoded (still-mojibake after one pass) values are skipped
R-6  repair is idempotent
"""
from fix_mojibake_content import looks_like_mojibake, repair_mojibake


def mojibake(text: str) -> str:
    """Reproduce the corruption: UTF-8 bytes decoded as Latin-1."""
    return text.encode("utf-8").decode("latin-1")


def test_r1_rmse_formula_round_trips():
    original = "RMSE = √(1/n · Σ(yᵢ − ŷᵢ)²)"
    stored = mojibake(original)
    assert looks_like_mojibake(stored)
    repaired, changed = repair_mojibake(stored)
    assert (repaired, changed) == (original, True)


def test_r2_smart_quotes_and_accents_single_pass():
    original = "cliché — naïve “quotes”"
    stored = mojibake(original)
    repaired, changed = repair_mojibake(stored)
    assert (repaired, changed) == (original, True)


def test_r3_clean_text_untouched():
    for clean in ("Plain lesson text", "café résumé — naïve", "emoji 🎓 stay"):
        repaired, changed = repair_mojibake(clean)
        assert (repaired, changed) == (clean, False)


def test_r4_non_latin1_input_untouched():
    stored = "Ã© and √ mixed"
    repaired, changed = repair_mojibake(stored)
    assert (repaired, changed) == (stored, False)


def test_r5_double_encoded_skipped():
    original = "cliché"
    double = mojibake(mojibake(original))
    repaired, changed = repair_mojibake(double)
    assert (repaired, changed) == (double, False)


def test_r6_idempotent():
    original = "RMSE = √(1/n · Σ(yᵢ − ŷᵢ)²)"
    repaired, changed = repair_mojibake(mojibake(original))
    assert changed
    again, changed_again = repair_mojibake(repaired)
    assert (again, changed_again) == (repaired, False)
