# YOLO-World v2 (small), room word list

`model.onnx` is Ultralytics' `yolov8s-worldv2.pt` with RoomSnap's word list
built in, exported to ONNX (640 px input, opset 17). `labels.json` lists the
words in class-id order.

The words are set in `scripts/export-yolo-world.py`; run it to change them.
Nothing is trained: YOLO-World already matches image regions to words, and
the export only fixes which words it reports, because the browser can't run
its text encoder.

Licence: AGPL-3.0 (Ultralytics). Distributing RoomSnap with this model, or
running it as a service for other people, brings AGPL obligations for the app.
