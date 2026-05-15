"""Tests for the minimal BPE Tokenizer.

Train on a mixed French + English corpus, then check the four core methods
and the encode/decode round-trip invariant.
"""

from tokenizer import Tokenizer


ENGLISH = (
    "The quick brown fox jumps over the lazy dog. Tokenization is the process "
    "of breaking text into smaller units that a model can consume. A good "
    "tokenizer keeps common sequences as single units and falls back to bytes "
    "for anything it has never seen before."
)

FRENCH = (
    "Le vif renard brun saute par-dessus le chien paresseux. La tokenisation "
    "est le procédé qui consiste à découper un texte en unités plus petites "
    "qu'un modèle peut consommer. Un bon tokeniseur conserve les séquences "
    "fréquentes comme une seule unité et se rabat sur les octets pour tout "
    "ce qu'il n'a jamais rencontré auparavant."
)

CORPUS = ENGLISH + "\n\n" + FRENCH


def test_initial_vocab_is_256_bytes() -> None:
    tok = Tokenizer()
    assert len(tok.vocab) == 256
    assert tok.merges == {}
    assert tok.vocab[0] == b"\x00"
    assert tok.vocab[65] == b"A"


def test_get_stats_counts_adjacent_pairs() -> None:
    stats = Tokenizer.get_stats([1, 2, 3, 1, 2])
    assert stats[(1, 2)] == 2
    assert stats[(2, 3)] == 1
    assert stats[(3, 1)] == 1


def test_get_stats_empty_and_singleton() -> None:
    assert Tokenizer.get_stats([]) == {}
    assert Tokenizer.get_stats([42]) == {}


def test_merge_replaces_pair() -> None:
    out = Tokenizer.merge([1, 2, 3, 1, 2, 4], (1, 2), 99)
    assert out == [99, 3, 99, 4]


def test_merge_no_match_returns_copy() -> None:
    ids = [1, 2, 3]
    out = Tokenizer.merge(ids, (7, 8), 99)
    assert out == [1, 2, 3]
    assert out is not ids


def test_train_grows_vocab() -> None:
    tok = Tokenizer()
    tok.train(CORPUS, num_merges=50)
    assert len(tok.merges) == 50
    assert len(tok.vocab) == 256 + 50
    for new_id in range(256, 256 + 50):
        assert new_id in tok.vocab
        assert len(tok.vocab[new_id]) >= 2


def test_round_trip_english() -> None:
    tok = Tokenizer()
    tok.train(CORPUS, num_merges=100)
    assert tok.decode(tok.encode(ENGLISH)) == ENGLISH


def test_round_trip_french() -> None:
    tok = Tokenizer()
    tok.train(CORPUS, num_merges=100)
    assert tok.decode(tok.encode(FRENCH)) == FRENCH


def test_round_trip_unseen_text() -> None:
    tok = Tokenizer()
    tok.train(CORPUS, num_merges=100)
    unseen = "Hello, world! Bonjour le monde — 你好 🌍"
    assert tok.decode(tok.encode(unseen)) == unseen


def test_encode_shrinks_after_training() -> None:
    raw = list(ENGLISH.encode("utf-8"))
    tok = Tokenizer()
    tok.train(CORPUS, num_merges=100)
    encoded = tok.encode(ENGLISH)
    assert len(encoded) < len(raw)


def test_encode_with_no_merges_is_raw_bytes() -> None:
    tok = Tokenizer()
    text = "abc"
    assert tok.encode(text) == list(text.encode("utf-8"))


def test_ids_within_vocab() -> None:
    tok = Tokenizer()
    tok.train(CORPUS, num_merges=80)
    for text in (ENGLISH, FRENCH):
        for i in tok.encode(text):
            assert i in tok.vocab


if __name__ == "__main__":
    import sys
    import traceback

    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failures = 0
    for fn in tests:
        try:
            fn()
            print(f"ok   {fn.__name__}")
        except AssertionError:
            failures += 1
            print(f"FAIL {fn.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    sys.exit(1 if failures else 0)
