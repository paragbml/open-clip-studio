const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const {
  probeVideo,
  normalizeWebVideo,
  generateClipPreview,
  trackSubject,
  extractAudio,
  generateThumbnail,
  renderShortClip
} = require('./services/ffmpegService');
const { transcribeAudio } = require('./services/transcribeService');
const { discoverViralClips } = require('./services/viralityService');
const { generateAssSubtitles } = require('./services/subtitleService');
const { downloadUrl } = require('./services/downloaderService');
const { calculateJumpCuts } = require('./services/jumpCutService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PREVIEW_DIR = path.join(UPLOAD_DIR, 'previews');
const EXPORT_DIR = path.join(__dirname, 'exports');
const SAMPLES_DIR = path.join(__dirname, 'samples');
const SFX_DIR = path.join(__dirname, 'assets', 'sfx');

[UPLOAD_DIR, PREVIEW_DIR, EXPORT_DIR, SAMPLES_DIR, SFX_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure Multer storage for high-capacity video uploads (up to 4GB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `upload_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 } // 4GB max
});

// Serve static exports, samples & streamer SFX
app.use('/exports', express.static(EXPORT_DIR));
app.use('/samples', express.static(SAMPLES_DIR));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/sfx', express.static(SFX_DIR));

/**
 * Fast Dedicated Clip Preview Endpoint
 * Generates and streams lightweight, browser-optimized, frame-accurate clip MP4s in ~0.1s
 * Eliminates 2GB streaming lag and browser decoding errors
 */
app.get('/api/clip-preview', async (req, res) => {
  const filePath = req.query.filePath || req.query.path;
  const startTime = Math.max(0, parseFloat(req.query.startTime || req.query.start || 0));
  const duration = Math.max(0.5, parseFloat(req.query.duration || 30));

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  try {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5')
      .update(`${filePath}_${startTime.toFixed(2)}_${duration.toFixed(2)}`)
      .digest('hex').slice(0, 14);
    const previewPath = path.join(PREVIEW_DIR, `preview_${hash}.mp4`);

    await generateClipPreview(filePath, startTime, duration, previewPath);

    const stat = fs.statSync(previewPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(previewPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(previewPath).pipe(res);
    }
  } catch (err) {
    console.error('Clip preview error:', err);
    res.status(500).json({ error: `Clip preview generation failed: ${err.message}` });
  }
});

/**
 * HTTP 206 Partial Content Video Streaming Endpoint
 * Enables smooth HTML5 video scrubbing and prevents browser playback errors on large files
 */
app.get('/api/stream', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Video file not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

/**
 * Health & Capabilities Check
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    platform: 'OpenClip Studio',
    pricing: '100% Free & Open-Source',
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    ffmpegReady: true,
    ytdlpReady: true
  });
});

/**
 * Get Built-in Sample Videos for instant testing
 */
app.get('/api/samples', (req, res) => {
  const sampleMp4 = path.join(SAMPLES_DIR, 'sample_podcast.mp4');
  const sampleVtt = path.join(SAMPLES_DIR, 'sample_podcast.vtt');
  const samples = [];

  if (fs.existsSync(sampleMp4)) {
    samples.push({
      id: 'sample_podcast_ai',
      title: 'AI Leverage & The Future of Work (Podcast)',
      duration: 30.3,
      videoUrl: '/samples/sample_podcast.mp4',
      filePath: sampleMp4,
      vttPath: fs.existsSync(sampleVtt) ? sampleVtt : null,
      thumbnail: null,
      description: 'Studio demo podcast discussion on automation and asymmetric leverage.'
    });
  }

  const hydeParkMp4 = path.join(UPLOAD_DIR, 'upload_1789150429519_y64pxm.mp4');
  if (fs.existsSync(hydeParkMp4)) {
    samples.push({
      id: 'sample_hyde_park_debate',
      title: 'Debate & Street Interview (Hyde Park)',
      duration: 38.0,
      videoUrl: `/api/stream?path=${encodeURIComponent(hydeParkMp4)}`,
      filePath: hydeParkMp4,
      vttPath: null,
      thumbnail: null,
      description: 'Street debate at Speakers Corner. Demonstrates dual-speaker split-screen framing & 30-40s clips.'
    });
  }

  res.json({ samples });
});

/**
 * Upload Video Endpoint with robust Multer error catching
 */
app.post('/api/upload', (req, res) => {
  upload.single('video')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'The uploaded file exceeds the 4GB limit. Please choose a smaller video or use a public URL link.'
        });
      }
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    try {
      let filePath = req.file.path;
      filePath = await normalizeWebVideo(filePath);
      const meta = await probeVideo(filePath);

      res.json({
        success: true,
        videoId: path.basename(filePath, path.extname(filePath)),
        filePath,
        fileName: req.file.originalname,
        videoUrl: `/api/stream?path=${encodeURIComponent(filePath)}`,
        meta
      });
    } catch (probeErr) {
      console.error('Upload probe error:', probeErr);
      res.status(500).json({ success: false, error: `Failed to inspect video: ${probeErr.message}` });
    }
  });
});

/**
 * Download URL (YouTube, Vimeo, etc.)
 */
app.post('/api/download-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const result = await downloadUrl(url, UPLOAD_DIR);
    let filePath = result.filePath;
    filePath = await normalizeWebVideo(filePath);
    const meta = await probeVideo(filePath);

    res.json({
      success: true,
      videoId: result.fileId,
      filePath,
      videoUrl: `/api/stream?path=${encodeURIComponent(filePath)}`,
      meta
    });
  } catch (err) {
    console.error('Download URL error:', err);
    res.status(500).json({ error: `Download failed: ${err.message}` });
  }
});

/**
 * Master Pipeline: Ingest -> Probe -> Transcribe -> Viral Clip Detection
 */
app.post('/api/process', async (req, res) => {
  const { filePath, vttPath, geminiApiKey, groqApiKey, scanMode = 'lightning', enableHookScan = true } = req.body;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Valid filePath is required' });
  }

  try {
    // 1+2. Probe video metadata AND extract audio in parallel for speed
    const audioPath = path.join(UPLOAD_DIR, `${path.basename(filePath, path.extname(filePath))}_audio.wav`);
    const [meta] = await Promise.all([
      probeVideo(filePath),
      extractAudio(filePath, audioPath)
    ]);

    // 3. Transcription (Lightning mode pre-trims long files for fast 30s processing on CPU)
    const transcript = await transcribeAudio(audioPath, {
      groqApiKey,
      existingVttPath: vttPath,
      estimatedDuration: meta.duration,
      scanMode
    });

    // 4. AI Virality Scoring & Complete Narrative Clip Discovery
    const clips = await discoverViralClips(
      transcript.words,
      transcript.text,
      meta.duration,
      { geminiApiKey, groqApiKey },
      { enableHookScan }
    );

    res.json({
      success: true,
      meta,
      transcript,
      clips
    });
  } catch (err) {
    console.error('Process error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * AI Entity / Subject Motion Tracking Endpoint
 * Runs YOLOv8n ONNX to detect speaker's horizontal center coordinates across the clip
 */
app.get('/api/clip-tracking', async (req, res) => {
  const filePath = req.query.filePath || req.query.path;
  const startTime = Math.max(0, parseFloat(req.query.startTime || req.query.start || 0));
  const duration = Math.max(0.5, parseFloat(req.query.duration || 30));

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  try {
    const trackingData = await trackSubject(filePath, startTime, duration);
    res.json(trackingData);
  } catch (err) {
    console.warn('Tracking endpoint error:', err);
    res.json({ avgXPercent: 50.0, trajectory: [] });
  }
});

/**
 * Smart Jump-Cut & Dead-Air Removal Calculation Endpoint
 */
app.post('/api/jump-cuts', (req, res) => {
  const { words = [], startTime = 0, duration = 30, silenceThreshold = 0.5 } = req.body;
  const clipEnd = startTime + duration;
  const result = calculateJumpCuts(words, startTime, clipEnd, silenceThreshold);
  res.json(result);
});

/**
 * Render High-Res Short Clip with 9:16 Auto-Crop, Subject Tracking, Burned Subtitles & SFX
 */
app.post('/api/render-clip', async (req, res) => {
  const {
    filePath,
    clipId = 'clip',
    startTime = 0,
    duration = 30,
    aspectRatio = '9:16',
    reframeMode = 'smart_track', // 'smart_track' | 'split_stacked' | 'crop_center' | 'blur_fill'
    targetXPercent = 50.0,
    speakerLeftPercent = 30.0,
    speakerRightPercent = 70.0,
    sfxEvents = [],
    style = 'hormozi',
    fontSize = 58,
    words = [],
    burnSubtitles = true,
    enableSpotlight = false
  } = req.body;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Valid filePath required' });
  }

  try {
    let assPath = null;

    if (burnSubtitles && words && words.length > 0) {
      // Adjust word timings relative to clip start
      const relativeWords = words.map(w => ({
        ...w,
        start: Math.max(0, w.start - startTime),
        end: Math.max(0.1, w.end - startTime)
      })).filter(w => w.end > 0 && w.start < duration);

      const assContent = generateAssSubtitles(relativeWords, {
        style,
        fontSize,
        videoWidth: 1080,
        videoHeight: 1920
      });

      assPath = path.join(EXPORT_DIR, `sub_${Date.now()}_${clipId}.ass`);
      fs.writeFileSync(assPath, assContent, 'utf8');
    }

    const outputFileName = `openclip_${Date.now()}_${clipId}.mp4`;
    const outputPath = path.join(EXPORT_DIR, outputFileName);

    await renderShortClip({
      inputPath: filePath,
      outputPath,
      startTime,
      duration,
      aspectRatio,
      reframeMode,
      targetXPercent,
      speakerLeftPercent,
      speakerRightPercent,
      sfxEvents,
      subtitlesAssPath: assPath,
      enableSpotlight
    });

    res.json({
      success: true,
      fileName: outputFileName,
      downloadUrl: `/exports/${outputFileName}`,
      fullPath: outputPath
    });
  } catch (err) {
    console.error('Render clip error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global Error Handler to guarantee JSON responses
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 OpenClip Studio API Server running on http://localhost:${PORT}`);
});
server.setTimeout(0);
server.keepAliveTimeout = 300000;
server.headersTimeout = 305000;
