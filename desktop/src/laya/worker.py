"""Private newline-delimited JSON bridge; no network access during prediction."""

import contextlib
import json
import os
from pathlib import Path
import sys

OUTPUT = sys.stdout
MODEL_ID = "convaiinnovations/laya-multilingual"
REVISION = "e4e9ddf21a7b1903b7acffd8814ad4307bf63a67"


def emit(value):
    OUTPUT.write(json.dumps(value, allow_nan=False) + "\n")
    OUTPUT.flush()


def prepare(directory):
    from huggingface_hub import snapshot_download
    from tqdm.auto import tqdm

    class Progress(tqdm):
        def update(self, amount=1):
            result = super().update(amount)
            if self.total and self.unit == "B":
                emit({"stage": "download", "completed": self.n, "total": self.total})
            return result

    snapshot_download(
        MODEL_ID,
        revision=REVISION,
        local_dir=str(directory),
        allow_patterns=[
            "model.safetensors", "rl_agent_config.json", "encoder/config.json",
            "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json",
        ],
        tqdm_class=Progress,
    )


def run(directory):
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    from laya import Agent

    agent = Agent(str(directory))
    emit({"stage": "ready"})
    for line in sys.stdin:
        try:
            request = json.loads(line)
            state = request["state"]
            questions = request["questions"]
            if len(line) > 16384 or not isinstance(state, dict):
                raise ValueError("Invalid request")
            result = agent.predict(state, questions, max_len=1024)
            emit({"answers": result["answers"], "usage": result.get("usage", {})})
        except Exception:
            emit({"error": "prediction-failed"})


if __name__ == "__main__":
    # Libraries may print diagnostics. Keep stdout exclusively for bridge messages.
    with contextlib.redirect_stdout(sys.stderr):
        directory = Path(sys.argv[2])
        if sys.argv[1] == "prepare":
            prepare(directory)
            emit({"stage": "downloaded"})
        else:
            run(directory)
