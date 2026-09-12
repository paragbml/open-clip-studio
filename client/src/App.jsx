import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import IngestionZone from './components/IngestionZone';
import ProcessingStatus from './components/ProcessingStatus';
import ClipList from './components/ClipList';
import StudioEditor from './components/StudioEditor';
import ExportModal from './components/ExportModal';
import ApiSettingsModal from './components/ApiSettingsModal';

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
      groqApiKey: localStorage.getItem('openclip_groq_key') || ''
    };
  });

  // Fetch initial samples & system status on mount
  useEffect(() => {
    fetch('/api/samples')
      .then(res => res.json())
      .then(data => setSamples(data.samples || []))
      .catch(err => console.error('Failed to load samples:', err));

    fetch('/api/status')
      .then(res => res.json())
      .then(data => setSystemStatus(data))
      .catch(err => console.error('Failed to load status:', err));
  }, []);

  const handleSaveKeys = (newKeys) => {
    setApiKeys(newKeys);
    localStorage.setItem('openclip_gemini_key', newKeys.geminiApiKey || '');
    localStorage.setItem('openclip_groq_key', newKeys.groqApiKey || '');
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
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Server returned an error (${res.status}): ${text.slice(0, 160)}`);
    }
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Server request failed (${res.status})`);
    }
    return data;
  };

  const [scanMode, setScanMode] = useState('lightning');
  const [enableHookScan, setEnableHookScan] = useState(true);

  // 1. Process Video Pipeline
  const runProcessingPipeline = async (filePath, vttPath = null, videoUrl = null) => {
    setView('processing');
    setProcessingStep(1);
    setProcessingText('Extracting 16kHz audio stream via FFmpeg...');

    try {
      const stepTimer1 = setTimeout(() => {
        setProcessingStep(2);
        const modeLabel = scanMode === 'lightning' ? 'Lightning Mode (first 10 mins)' : 'Full Video Mode';
        setProcessingText(`Transcribing speech with Faster-Whisper (${modeLabel} • 8 CPU cores active)...`);
      }, 800);

      const data = await safeFetchJson('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          vttPath,
          geminiApiKey: apiKeys.geminiApiKey,
          groqApiKey: apiKeys.groqApiKey,
          scanMode,
          enableHookScan
        })
      });

      clearTimeout(stepTimer1);

      setProcessingStep(3);
      setProcessingText('Scoring narrative virality, curiosity gaps & hook potential...');

      await new Promise(r => setTimeout(r, 400));
      setProcessingStep(4);
      setProcessingText('Configuring 9:16 vertical auto-crop & frosted blur parameters...');

      await new Promise(r => setTimeout(r, 400));
      setProcessingStep(5);
      setProcessingText('Finalizing kinetic subtitle presets & studio clips...');

      setTimeout(() => {
        setActiveVideo({
          filePath,
          videoUrl: videoUrl || `/api/stream?path=${encodeURIComponent(filePath)}`,
          meta: data.meta
        });
        setClips(data.clips || []);
        setView('clips');
      }, 500);

    } catch (err) {
      console.error('Pipeline processing failed:', err);
      alert(`Processing error: ${err.message}`);
      setView('ingestion');
    }
  };

  // 2. Upload file handler
  const handleUploadFile = async (file) => {
    setView('processing');
    setProcessingStep(1);
    setProcessingText(`Uploading ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const data = await safeFetchJson('/api/upload', {
        method: 'POST',
        body: formData
      });

      await runProcessingPipeline(data.filePath, null, data.videoUrl);
    } catch (err) {
      alert(`Upload error: ${err.message}`);
      setView('ingestion');
    }
  };

  // 3. Download URL handler
  const handleDownloadUrl = async (url) => {
    setView('processing');
    setProcessingStep(1);
    setProcessingText('Downloading video stream via yt-dlp...');

    try {
      const data = await safeFetchJson('/api/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      await runProcessingPipeline(data.filePath, null, data.videoUrl);
    } catch (err) {
      alert(`Download error: ${err.message}`);
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
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main style={{ flex: 1 }}>
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
            onBack={() => setView('clips')}
            onExport={handleExportClip}
          />
        )}
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
