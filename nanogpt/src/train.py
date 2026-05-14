"""Training entrypoint.

Step 3 (this file's initial state) is the minimum: single GPU, fp32, plain
AdamW, cosine LR with linear warmup, and a tiny bin-file dataloader good
enough for the Shakespeare smoke test. Subsequent commits add TF32, bf16
autocast, torch.compile, fused AdamW, gradient accumulation, DDP, etc.,
matching the build order in the spec (Part A.2).
"""

from __future__ import annotations

import argparse
import math
import os
import pickle
import sys
import time
from pathlib import Path

import numpy as np
import torch
import yaml

from model import GPT, GPTConfig
from utils import JsonlLogger, save_checkpoint


def lr_at(step: int, cfg: dict) -> float:
    warmup = cfg["warmup_steps"]
    max_steps = cfg["max_steps"]
    lr, min_lr = cfg["lr"], cfg["min_lr"]
    if step < warmup:
        return lr * (step + 1) / max(1, warmup)
    if step >= max_steps:
        return min_lr
    decay = (step - warmup) / max(1, max_steps - warmup)
    coeff = 0.5 * (1.0 + math.cos(math.pi * decay))
    return min_lr + coeff * (lr - min_lr)


class BinDataset:
    """Loads a memory-mapped uint16 .bin file and serves contiguous (B,T) batches."""

    def __init__(self, path: str | Path, seq_len: int, batch_size: int, device: str):
        self.data = np.memmap(path, dtype=np.uint16, mode="r")
        self.seq_len = seq_len
        self.batch_size = batch_size
        self.device = device

    def get_batch(self) -> tuple[torch.Tensor, torch.Tensor]:
        ix = np.random.randint(0, len(self.data) - self.seq_len - 1, size=self.batch_size)
        x = np.stack([self.data[i:i + self.seq_len].astype(np.int64) for i in ix])
        y = np.stack([self.data[i + 1:i + 1 + self.seq_len].astype(np.int64) for i in ix])
        x = torch.from_numpy(x).to(self.device, non_blocking=True)
        y = torch.from_numpy(y).to(self.device, non_blocking=True)
        return x, y


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--config", type=str, required=True)
    p.add_argument("--data-dir", type=str, default=os.environ.get("DATA_DIR", "./data"))
    p.add_argument("--out-dir", type=str, default=os.environ.get("OUT_DIR", "./out"))
    p.add_argument("--dry-run", action="store_true",
                   help="run 2 steps and exit (smoke test)")
    p.add_argument("--seed", type=int, default=1337)
    args = p.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # 4.1: TF32 matmuls on Ampere+. Free ~2x speedup on fp32 matmuls with
    # negligible numerical impact for transformer training.
    if cfg.get("runtime", {}).get("tf32", True):
        torch.set_float32_matmul_precision("high")

    # ---- Data ----
    data_kind = cfg.get("data", {}).get("kind", "shakespeare_char")
    if data_kind == "shakespeare_char":
        ddir = Path(args.data_dir) / "shakespeare_char"
        with (ddir / "meta.pkl").open("rb") as f:
            meta = pickle.load(f)
        cfg["model"]["vocab_size"] = max(cfg["model"]["vocab_size"], meta["vocab_size"])
        train_ds = BinDataset(ddir / "train.bin", cfg["batch"]["seq_len"],
                              cfg["batch"]["micro_batch_size"], device)
        val_ds = BinDataset(ddir / "val.bin", cfg["batch"]["seq_len"],
                            cfg["batch"]["micro_batch_size"], device)
        ckpt_meta = {"tokenizer": "char", "stoi": meta["stoi"], "itos": meta["itos"]}
    else:
        sys.exit(f"unknown data.kind: {data_kind}")

    # ---- Model ----
    gptcfg = GPTConfig(
        block_size=cfg["batch"]["seq_len"],
        vocab_size=cfg["model"]["vocab_size"],
        n_layer=cfg["model"]["n_layer"],
        n_head=cfg["model"]["n_head"],
        n_embd=cfg["model"]["n_embd"],
        dropout=cfg["model"]["dropout"],
        bias=cfg["model"]["bias"],
    )
    model = GPT(gptcfg).to(device)
    print(f"model: {model.num_params():,} params")

    # ---- Optim ----
    optim = torch.optim.AdamW(
        model.parameters(),
        lr=cfg["optim"]["lr"],
        betas=tuple(cfg["optim"]["betas"]),
        weight_decay=cfg["optim"]["weight_decay"],
    )

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    logger = JsonlLogger(Path("logs") / "train.jsonl")

    max_steps = 2 if args.dry_run else cfg["optim"]["max_steps"]
    eval_interval = cfg["eval"]["eval_interval"]
    eval_iters = cfg["eval"]["eval_iters"]
    ckpt_interval = cfg["checkpoint"]["interval"]

    t_prev = time.time()
    for step in range(max_steps):
        # LR
        lr = lr_at(step, cfg["optim"])
        for g in optim.param_groups:
            g["lr"] = lr

        # Step
        x, y = train_ds.get_batch()
        _, loss = model(x, y)
        optim.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), cfg["optim"]["grad_clip"])
        optim.step()

        # Bookkeeping
        if step % 10 == 0 or step == max_steps - 1:
            now = time.time()
            tps = cfg["batch"]["micro_batch_size"] * cfg["batch"]["seq_len"] * 10 / max(now - t_prev, 1e-9)
            t_prev = now
            print(f"step {step:6d} | loss {loss.item():.4f} | lr {lr:.2e} | toks/s {tps:,.0f}")
            logger.log(step=step, loss=loss.item(), lr=lr, toks_per_sec=tps)

        # Eval
        if eval_interval and step > 0 and step % eval_interval == 0:
            model.eval()
            with torch.no_grad():
                losses = []
                for _ in range(eval_iters):
                    xv, yv = val_ds.get_batch()
                    _, vloss = model(xv, yv)
                    losses.append(vloss.item())
            model.train()
            v = sum(losses) / len(losses)
            print(f"  val loss: {v:.4f}")
            logger.log(step=step, val_loss=v)

        # Checkpoint
        if ckpt_interval and step > 0 and step % ckpt_interval == 0:
            save_checkpoint(
                out_dir / "ckpt.pt", model, optim, step, cfg,
                extra={"meta": ckpt_meta},
            )

    save_checkpoint(out_dir / "ckpt.pt", model, optim, max_steps, cfg, extra={"meta": ckpt_meta})
    logger.close()


if __name__ == "__main__":
    main()
