# How to run the otto_tokenizer tests

No dependencies. Just Python 3.9+ (uses `dict[...]` / `list[...]` generics via `from __future__ import annotations`).

## Run all tests

From the repo root:

```bash
cd otto_tokenizer
python test_tokenizer.py
```

You should see one line per test (`ok` / `FAIL`) and a summary like `12/12 passed`.
Exit code is `0` on success, `1` on any failure.

## Run with pytest (optional)

If you have pytest installed, it picks up the same file automatically:

```bash
cd otto_tokenizer
pytest -v test_tokenizer.py
```

## Quick sanity check in a REPL

```bash
cd otto_tokenizer
python -c "
from tokenizer import Tokenizer
tok = Tokenizer()
tok.train('hello world hello tokenizer', num_merges=10, verbose=True)
ids = tok.encode('hello tokenizer')
print('ids:', ids)
print('decoded:', tok.decode(ids))
"
```

## What the tests cover

- `get_stats` counts adjacent pairs (and handles empty / singleton).
- `merge` replaces every occurrence of a pair with a new id.
- `train` grows `vocab` to exactly `256 + num_merges`.
- `encode` / `decode` round-trip both the English and French training paragraphs.
- Round-trip also works on unseen text (Chinese characters + emoji), since the
  fallback is raw UTF-8 bytes.
- After training, encoded length is strictly shorter than raw byte length.
- An untrained tokenizer encodes to raw UTF-8 bytes (no merges applied).
- Every emitted id is a key in `vocab`.
