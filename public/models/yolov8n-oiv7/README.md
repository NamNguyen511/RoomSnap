# YOLOv8n, Open Images V7

`model.onnx` is Ultralytics' `yolov8n-oiv7.pt` exported to ONNX (640 px input,
opset 17). `labels.json` lists its 601 class names by class id.

Licence: AGPL-3.0 (Ultralytics). Distributing RoomSnap with this model, or
running it as a service for other people, brings AGPL obligations for the app.

To regenerate:

    pip install ultralytics onnx onnxslim
    yolo export model=yolov8n-oiv7.pt format=onnx imgsz=640 opset=17
