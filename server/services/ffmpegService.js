const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_PATH || 'ffprobe';

/**
 * Probes video file to get duration, width, height, fps
 */
function probeVideo(videoPath) {
  return new Promise((resolve, reject) => {
    const cmd = `${FFPROBE_BIN} -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`FFprobe failed: ${stderr || error.message}`));
      }
      try {
        const info = JSON.parse(stdout);
        const videoStream = info.streams.find(s => s.codec_type === 'video') || {};
        const audioStream = info.streams.find(s => s.codec_type === 'audio') || {};

        let fps = 30;
        if (videoStream.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split('/');
          if (parts.length === 2 && parseInt(parts[1]) > 0) {
            fps = Math.round(parseInt(parts[0]) / parseInt(parts[1]));
          }
        }

        const duration = parseFloat(info.format.duration || videoStream.duration || 0);

        resolve({
          duration,
          width: parseInt(videoStream.width || 1280),
          height: parseInt(videoStream.height || 720),
          fps: fps || 30,
          videoCodec: videoStream.codec_name,
          audioCodec: audioStream.codec_name,
          format_name: info.format ? info.format.format_name : '',
          sizeBytes: parseInt(info.format.size || 0)
        });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e.message}`));
      }
    });
  });
}

/**
 * Normalizes uploaded video container to standard web-compatible progressive MP4 (ISOM/H264/AAC)
 * Fast stream-copy takes ~0.2s; transcode fallback if codec is incompatible
 */
function normalizeWebVideo(inputPath) {
  return new Promise((resolve, reject) => {
    probeVideo(inputPath).then(meta => {
      // If already a clean standard MP4 with H264, no need to touch
      if (meta.format_name === 'mov,mp4,m4a,3gp,3g2,mj2' && meta.videoCodec === 'h264' && meta.audioCodec === 'aac') {
        return resolve(inputPath);
      }

      console.log(`Normalizing video format (${meta.format_name} / ${meta.videoCodec}) to web-standard MP4...`);
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const base = path.basename(inputPath, ext);
      const tempOutput = path.join(dir, `${base}_normalized.mp4`);

      // 1. Try fast stream copy first (runs at 1000x speed)
      const copyCmd = `${FFMPEG_BIN} -y -i "${inputPath}" -c copy -movflags +faststart "${tempOutput}"`;
      exec(copyCmd, (copyErr) => {
        if (!copyErr && fs.existsSync(tempOutput) && fs.statSync(tempOutput).size > 1000) {
          try {
            fs.renameSync(tempOutput, inputPath);
            return resolve(inputPath);
          } catch (e) {
            return resolve(tempOutput);
          }
        }

        // 2. Fallback to ultrafast transcode if container/codecs require it
        const transcodeCmd = `${FFMPEG_BIN} -y -i "${inputPath}" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -movflags +faststart "${tempOutput}"`;
        exec(transcodeCmd, (tcErr) => {
          if (tcErr) return reject(new Error(`Failed to normalize video: ${tcErr.message}`));
          try {
            fs.renameSync(tempOutput, inputPath);
            resolve(inputPath);
          } catch (e) {
            resolve(tempOutput);
          }
        });
      });
    }).catch(err => reject(err));
  });
}

/**
 * Generates an ultra-fast, lightweight MP4 clip snippet for the Studio Player
 * Runs in ~0.05s via FFmpeg stream copy with +faststart
 */
function generateClipPreview(inputPath, startTime, duration, outputPreviewPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(outputPreviewPath) && fs.statSync(outputPreviewPath).size > 1000) {
      return resolve(outputPreviewPath);
    }

    const args = [
      '-y',
      '-ss', String(startTime),
      '-t', String(duration),
      '-i', inputPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPreviewPath
    ];

    const proc = spawn(FFMPEG_BIN, args);
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      if (code === 0 && fs.existsSync(outputPreviewPath) && fs.statSync(outputPreviewPath).size > 1000) {
        resolve(outputPreviewPath);
      } else {
        // Fallback to ultrafast re-encode for strict keyframe cuts if needed
        const fbArgs = [
          '-y',
          '-ss', String(startTime),
          '-t', String(duration),
          '-i', inputPath,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '24',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          outputPreviewPath
        ];
        const fbProc = spawn(FFMPEG_BIN, fbArgs);
        let fbStderr = '';
        fbProc.stderr.on('data', d => fbStderr += d.toString());
        fbProc.on('close', fbCode => {
          if (fbCode === 0 && fs.existsSync(outputPreviewPath)) {
            resolve(outputPreviewPath);
          } else {
            reject(new Error(`Clip preview generation failed: ${fbStderr || stderr}`));
          }
        });
      }
    });
  });
}

/**
 * Extracts 16kHz mono audio for transcription
 */
function extractAudio(videoPath, audioOutputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-threads', '4',
      '-loglevel', 'warning',
      '-i', videoPath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      audioOutputPath
    ];

    const proc = spawn(FFMPEG_BIN, args);
    let stderr = '';

    proc.stderr.on('data', data => stderr += data.toString());
    proc.on('close', code => {
      if (code === 0) {
        resolve(audioOutputPath);
      } else {
        reject(new Error(`FFmpeg audio extraction failed (code ${code}): ${stderr}`));
      }
    });
  });
}

/**
 * Generates video preview thumbnail
 */
function generateThumbnail(videoPath, timeSec, thumbOutputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', String(timeSec),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      thumbOutputPath
    ];

    const proc = spawn(FFMPEG_BIN, args);
    proc.on('close', code => {
      if (code === 0) resolve(thumbOutputPath);
      else reject(new Error(`Thumbnail generation failed with code ${code}`));
    });
  });
}

/**
 * Runs Python YOLOv8n ONNX subject tracker to determine optimal 9:16 crop panning
 */
function trackSubject(videoPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'tracker_local.py');
    const cmd = `python3 "${scriptPath}" "${videoPath}" ${startTime} ${duration}`;
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.warn('Subject tracking fallback to center (50%):', stderr || err.message);
        return resolve({ avgXPercent: 50.0, trajectory: [] });
      }
      try {
        const data = JSON.parse(stdout.trim());
        resolve(data);
      } catch (e) {
        resolve({ avgXPercent: 50.0, trajectory: [] });
      }
    });
  });
}

/**
 * Builds a smooth time-continuous piecewise linear camera pan expression for FFmpeg
 */
function generateDynamicCropExpression(trajectory, defaultXPercent = 50.0) {
  if (!trajectory || trajectory.length < 2) {
    const xFrac = Math.max(0.18, Math.min(0.82, (defaultXPercent || 50.0) / 100)).toFixed(3);
    return `min(max(0\\,in_w*${xFrac}-540)\\,in_w-1080)`;
  }

  // Downsample to significant keyframes (every ~1.5s or significant motion delta)
  const keyframes = [trajectory[0]];
  for (let i = 1; i < trajectory.length; i++) {
    const curr = trajectory[i];
    const prev = keyframes[keyframes.length - 1];
    const timeDiff = curr.t - prev.t;
    const deltaX = Math.abs(curr.x - prev.x);
    if (deltaX >= 0.04 || timeDiff >= 2.0 || i === trajectory.length - 1) {
      keyframes.push(curr);
    }
  }

  if (keyframes.length <= 1) {
    const xFrac = Math.max(0.18, Math.min(0.82, keyframes[0].x)).toFixed(3);
    return `min(max(0\\,in_w*${xFrac}-540)\\,in_w-1080)`;
  }

  // Build nested linear interpolation: if(lt(t, t1), lerp(x0, x1), if(lt(t, t2), ...))
  let expr = `${keyframes[keyframes.length - 1].x.toFixed(3)}`;
  for (let i = keyframes.length - 2; i >= 0; i--) {
    const k0 = keyframes[i];
    const k1 = keyframes[i + 1];
    const dt = Math.max(0.1, k1.t - k0.t).toFixed(2);
    const lerp = `(${k0.x.toFixed(3)}+(${k1.x.toFixed(3)}-${k0.x.toFixed(3)})*(t-${k0.t.toFixed(2)})/${dt})`;
    expr = `if(lt(t\\,${k1.t.toFixed(2)})\\,${lerp}\\,${expr})`;
  }

  return `min(max(0\\,(${expr})*in_w-540)\\,in_w-1080)`;
}

/**
 * Renders short vertical clip with auto-reframing, AI subject tracking, burned subtitles, and streamer SFX
 */
function renderShortClip({
  inputPath,
  outputPath,
  startTime,
  duration,
  aspectRatio = '9:16',
  reframeMode = 'smart_track', // 'smart_track' | 'split_stacked' | 'crop_center' | 'blur_fill'
  targetXPercent = 50.0,
  speakerLeftPercent = 30.0,
  speakerRightPercent = 70.0,
  trajectory = [],
  subtitlesAssPath = null,
  sfxEvents = [],
  enableSpotlight = false,
  onProgress = null
}) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', String(startTime),
      '-t', String(duration),
      '-i', inputPath
    ];

    const SFX_DIR = path.join(__dirname, '..', 'assets', 'sfx');
    const validSfx = (sfxEvents || []).filter(e => {
      const p = path.join(SFX_DIR, `${e.type}.wav`);
      return fs.existsSync(p);
    });

    // Add SFX inputs
    validSfx.forEach(e => {
      args.push('-i', path.join(SFX_DIR, `${e.type}.wav`));
    });

    let videoFilter = '';
    const spotFilter = enableSpotlight ? ',vignette=angle=PI/3.5' : '';

    if (aspectRatio === '9:16') {
      if (reframeMode === 'split_stacked') {
        // Opus Clip signature Dual-Speaker Split-Screen (Stacked Top & Bottom)
        const leftFrac = Math.max(0.12, Math.min(0.88, (speakerLeftPercent || 30.0) / 100)).toFixed(3);
        const rightFrac = Math.max(0.12, Math.min(0.88, (speakerRightPercent || 70.0) / 100)).toFixed(3);
        const cropTop = `min(max(0\\,in_w*${leftFrac}-540)\\,in_w-1080)`;
        const cropBot = `min(max(0\\,in_w*${rightFrac}-540)\\,in_w-1080)`;

        const divider = ',drawbox=x=0:y=958:w=1080:h=4:color=#6366f1:t=fill';
        if (subtitlesAssPath && fs.existsSync(subtitlesAssPath)) {
          const escapedSubPath = subtitlesAssPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');
          videoFilter = `[0:v]scale=-2:960,split=2[s1][s2];[s1]crop=1080:960:${cropTop}:0[top];[s2]crop=1080:960:${cropBot}:0[bot];[top][bot]vstack${divider}${spotFilter}[base];[base]ass='${escapedSubPath}'[outv]`;
        } else {
          videoFilter = `[0:v]scale=-2:960,split=2[s1][s2];[s1]crop=1080:960:${cropTop}:0[top];[s2]crop=1080:960:${cropBot}:0[bot];[top][bot]vstack${divider}${spotFilter}[outv]`;
        }
      } else if (reframeMode === 'smart_track') {
        // Dynamic continuous AI camera pan following moving speaker
        const dynamicCropExp = generateDynamicCropExpression(trajectory, targetXPercent);
        
        if (subtitlesAssPath && fs.existsSync(subtitlesAssPath)) {
          const escapedSubPath = subtitlesAssPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');
          videoFilter = `[0:v]scale=-2:1920,crop=1080:1920:${dynamicCropExp}:0${spotFilter}[base];[base]ass='${escapedSubPath}'[outv]`;
        } else {
          videoFilter = `[0:v]scale=-2:1920,crop=1080:1920:${dynamicCropExp}:0${spotFilter}[outv]`;
        }
      } else if (reframeMode === 'crop_center') {
        const xFrac = Math.max(0.18, Math.min(0.82, (targetXPercent || 50.0) / 100)).toFixed(3);
        const cropExp = `min(max(0\\,in_w*${xFrac}-540)\\,in_w-1080)`;
        
        if (subtitlesAssPath && fs.existsSync(subtitlesAssPath)) {
          const escapedSubPath = subtitlesAssPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');
          videoFilter = `[0:v]scale=-2:1920,crop=1080:1920:${cropExp}:0${spotFilter}[base];[base]ass='${escapedSubPath}'[outv]`;
        } else {
          videoFilter = `[0:v]scale=-2:1920,crop=1080:1920:${cropExp}:0${spotFilter}[outv]`;
        }
      } else if (reframeMode === 'blur_fill') {
        // Optimized frosted blur fill (10x faster downscaled blur)
        if (subtitlesAssPath && fs.existsSync(subtitlesAssPath)) {
          const escapedSubPath = subtitlesAssPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');
          videoFilter = `[0:v]scale=270:480:force_original_aspect_ratio=increase,boxblur=8:2,scale=1080:1920[bg];[0:v]scale=1080:-1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2${spotFilter}[base];[base]ass='${escapedSubPath}'[outv]`;
        } else {
          videoFilter = `[0:v]scale=270:480:force_original_aspect_ratio=increase,boxblur=8:2,scale=1080:1920[bg];[0:v]scale=1080:-1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2${spotFilter}[outv]`;
        }
      } else {
        videoFilter = `[0:v]scale=1080:1920${spotFilter}[outv]`;
      }
    } else {
      if (subtitlesAssPath && fs.existsSync(subtitlesAssPath)) {
        const escapedSubPath = subtitlesAssPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');
        videoFilter = `[0:v]${enableSpotlight ? 'vignette=angle=PI/3.5,' : ''}ass='${escapedSubPath}'[outv]`;
      } else {
        videoFilter = enableSpotlight ? `[0:v]vignette=angle=PI/3.5[outv]` : `[0:v]copy[outv]`;
      }
    }

    let filterParts = [videoFilter];
    let audioMap = '0:a?';

    // Mix SFX into audio stream if present, and apply Opus-grade broadcast loudnorm (-16 LUFS)
    if (validSfx.length > 0) {
      const sfxFilterParts = [];
      validSfx.forEach((e, idx) => {
        const inputIdx = idx + 1;
        const delayMs = Math.max(0, Math.round(e.time * 1000));
        const vol = (e.type === 'vine_boom' || e.type === 'airhorn') ? 1.1 : 0.9;
        sfxFilterParts.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${vol}[sfx${idx}]`);
      });

      const mixInputs = ['[0:a]', ...validSfx.map((_, idx) => `[sfx${idx}]`)].join('');
      sfxFilterParts.push(`${mixInputs}amix=inputs=${validSfx.length + 1}:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[outa]`);
      
      filterParts.push(sfxFilterParts.join(';'));
      audioMap = '[outa]';
    } else {
      filterParts.push('[0:a]loudnorm=I=-16:TP=-1.5:LRA=11[outa]');
      audioMap = '[outa]';
    }

    const fullFilter = filterParts.join(';');
    args.push('-filter_complex', fullFilter, '-map', '[outv]', '-map', audioMap);

    args.push(
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      outputPath
    );

    const proc = spawn(FFMPEG_BIN, args);
    let stderr = '';

    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
      const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})/g);
      if (timeMatch && onProgress) {
        onProgress(timeMatch[timeMatch.length - 1]);
      }
    });

    proc.on('close', code => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg render failed with code ${code}: ${stderr.slice(-500)}`));
      }
    });
  });
}

module.exports = {
  probeVideo,
  normalizeWebVideo,
  generateClipPreview,
  trackSubject,
  extractAudio,
  generateThumbnail,
  renderShortClip
};
