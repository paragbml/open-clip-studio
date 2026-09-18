import sys
import os
import json
import subprocess
import numpy as np

try:
    import cv2
except ImportError:
    print("Error: cv2 not found", file=sys.stderr)
    sys.exit(1)

YUNET_MODEL_PATH = os.path.expanduser("~/.cache/huggingface/hub/models--opencv--face_detection_yunet/snapshots/3cc26e7f1014a5ee5d74a42acee58bafc9d0a310/face_detection_yunet_2023mar.onnx")

def track_subject(video_path, start_time, duration, sample_fps=2):
    """
    Cinema-Grade Active Speaker Tracking & Auto-Reframe Engine:
    - Uses OpenCV native FaceDetectorYN (C++ YuNet) for 2ms face and landmark detection.
    - Implements Deadband Cinema Stabilization: camera stays rock-solid on the subject,
      filtering out natural micro-movements and head bobbing.
    - Identifies dual-speaker interview layouts (host vs guest) with stable left/right coordinates.
    """
    abs_video_path = os.path.abspath(video_path)
    if not os.path.exists(abs_video_path):
        return {
            "duration": duration,
            "sampleCount": 0,
            "avgX": 0.5,
            "avgXPercent": 50.0,
            "primarySpeakerXPercent": 50.0,
            "hasTwoSpeakers": False,
            "speakerLeftPercent": 30.0,
            "speakerRightPercent": 70.0,
            "trajectory": []
        }

    if not os.path.exists(YUNET_MODEL_PATH):
        print(f"Warning: Face model not found at {YUNET_MODEL_PATH}", file=sys.stderr)
        return {
            "duration": duration,
            "sampleCount": 0,
            "avgX": 0.5,
            "avgXPercent": 50.0,
            "primarySpeakerXPercent": 50.0,
            "hasTwoSpeakers": False,
            "speakerLeftPercent": 30.0,
            "speakerRightPercent": 70.0,
            "trajectory": []
        }

    # Initialize OpenCV C++ FaceDetectorYN
    detector = cv2.FaceDetectorYN.create(
        YUNET_MODEL_PATH,
        '',
        (640, 640),
        0.32,  # Score threshold
        0.25,  # NMS threshold
        5000
    )

    # Stream frames scaled to 640x640 BGR via fast FFmpeg seeking
    cmd = [
        'ffmpeg',
        '-v', 'quiet',
        '-ss', str(start_time),
        '-t', str(duration),
        '-i', abs_video_path,
        '-vf', f'fps={sample_fps},scale=640:640',
        '-f', 'image2pipe',
        '-vcodec', 'rawvideo',
        '-pix_fmt', 'bgr24',
        '-'
    ]

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    frame_size = 640 * 640 * 3
    time_step = 1.0 / sample_fps

    frame_detections = []
    current_t = 0.0

    while True:
        raw_frame = proc.stdout.read(frame_size)
        if not raw_frame or len(raw_frame) < frame_size:
            break

        img = np.frombuffer(raw_frame, dtype=np.uint8).reshape((640, 640, 3))
        detector.setInputSize((640, 640))
        _, raw_faces = detector.detect(img)

        faces = []
        if raw_faces is not None and len(raw_faces) > 0:
            for f in raw_faces:
                box = f[0:4]
                conf = float(f[-1])
                if conf < 0.32:
                    continue
                w_frac = float(box[2] / 640.0)
                h_frac = float(box[3] / 640.0)
                cx = float((box[0] + box[2] / 2.0) / 640.0)
                cy = float((box[1] + box[3] / 2.0) / 640.0)
                area = w_frac * h_frac
                faces.append({
                    'cx': cx,
                    'cy': cy,
                    'area': area,
                    'conf': conf
                })

        frame_detections.append({'t': current_t, 'faces': faces})
        current_t += time_step

    proc.stdout.close()
    proc.wait()

    # Step 2: Extract all valid face centers to analyze spatial distribution
    all_face_centers = []
    for fd in frame_detections:
        for fc in fd['faces']:
            if 0.08 <= fc['cx'] <= 0.92:
                all_face_centers.append(fc['cx'])

    if not all_face_centers:
        default_x = 0.50
        traj = [{"t": round(fd['t'], 2), "x": default_x, "xPercent": 50.0, "activeSpeaker": "center"} for fd in frame_detections]
        return {
            "duration": duration,
            "sampleCount": len(traj),
            "avgX": default_x,
            "avgXPercent": 50.0,
            "primarySpeakerXPercent": 50.0,
            "hasTwoSpeakers": False,
            "speakerLeftPercent": 30.0,
            "speakerRightPercent": 70.0,
            "trajectory": traj
        }

    # Step 3: Cluster analysis for two-speaker setups (e.g. podcast interview)
    left_cluster = [x for x in all_face_centers if x < 0.44]
    right_cluster = [x for x in all_face_centers if x > 0.56]
    center_cluster = [x for x in all_face_centers if 0.44 <= x <= 0.56]

    has_two_speakers = (len(left_cluster) >= 4 and len(right_cluster) >= 4 and (len(left_cluster) + len(right_cluster)) > len(center_cluster))

    avg_left = float(np.mean(left_cluster)) if left_cluster else 0.32
    avg_right = float(np.mean(right_cluster)) if right_cluster else 0.68

    # Primary anchor: robust median of the dominant cluster
    if has_two_speakers:
        primary_anchor = avg_left if len(left_cluster) >= len(right_cluster) else avg_right
    else:
        primary_anchor = float(np.median(all_face_centers))

    # Step 4: Cinema Deadband & Inertia Stabilization
    # If overall speaker movement is within natural head-bobbing range (< 0.14),
    # lock the camera firmly on the primary anchor with zero wobbling.
    overall_span = max(all_face_centers) - min(all_face_centers)
    is_stable_monologue = (overall_span < 0.14) and not has_two_speakers

    current_camera_x = primary_anchor
    trajectory = []
    deadband = 0.08  # 8% screen deadband zone: camera stays still unless subject moves outside

    for fd in frame_detections:
        t = fd['t']
        faces = fd['faces']

        if is_stable_monologue:
            target_x = primary_anchor
            speaker_label = "center"
        elif faces:
            dominant = max(faces, key=lambda f: f['area'] * f['conf'])
            raw_cx = dominant['cx']
            
            # Deadband check: if within deadband box, camera holds position
            if abs(raw_cx - current_camera_x) > deadband:
                current_camera_x = 0.85 * current_camera_x + 0.15 * raw_cx
            
            target_x = current_camera_x
            speaker_label = "left" if target_x < 0.44 else ("right" if target_x > 0.56 else "center")
        else:
            target_x = current_camera_x
            speaker_label = "center"

        clamped_x = max(0.20, min(0.80, target_x))
        trajectory.append({
            "t": round(t, 2),
            "x": round(clamped_x, 3),
            "xPercent": round(clamped_x * 100.0, 1),
            "activeSpeaker": speaker_label
        })

    avg_x = float(np.mean([pt['x'] for pt in trajectory]))

    return {
        "duration": duration,
        "sampleCount": len(trajectory),
        "avgX": round(avg_x, 3),
        "avgXPercent": round(avg_x * 100.0, 1),
        "primarySpeakerXPercent": round(primary_anchor * 100.0, 1),
        "hasTwoSpeakers": bool(has_two_speakers),
        "speakerLeftPercent": round(avg_left * 100.0, 1),
        "speakerRightPercent": round(avg_right * 100.0, 1),
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
