# otto_tokenizer — Plan

A minimal BPE tokenizer following Andrej Karpathy's "Let's build the GPT Tokenizer".
No regex splitting. No special tokens. Just bytes → merges → ids → bytes.

## Goal

Train a Byte-Pair Encoding tokenizer on raw text, then encode/decode arbitrary
strings using the learned merges. Four core methods, nothing more.

## Layout

```
otto_tokenizer/
├── PLAN.md          # this file
├── tokenizer.py     # the Tokenizer class
├── train.py         # script: train on a text file, save merges
└── sample.txt       # small training corpus for sanity checks
```

## Data model

Two tables, learned during training, used at inference:

- `merges: dict[tuple[int, int], int]` — pair of ids → new id
  - Insertion order matters: earlier merges have lower new ids and must apply first.
- `vocab: dict[int, bytes]` — id → byte sequence
  - Initialized as `{0..255: bytes([i])}`, then extended as merges are learned.

Vocab size target = 256 + `num_merges`. The user picks `num_merges` (e.g. 20 for toy, 1000 for real).

## The four methods

### 1. `get_stats(ids) -> dict[tuple[int,int], int]`

Count adjacent pair frequencies in a list of ids.

```
for pair in zip(ids, ids[1:]):
    counts[pair] = counts.get(pair, 0) + 1
```

That is it. One pass, no windows beyond size 2.

### 2. `merge(ids, pair, new_id) -> list[int]`

Walk the id list left-to-right; whenever the current and next id match `pair`,
emit `new_id` and skip both; otherwise emit the current id.

```
i = 0
while i < len(ids):
    if i < len(ids) - 1 and (ids[i], ids[i+1]) == pair:
        out.append(new_id); i += 2
    else:
        out.append(ids[i]); i += 1
```

Pure function. No mutation of input. Returns shorter list.

### 3. `encode(text: str) -> list[int]`

1. `ids = list(text.encode("utf-8"))` — raw bytes, no regex pre-split.
2. Loop: find the pair in `ids` whose merge has the **lowest new id** in `merges`
   (i.e. learned earliest, highest priority). If no pair is mergeable, stop.
3. Apply `merge(ids, pair, merges[pair])` and repeat.
4. Return `ids`.

Pick "lowest new id" via `min(stats, key=lambda p: merges.get(p, inf))` over the
current pair stats; bail out when the min is `inf`.

### 4. `decode(ids: list[int]) -> str`

```
b"".join(vocab[i] for i in ids).decode("utf-8", errors="replace")
```

`errors="replace"` handles the case where a slice of ids lands mid-codepoint.

## Training (`train`)

Separate method on the class (not one of the four "core" verbs, but needed to
populate `merges` / `vocab`):

1. `ids = list(text.encode("utf-8"))`
2. For step in `range(num_merges)`:
   - `stats = get_stats(ids)`
   - `pair = max(stats, key=stats.get)` — most frequent adjacent pair
   - `new_id = 256 + step`
   - `ids = merge(ids, pair, new_id)`
   - `merges[pair] = new_id`
   - `vocab[new_id] = vocab[pair[0]] + vocab[pair[1]]`
3. Done. Optionally print pair + count per step for visibility.

## Invariants (sanity checks for later)

- `decode(encode(s)) == s` for any UTF-8 string `s`.
- `len(vocab) == 256 + len(merges)`.
- Every id in any encode output is `< len(vocab)`.

## What is explicitly NOT in scope

- No regex split (no GPT-2 `\p{L}+|\p{N}+|...` pattern).
- No special tokens (`<|endoftext|>`, etc.).
- No save/load format negotiation — if persistence is needed, dump `merges` as JSON with stringified keys.
- No multi-threading, no batching, no tokenizer comparison harness.
- No tests beyond the round-trip assertion above.

## Order of implementation

1. `get_stats` + `merge` (pure, trivial).
2. `train` loop — verify vocab grows and printed pairs look reasonable on `sample.txt`.
3. `decode` — trivially correct once `vocab` is right.
4. `encode` — the only subtle one (priority by lowest new id, not by frequency).
5. Round-trip check on a held-out string.
