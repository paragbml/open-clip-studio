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

def track_subject(video_path, start_time, duration, sample_fps=2):
    """
    Extracts frames at sample_fps, detects primary person and dual speakers using YOLOv8n ONNX,
    and returns smoothed horizontal trajectory and dual-speaker split coordinates.
    """
    if not os.path.exists(MODEL_PATH):
        return {
            "avgX": 0.5,
            "avgXPercent": 50.0,
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

    smoothed_x = 0.5
    raw_positions = []
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
        valid_mask = person_scores > 0.25

        target_x = smoothed_x

        if np.any(valid_mask):
            valid_indices = np.where(valid_mask)[0]
            boxes = preds[0:4, valid_indices] # (4, N)
            areas = boxes[2, :] * boxes[3, :] # w * h

            # Sort detected people by area (largest to smallest)
            sorted_indices = valid_indices[np.argsort(-areas)]
            best_idx = sorted_indices[0]
            cx = float(preds[0, best_idx])
            if 0.0 <= cx <= 1.0:
                target_x = cx

            # Dual-speaker check: if two distinct people are detected
            if len(sorted_indices) >= 2:
                p1_x = float(preds[0, sorted_indices[0]])
                p2_x = float(preds[0, sorted_indices[1]])
                if abs(p1_x - p2_x) > 0.14:
                    dual_frames_count += 1
                    left_x = min(p1_x, p2_x)
                    right_x = max(p1_x, p2_x)
                    left_positions.append(left_x)
                    right_positions.append(right_x)

        smoothed_x = 0.75 * smoothed_x + 0.25 * target_x
        clamped_x = max(0.20, min(0.80, smoothed_x))

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
    has_two_speakers = dual_frames_count >= max(2, len(trajectory) * 0.2)
    avg_left = float(np.mean(left_positions)) if left_positions else max(0.22, avg_x - 0.22)
    avg_right = float(np.mean(right_positions)) if right_positions else min(0.78, avg_x + 0.22)

    return {
        "duration": duration,
        "sampleCount": len(trajectory),
        "avgX": round(avg_x, 3),
        "avgXPercent": round(avg_x * 100, 1),
        "hasTwoSpeakers": has_two_speakers,
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
