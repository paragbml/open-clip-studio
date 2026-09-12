import sys
import os
import json
import subprocess
import numpy as np

try:
    import onnxruntime as ort
except ImportError:
    print("Error: onnxruntime not found", file=sys.stderr)
    sys.exit(1)

MODEL_PATH = os.path.expanduser("~/.cache/huggingface/hub/models--s1777--yolo-v8n-onnx/snapshots/8723d02c28498aebfbca2a7b4df49bf231b4737b/yolov8n.onnx")

def nms(boxes, scores, iou_thresh=0.45):
    """Vectorised Non-Maximum Suppression to collapse overlapping YOLO anchor boxes"""
    if len(boxes) == 0:
        return []
    x1 = boxes[:, 0] - boxes[:, 2] / 2
    y1 = boxes[:, 1] - boxes[:, 3] / 2
    x2 = boxes[:, 0] + boxes[:, 2] / 2
    y2 = boxes[:, 1] + boxes[:, 3] / 2
    areas = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        ovr = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        inds = np.where(ovr <= iou_thresh)[0]
        order = order[inds + 1]
    return keep

def track_subject(video_path, start_time, duration, sample_fps=2):
    """
    Extracts frames at sample_fps, detects primary person and dual speakers using YOLOv8n ONNX with NMS,
    and returns smoothed horizontal trajectory, primary speaker center, and dual-speaker split coordinates.
    """
    if not os.path.exists(MODEL_PATH):
        return {
            "avgX": 0.5,
            "avgXPercent": 50.0,
            "primarySpeakerXPercent": 50.0,
            "hasTwoSpeakers": False,
            "speakerLeftPercent": 35.0,
            "speakerRightPercent": 65.0,
            "trajectory": []
        }

    session = ort.InferenceSession(MODEL_PATH, providers=['CPUExecutionProvider'])

    cmd = [
        'ffmpeg',
        '-v', 'quiet',
        '-ss', str(start_time),
        '-t', str(duration),
        '-i', video_path,
        '-vf', f'fps={sample_fps},scale=640:640',
        '-f', 'image2pipe',
        '-vcodec', 'rawvideo',
        '-pix_fmt', 'rgb24',
        '-'
    ]

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    frame_size = 640 * 640 * 3
    trajectory = []
    current_t = 0.0
    time_step = 1.0 / sample_fps

    primary_track_x = None
    smoothed_x = 0.5
    raw_positions = []
    all_detected_centers = []
    left_positions = []
    right_positions = []
    dual_frames_count = 0

    while True:
        raw_frame = proc.stdout.read(frame_size)
        if not raw_frame or len(raw_frame) < frame_size:
            break

        img_arr = np.frombuffer(raw_frame, dtype=np.uint8).reshape((640, 640, 3))
        tensor = img_arr.astype(np.float32) / 255.0
        tensor = np.transpose(tensor, (2, 0, 1))[None, ...]

        outputs = session.run(None, {'images': tensor})
        preds = outputs[0][0] # (84, 8400)

        # Class 0 is 'person' (index 4 in standard YOLOv8)
        person_scores = preds[4, :]
        # Filter confidence and realistic person bounding box dimensions
        valid_mask = (person_scores > 0.32) & (preds[2, :] > 0.08) & (preds[3, :] > 0.15)
        valid_indices = np.where(valid_mask)[0]

        target_x = smoothed_x

        if len(valid_indices) > 0:
            boxes = preds[0:4, valid_indices].T # (N, 4) in [cx, cy, w, h]
            scores = person_scores[valid_indices]

            # Apply NMS to eliminate multiple overlapping detections for the same person
            keep_indices = nms(boxes, scores, iou_thresh=0.45)
            clean_boxes = boxes[keep_indices]
            clean_scores = scores[keep_indices]

            if len(clean_boxes) > 0:
                # Calculate quality score prioritizing high confidence, foreground presence, and realistic centering
                areas = clean_boxes[:, 2] * clean_boxes[:, 3]
                qualities = clean_scores * np.sqrt(areas) * (1.0 - 0.20 * np.abs(clean_boxes[:, 0] - 0.5))

                for b in clean_boxes:
                    bx = float(b[0])
                    if 0.05 <= bx <= 0.95:
                        all_detected_centers.append(bx)

                # Primary speaker tracking with track association
                if primary_track_x is None:
                    best_idx = int(np.argmax(qualities))
                    primary_track_x = float(clean_boxes[best_idx, 0])
                    target_x = primary_track_x
                    smoothed_x = primary_track_x
                else:
                    # Find candidate closest to existing primary speaker track
                    dists = np.abs(clean_boxes[:, 0] - primary_track_x)
                    closest_idx = int(np.argmin(dists))

                    if dists[closest_idx] < 0.25:
                        target_x = float(clean_boxes[closest_idx, 0])
                    else:
                        # Major scene change or camera cut: lock onto highest quality speaker candidate
                        best_idx = int(np.argmax(qualities))
                        target_x = float(clean_boxes[best_idx, 0])

                    primary_track_x = target_x

                # Check for simultaneous dual speakers in frame
                if len(clean_boxes) >= 2:
                    sorted_by_area = np.argsort(-areas)
                    p1_x = float(clean_boxes[sorted_by_area[0], 0])
                    p2_x = float(clean_boxes[sorted_by_area[1], 0])
                    if 0.05 <= p1_x <= 0.95 and 0.05 <= p2_x <= 0.95 and abs(p1_x - p2_x) > 0.14:
                        dual_frames_count += 1
                        left_positions.append(min(p1_x, p2_x))
                        right_positions.append(max(p1_x, p2_x))

        # Deadband filter: ignore micro-jitter below 2.5%
        if abs(target_x - smoothed_x) > 0.025:
            smoothed_x = 0.65 * smoothed_x + 0.35 * target_x
        
        clamped_x = max(0.18, min(0.82, smoothed_x))

        raw_positions.append(clamped_x)
        trajectory.append({
            "t": round(current_t, 2),
            "x": round(clamped_x, 3),
            "xPercent": round(clamped_x * 100, 1)
        })
        current_t += time_step

    proc.stdout.close()
    proc.wait()

    avg_x = float(np.mean(raw_positions)) if raw_positions else 0.5
    median_x = float(np.median(raw_positions)) if raw_positions else avg_x

    # Cross-cut podcast/interview dual speaker clustering:
    left_cluster = [x for x in all_detected_centers if x < 0.48]
    right_cluster = [x for x in all_detected_centers if x > 0.52]

    has_two_speakers = (
        dual_frames_count >= max(2, len(trajectory) * 0.15) or
        (len(left_cluster) >= 3 and len(right_cluster) >= 3 and (np.mean(right_cluster) - np.mean(left_cluster)) >= 0.16)
    )

    if left_positions:
        avg_left = float(np.mean(left_positions))
    elif left_cluster:
        avg_left = float(np.mean(left_cluster))
    else:
        avg_left = max(0.20, avg_x - 0.22)

    if right_positions:
        avg_right = float(np.mean(right_positions))
    elif right_cluster:
        avg_right = float(np.mean(right_cluster))
    else:
        avg_right = min(0.80, avg_x + 0.22)

    return {
        "duration": duration,
        "sampleCount": len(trajectory),
        "avgX": round(avg_x, 3),
        "avgXPercent": round(avg_x * 100, 1),
        "primarySpeakerXPercent": round(median_x * 100, 1),
        "hasTwoSpeakers": bool(has_two_speakers),
        "speakerLeftPercent": round(avg_left * 100, 1),
        "speakerRightPercent": round(avg_right * 100, 1),
        "trajectory": trajectory
    }

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 tracker_local.py <video_path> <start_time> <duration> [out_json]")
        sys.exit(1)

    video = sys.argv[1]
    start = float(sys.argv[2])
    dur = float(sys.argv[3])
    out_json = sys.argv[4] if len(sys.argv) > 4 else None

    result = track_subject(video, start, dur)
    
    if out_json:
        with open(out_json, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Tracking data saved to {out_json}")
    else:
        print(json.dumps(result))
