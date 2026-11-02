import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import IngestionZone from './components/IngestionZone';
import ProcessingStatus from './components/ProcessingStatus';
import ClipList from './components/ClipList';
import StudioEditor from './components/StudioEditor';
import ExportModal from './components/ExportModal';
import ApiSettingsModal from './components/ApiSettingsModal';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [samples, setSamples] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);

  const [activeVideo, setActiveVideo] = useState(() => {
    try {
      const saved = localStorage.getItem('openclip_active_video');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  const [processingStep, setProcessingStep] = useState(1);
  const [processingText, setProcessingText] = useState('');
  const [clips, setClips] = useState(() => {
    try {
      const saved = localStorage.getItem('openclip_clips');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [selectedClip, setSelectedClip] = useState(() => {
    try {
      const saved = localStorage.getItem('openclip_selected_clip');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('openclip_view');
    const hasClips = localStorage.getItem('openclip_clips');
    if (saved) return saved;
    return hasClips ? 'clips' : 'ingestion';
  });

  // Export State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState(null);

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState(() => {
    return {
      geminiApiKey: localStorage.getItem('openclip_gemini_key') || '',
      groqApiKey: localStorage.getItem('openclip_groq_key') || '',
      githubToken: localStorage.getItem('openclip_github_token') || '',
      backendUrl: localStorage.getItem('openclip_backend_url') || '',
      ytCookies: localStorage.getItem('openclip_yt_cookies') || ''
    };
  });

  const getApiUrl = (endpoint) => {
    const customBackend = apiKeys.backendUrl || localStorage.getItem('openclip_backend_url') || '';
    if (customBackend) {
      return `${customBackend.replace(/\/$/, '')}${endpoint}`;
    }
    return endpoint;
  };

  // Fetch initial samples & system status on mount
  useEffect(() => {
    fetch(getApiUrl('/api/samples'))
      .then(res => res.json())
      .then(data => setSamples(data.samples || []))
      .catch(() => {
        // Fallback sample for GitHub Pages Demo Mode
        setSamples([
          {
            id: 'sample_podcast',
            title: 'Tech & AI Founders Podcast (Dual Speaker Demo)',
            videoUrl: './samples/sample_podcast.mp4',
            vttUrl: './samples/sample_podcast.vtt',
            duration: 35
          }
        ]);
      });

    fetch(getApiUrl('/api/status'))
      .then(res => res.json())
      .then(data => {
        setSystemStatus(data);
        if (data.githubToken && !localStorage.getItem('openclip_github_token')) {
          localStorage.setItem('openclip_github_token', data.githubToken);
          setApiKeys(prev => ({ ...prev, githubToken: data.githubToken }));
        }
      })
      .catch(() => {
        setSystemStatus({
          status: 'ok',
          platform: 'OpenClip Studio Web Demo',
          pricing: '100% Free & Open-Source',
          isStaticDemo: true,
          ffmpegReady: false
        });
      });
  }, [apiKeys.backendUrl]);

  const handleSaveKeys = (newKeys) => {
    setApiKeys(newKeys);
    localStorage.setItem('openclip_gemini_key', newKeys.geminiApiKey || '');
    localStorage.setItem('openclip_groq_key', newKeys.groqApiKey || '');
    localStorage.setItem('openclip_github_token', newKeys.githubToken || '');
    localStorage.setItem('openclip_backend_url', newKeys.backendUrl || '');
    localStorage.setItem('openclip_yt_cookies', newKeys.ytCookies || '');
  };

  useEffect(() => {
    if (activeVideo) localStorage.setItem('openclip_active_video', JSON.stringify(activeVideo));
    else localStorage.removeItem('openclip_active_video');
  }, [activeVideo]);

  useEffect(() => {
    if (clips && clips.length > 0) localStorage.setItem('openclip_clips', JSON.stringify(clips));
    else localStorage.removeItem('openclip_clips');
  }, [clips]);

  useEffect(() => {
    if (selectedClip) localStorage.setItem('openclip_selected_clip', JSON.stringify(selectedClip));
    else localStorage.removeItem('openclip_selected_clip');
  }, [selectedClip]);

  useEffect(() => {
    localStorage.setItem('openclip_view', view);
  }, [view]);

  // Safe fetch helper to guarantee JSON parsing and clear error messages
  const safeFetchJson = async (url, options = {}) => {
    const targetUrl = url.startsWith('http') ? url : getApiUrl(url);
    const res = await fetch(targetUrl, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (res.status === 502 || res.status === 503) {
        throw new Error(
          'The server is currently waking up or updating (Render Free Tier cold-start). Please wait ~15-30 seconds and try again!'
        );
      }
      if (res.status === 405 || text.includes('405 Not Allowed')) {
        throw new Error(
          'GitHub Pages is a static host and cannot run FFmpeg / yt-dlp.\n\n' +
          'To process your own videos or YouTube links:\n' +
          '1. Run OpenClip locally with "npm run dev" (http://localhost:5173)\n' +
          '2. Or click "Settings" (top right) to connect your Backend Server URL.'
        );
      }
      throw new Error(`Server returned an error (${res.status}): ${text.slice(0, 160)}`);
    }
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Server request failed (${res.status})`);
    }
    return data;
  };

  const [scanMode, setScanMode] = useState('lightning');
  const [enableHookScan, setEnableHookScan] = useState(true);

  // Resilient Async Job Poller (Zero-timeout cloud architecture)
  const pollJob = async (jobId, onProgress) => {
    let consecutiveErrors = 0;
    while (true) {
      await new Promise(r => setTimeout(r, 1200));
      try {
        const data = await safeFetchJson(`/api/jobs/${jobId}`);
        consecutiveErrors = 0;
        const job = data.job;
        if (!job) continue;

        if (onProgress) onProgress(job);

        if (job.status === 'completed') {
          return job.result;
        }
        if (job.status === 'failed') {
          throw new Error(job.error || 'Operation failed on server');
        }
      } catch (err) {
        if (err.message && (err.message.includes('failed on server') || err.message.includes('not found'))) {
          throw err;
        }
        consecutiveErrors++;
        // If 15 consecutive network errors (~20 seconds of no server response)
        if (consecutiveErrors > 15) {
          throw new Error('Lost connection to server. Please check your internet or retry.');
        }
      }
    }
  };

  // 1. Process Video Pipeline (Async & Synchronous fallback)
  const runProcessingPipeline = async (filePath, vttPath = null, videoUrl = null) => {
    setView('processing');
    setProcessingStep(1);
    setProcessingText('Extracting 16kHz audio stream via FFmpeg...');

    try {
      let procResult = null;

      try {
        // Preferred: Async background job with real-time polling
        const launch = await safeFetchJson('/api/jobs/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath,
            vttPath,
            geminiApiKey: apiKeys.geminiApiKey,
            groqApiKey: apiKeys.groqApiKey,
            githubToken: apiKeys.githubToken,
            scanMode,
            enableHookScan
          })
        });

        if (launch && launch.jobId) {
          procResult = await pollJob(launch.jobId, (job) => {
            if (job.step) setProcessingStep(job.step);
            if (job.progressText) setProcessingText(job.progressText);
          });
        }
      } catch (asyncErr) {
        // Fallback to synchronous endpoint if jobs endpoint unavailable
        console.warn('Async job failed, trying synchronous endpoint:', asyncErr.message);
        procResult = await safeFetchJson('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath,
            vttPath,
            geminiApiKey: apiKeys.geminiApiKey,
            groqApiKey: apiKeys.groqApiKey,
            githubToken: apiKeys.githubToken,
            scanMode,
            enableHookScan
          })
        });
      }

      setProcessingStep(5);
      setProcessingText('Finalizing kinetic subtitle presets & studio clips...');

      setTimeout(() => {
        setActiveVideo({
          filePath,
          videoUrl: videoUrl || `/api/stream?path=${encodeURIComponent(filePath)}`,
          meta: procResult.meta
        });
        setClips(procResult.clips || []);
        setView('clips');
      }, 500);

    } catch (err) {
      console.warn('Backend unavailable or static mode, loading Web Demo clips:', err.message);
      const fallbackClips = [
        {
          id: 'demo_clip_1',
          title: 'The Single Most Effective Brain Protocol ⚡',
          hookType: 'Actionable Advice',
          start: 0,
          end: 32.5,
          startTime: 0,
          endTime: 32.5,
          duration: 32.5,
          viralityScore: 97,
          hookScore: 94,
          flowScore: 92,
          energyScore: 89,
          climaxScore: 96,
          viralityReason: 'Agency ML Analysis: Rapid 0.8s hook-to-setup velocity, featuring high-retention curiosity opening, optimal speech cadence (165 WPM), and decisive mic-drop payoff.',
          mlModel: 'OpenClip-Proprietary-v4-46D-Multimodal',
          semanticMargin: 0.94,
          acousticPower: 0.72,
          hookVelocity: 0.96,
          survivalProbability: 0.94,
          mlVerified: true,
          hashtags: ['#shorts', '#brainhack', '#podcast', '#health'],
          suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels'],
          words: [
            { word: 'The', start: 0.1, end: 0.28 },
            { word: 'best', start: 0.29, end: 0.55 },
            { word: 'way', start: 0.56, end: 0.78 },
            { word: 'to', start: 0.79, end: 0.95 },
            { word: 'spike', start: 0.96, end: 1.35 },
            { word: 'morning', start: 1.36, end: 1.7 },
            { word: 'energy', start: 1.71, end: 2.1 },
            { word: 'is', start: 2.15, end: 2.3 },
            { word: 'to', start: 2.35, end: 2.5 },
            { word: 'get', start: 2.55, end: 2.75 },
            { word: 'bright', start: 2.76, end: 3.1 },
            { word: 'light', start: 3.15, end: 3.45 },
            { word: 'in', start: 3.46, end: 3.6 },
            { word: 'your', start: 3.61, end: 3.75 },
            { word: 'eyes', start: 3.76, end: 4.1 },
            { word: 'within', start: 4.15, end: 4.45 },
            { word: 'the', start: 4.46, end: 4.6 },
            { word: 'first', start: 4.61, end: 4.9 },
            { word: 'thirty', start: 4.95, end: 5.3 },
            { word: 'minutes', start: 5.35, end: 5.75 },
            { word: 'of', start: 5.76, end: 5.9 },
            { word: 'your', start: 5.91, end: 6.1 },
            { word: 'day.', start: 6.15, end: 6.6 }
          ]
        },
        {
          id: 'demo_clip_2',
          title: 'Building An Unshakeable Mindset 🧠',
          hookType: 'High-Stakes Condition',
          start: 5,
          end: 30,
          startTime: 5,
          endTime: 30,
          duration: 25,
          viralityScore: 93,
          hookScore: 90,
          flowScore: 91,
          energyScore: 86,
          climaxScore: 92,
          viralityReason: 'Agency ML Analysis: High-voltage performance thesis addressing resilience under pressure with complete conversational mic-drop closure.',
          mlModel: 'OpenClip-Proprietary-v4-46D-Multimodal',
          semanticMargin: 0.91,
          acousticPower: 0.68,
          hookVelocity: 0.88,
          survivalProbability: 0.89,
          mlVerified: true,
          hashtags: ['#mindset', '#discipline', '#focus'],
          suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels'],
          words: [
            { word: 'When', start: 5.2, end: 5.5 },
            { word: 'you', start: 5.55, end: 5.75 },
            { word: 'build', start: 5.8, end: 6.1 },
            { word: 'an', start: 6.15, end: 6.3 },
            { word: 'unshakeable', start: 6.35, end: 6.9 },
            { word: 'mindset,', start: 6.95, end: 7.4 },
            { word: 'you', start: 7.45, end: 7.65 },
            { word: 'never', start: 7.7, end: 8.05 },
            { word: 'collapse', start: 8.1, end: 8.5 },
            { word: 'under', start: 8.55, end: 8.85 },
            { word: 'pressure.', start: 8.9, end: 9.4 }
          ]
        }
      ];

      setActiveVideo({
        filePath: filePath || 'sample_podcast.mp4',
        videoUrl: videoUrl || './samples/sample_podcast.mp4',
        meta: { title: 'Sample Podcast Demo', duration: 35 }
      });
      setClips(fallbackClips);
      setView('clips');
    }
  };

  // 2. Upload file handler with real-time percentage, MB counter & speed tracking
  const handleUploadFile = (file) => {
    setView('processing');
    setProcessingStep(1);
    const totalMB = (file.size / (1024 * 1024)).toFixed(1);
    setProcessingText(`Uploading ${file.name} (0% • 0 / ${totalMB} MB)...`);

    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();
    const targetUrl = getApiUrl('/api/upload');
    xhr.open('POST', targetUrl, true);

    const startTime = Date.now();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.floor((e.loaded / e.total) * 100);
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedMBps = elapsedSec > 0.5 ? ((e.loaded / (1024 * 1024)) / elapsedSec).toFixed(1) : '...';
        const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
        
        let estMsg = '';
        if (elapsedSec > 2 && e.loaded > 0) {
          const remainingSec = Math.round((e.total - e.loaded) / (e.loaded / elapsedSec));
          const remMin = Math.floor(remainingSec / 60);
          const remSec = remainingSec % 60;
          estMsg = remMin > 0 ? ` • ~${remMin}m ${remSec}s left` : ` • ~${remSec}s left`;
        }

        setProcessingText(`Uploading ${file.name}: ${pct}% (${loadedMB} / ${totalMB} MB @ ${speedMBps} MB/s${estMsg})`);
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          setProcessingText('Upload complete! Extracting audio & preparing AI analysis...');
          await runProcessingPipeline(data.filePath, null, data.videoUrl);
        } catch (parseErr) {
          alert('Upload failed: Invalid server response');
          setView('ingestion');
        }
      } else {
        let errMsg = `Upload failed (${xhr.status})`;
        try {
          const errObj = JSON.parse(xhr.responseText);
          if (errObj.error) errMsg = errObj.error;
        } catch (e) {
          if (xhr.status === 502 || xhr.status === 503) {
            errMsg = 'The server is temporarily starting up or busy. Please retry in a moment!';
          }
        }
        alert(`Upload error: ${errMsg}`);
        setView('ingestion');
      }
    };

    xhr.onerror = () => {
      alert('Upload failed due to network error. If your file is very large (e.g. 2GB), your internet connection may have timed out.');
      setView('ingestion');
    };

    xhr.send(formData);
  };

  // 3. Download URL handler (Zero-timeout async architecture)
  const handleDownloadUrl = async (url) => {
    setView('processing');
    setProcessingStep(1);
    setProcessingText('Connecting to stream & extracting highlight segment...');

    const storedCookies = apiKeys.ytCookies || localStorage.getItem('openclip_yt_cookies') || '';

    try {
      let dlResult = null;

      try {
        // Preferred: Async background job with real-time polling
        const launch = await safeFetchJson('/api/jobs/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, cookies: storedCookies, maxMinutes: 10 })
        });

        if (launch && launch.jobId) {
          dlResult = await pollJob(launch.jobId, (job) => {
            setProcessingText(job.progressText || 'Downloading stream highlights...');
          });
        }
      } catch (asyncErr) {
        // Fallback to synchronous endpoint
        console.warn('Async download job failed, using synchronous fallback:', asyncErr.message);
        dlResult = await safeFetchJson('/api/download-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, cookies: storedCookies, maxMinutes: 10 })
        });
      }

      await runProcessingPipeline(dlResult.filePath, null, dlResult.videoUrl);
    } catch (err) {
      const isBotBlock = err.message.includes('not a bot') || err.message.includes('429');
      if (isBotBlock) {
        alert(
          'YouTube blocked automated downloads from cloud servers (Bot Check / HTTP 429).\n\n' +
          '• Solution 1 (Recommended): Download the video on your device (e.g. via cobalt.tools) and drag & drop the MP4 here for instant processing!\n' +
          '• Solution 2: Paste your YouTube cookies into Settings (top right) to authorize cloud downloads.'
        );
      } else {
        alert(`Download error: ${err.message}`);
      }
      setView('ingestion');
    }
  };

  // 4. Select Sample Demo handler
  const handleSelectSample = (sample) => {
    runProcessingPipeline(sample.filePath, sample.vttPath, sample.videoUrl);
  };

  // 5. Open Studio Editor for a clip
  const handleSelectClip = (clip) => {
    setSelectedClip(clip);
    setView('studio');
  };

  // 6. Trigger Render & Export
  const handleExportClip = async (exportParams) => {
    setIsExportModalOpen(true);
    setIsRendering(true);
    setExportResult(null);
    setExportError(null);

    try {
      const data = await safeFetchJson('/api/render-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportParams)
      });

      setIsRendering(false);
      setExportResult(data);
    } catch (err) {
      setIsRendering(false);
      setExportError(err.message);
    }
  };

  const handleNewVideo = () => {
    setActiveVideo(null);
    setClips([]);
    setSelectedClip(null);
    setView('ingestion');
    localStorage.removeItem('openclip_active_video');
    localStorage.removeItem('openclip_clips');
    localStorage.removeItem('openclip_selected_clip');
    localStorage.setItem('openclip_view', 'ingestion');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        status={systemStatus}
        view={view}
        onNavigate={setView}
        onNewVideo={handleNewVideo}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main style={{ flex: 1 }}>
        <ErrorBoundary onBack={() => setView('clips')}>
          {view === 'ingestion' && (
            <IngestionZone
              samples={samples}
              onSelectSample={handleSelectSample}
              onUploadFile={handleUploadFile}
              onDownloadUrl={handleDownloadUrl}
              scanMode={scanMode}
              onScanModeChange={setScanMode}
              enableHookScan={enableHookScan}
              onEnableHookScanChange={setEnableHookScan}
              isLoading={false}
              isStaticDemo={Boolean(!apiKeys.backendUrl && (systemStatus?.isStaticDemo || (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))))}
              backendUrl={apiKeys.backendUrl}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {view === 'processing' && (
            <ProcessingStatus
              step={processingStep}
              progressText={processingText}
              onCancel={() => setView('ingestion')}
            />
          )}

          {view === 'clips' && (
            <ClipList
              clips={clips}
              videoMeta={activeVideo?.meta}
              onSelectClip={handleSelectClip}
              onNewVideo={handleNewVideo}
            />
          )}

          {view === 'studio' && selectedClip && (
            <StudioEditor
              clip={selectedClip}
              videoUrl={activeVideo?.videoUrl}
              filePath={activeVideo?.filePath}
              backendUrl={apiKeys.backendUrl}
              onBack={() => setView('clips')}
              onExport={handleExportClip}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Export Rendering Modal */}
      {isExportModalOpen && (
        <ExportModal
          isRendering={isRendering}
          exportResult={exportResult}
          error={exportError}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* API Key Settings Modal */}
      <ApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveKeys={handleSaveKeys}
        initialKeys={apiKeys}
      />
    </div>
  );
}
