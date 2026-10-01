"""Exports YOLO-World (small, v2) with RoomSnap's word list baked in.

YOLO-World finds objects described by words. The browser can't run its
text encoder, so the words are fixed here and the model is exported to
ONNX with them built in. To change what the "Room objects" model looks
for, edit WORDS and run this again:

    pip install ultralytics onnx onnxslim "git+https://github.com/ultralytics/CLIP.git"
    python scripts/export-yolo-world.py

Writes public/models/yolo-world-room/{model.onnx,labels.json}.
"""

import json
import shutil
from pathlib import Path

from ultralytics import YOLO

# Furniture and fittings the 80-category models can't find...
ROOM_WORDS = [
    "lamp", "chandelier", "shelf", "bookshelf", "desk", "table", "sideboard",
    "cabinet", "nightstand", "wardrobe", "chest of drawers", "stool", "bench",
    "rug", "curtain", "window blind", "picture frame", "mirror", "pillow",
    "blanket", "window", "door", "radiator", "fireplace", "candle",
    "ceiling fan", "air conditioner", "speaker", "monitor", "printer",
    "trash can", "basket", "box",
]
# ...plus the household things YOLOv8 already knows, so one model covers both.
HOUSEHOLD_WORDS = [
    "chair", "couch", "bed", "tv", "laptop", "keyboard", "computer mouse",
    "remote control", "cell phone", "book", "clock", "vase", "potted plant",
    "bottle", "cup", "bowl", "refrigerator", "microwave", "oven", "stove",
    "toaster", "kettle", "sink", "dishwasher", "washing machine", "toilet",
    "bathtub", "towel", "backpack", "handbag", "suitcase", "umbrella",
    "teddy bear",
]
WORDS = ROOM_WORDS + HOUSEHOLD_WORDS

OUT = Path(__file__).resolve().parent.parent / "public/models/yolo-world-room"

model = YOLO("yolov8s-worldv2.pt")
model.set_classes(WORDS)
model.save("yolo-world-room.pt")
onnx_path = YOLO("yolo-world-room.pt").export(format="onnx", imgsz=640, opset=17, simplify=True)

OUT.mkdir(parents=True, exist_ok=True)
shutil.move(onnx_path, OUT / "model.onnx")
(OUT / "labels.json").write_text(json.dumps(WORDS))
print(f"{len(WORDS)} words -> {OUT}")
