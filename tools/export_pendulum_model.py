"""Export the coursework Keras checkpoint for browser inference.

Usage: python tools/export_pendulum_model.py path/to/checkpoint.h5
Requires h5py. Run from any directory.
"""

import argparse
import json
from pathlib import Path

import h5py
import numpy as np


def export(checkpoint):
    with h5py.File(checkpoint, "r") as model:
        config = json.loads(model.attrs["model_config"])
        if config["class_name"] != "Sequential":
            raise ValueError("Expected a Sequential model")
        dense = [
            layer["config"]
            for layer in config["config"]["layers"]
            if layer["class_name"] != "InputLayer"
        ]
        layer_types = [
            layer["class_name"]
            for layer in config["config"]["layers"]
            if layer["class_name"] != "InputLayer"
        ]
        if layer_types != ["Dense"] * 3:
            raise ValueError("Expected three Dense layers")

        layers = []
        shapes = [(3, 128), (128, 128), (128, 9)]
        for index, (layer, shape) in enumerate(zip(dense, shapes)):
            name = layer["name"]
            group = model["model_weights"][name][name]
            kernel = group["kernel:0"][()]
            bias = group["bias:0"][()]
            activation = layer["activation"]
            if kernel.shape != shape or bias.shape != (shape[1],):
                raise ValueError(f"Unexpected dimensions for {name}")
            if activation != ("relu" if index < 2 else "linear"):
                raise ValueError(f"Unexpected activation for {name}")
            if not np.isfinite(kernel).all() or not np.isfinite(bias).all():
                raise ValueError(f"Non-finite weights in {name}")
            layers.append({"kernel": kernel.tolist(), "bias": bias.tolist(), "activation": activation})

    destination = Path(__file__).resolve().parents[1] / "demos/data/pendulum-model.json"
    destination.write_text(json.dumps({"layers": layers}, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path)
    export(parser.parse_args().checkpoint)
