import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, Play, Sparkles, AlertCircle, ArrowRight, Loader2, Zap, Video } from 'lucide-react';

export default function IngestionZone({ onSelectSample, onUploadFile, onDownloadUrl, samples, isLoading, scanMode = 'lightning', onScanModeChange, enableHookScan = true, onEnableHookScanChange }) {
  const [url, setUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  const handleSubmitUrl = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onDownloadUrl(url.trim());
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          color: '#818cf8',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '16px'
        }}>
          <Sparkles size={14} />
          <span>Zero Monthly Fees • No Watermarks • No Limits</span>
        </div>

        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '2.75rem',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-1px',
          marginBottom: '16px'
        }}>
          Repurpose Long Videos Into <span style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Viral Vertical Shorts</span>
        </h2>

        <p style={{
          fontSize: '1.1rem',
          color: 'var(--text-muted)',
          maxWidth: '680px',
          margin: '0 auto'
        }}>
          Automated AI speech transcription, virality scoring, smart 9:16 re-centering, and signature kinetic karaoke subtitles.
        </p>
      </div>

      {/* Speed Mode Selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '28px'
      }}>
        <button
          type="button"
          onClick={() => onScanModeChange && onScanModeChange('lightning')}
          style={{
            background: scanMode === 'lightning' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 88, 12, 0.15))' : 'rgba(255, 255, 255, 0.03)',
            border: scanMode === 'lightning' ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
            color: scanMode === 'lightning' ? '#fbbf24' : 'var(--text-muted)',
            padding: '8px 18px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.84rem'
          }}
        >
          <Zap size={15} fill={scanMode === 'lightning' ? '#fbbf24' : 'none'} />
          <span>⚡ Lightning Mode (First 10 mins • ~45s)</span>
        </button>

        <button
          type="button"
          onClick={() => onScanModeChange && onScanModeChange('full')}
          style={{
            background: scanMode === 'full' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
            border: scanMode === 'full' ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
            color: scanMode === 'full' ? '#ffffff' : 'var(--text-muted)',
            padding: '8px 18px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.84rem'
          }}
        >
          <Video size={15} />
          <span>🎬 Deep Full Video Scan</span>
        </button>
      </div>

      {/* Viral Hook Scan Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '28px'
      }}>
        <button
          type="button"
          onClick={() => onEnableHookScanChange && onEnableHookScanChange(!enableHookScan)}
          style={{
            background: enableHookScan
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15))'
              : 'rgba(255, 255, 255, 0.03)',
            border: enableHookScan
              ? '1px solid #10b981'
              : '1px solid var(--border-subtle)',
            color: enableHookScan ? '#34d399' : 'var(--text-muted)',
            padding: '8px 20px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{
            width: '36px',
            height: '20px',
            borderRadius: '10px',
            background: enableHookScan ? '#10b981' : 'rgba(255,255,255,0.15)',
            position: 'relative',
            display: 'inline-block',
            transition: 'background 0.2s ease',
            flexShrink: 0
          }}>
            <span style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: '2px',
              left: enableHookScan ? '18px' : '2px',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
          </span>
          <span>🎣 Scan for Viral Hooks</span>
        </button>

        <span style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          maxWidth: '280px',
          lineHeight: 1.3
        }}>
          {enableHookScan
            ? 'AI will prioritize clips that open with attention-grabbing hooks (questions, bold statements, stories)'
            : 'Clips selected purely by engagement signals without hook preference'
          }
        </span>
      </div>

      {/* Main Ingestion Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        
        {/* Upload Box */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="glass-card"
          style={{
            padding: '36px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            border: dragActive ? '2px dashed var(--primary)' : '1px dashed var(--border-subtle)',
            backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <UploadCloud size={28} color="#818cf8" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '6px' }}>
            Upload Local Video
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Drag & drop MP4, MOV, MKV, or WEBM (up to 4GB)
          </p>
          <button className="btn-secondary" style={{ pointerEvents: 'none', fontSize: '0.85rem' }}>
            Browse Computer
          </button>
        </div>

        {/* URL Box */}
        <div className="glass-card" style={{
          padding: '36px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'rgba(6, 182, 212, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <LinkIcon size={26} color="#06b6d4" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '6px' }}>
            Paste Public Video Link
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Supports YouTube, Twitter/X, Vimeo, and Twitch via built-in yt-dlp
          </p>

          <form onSubmit={handleSubmitUrl} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(10, 15, 26, 0.8)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.88rem'
              }}
            />
            <button
              type="submit"
              disabled={!url.trim() || isLoading}
              className="btn-primary"
              style={{ padding: '10px 18px' }}
            >
              {isLoading ? <Loader2 size={16} className="spin-animate" /> : <ArrowRight size={16} />}
            </button>
          </form>
        </div>

      </div>

      {/* Interactive Built-in Demos Section */}
      {samples && samples.length > 0 && (
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#fbbf24" />
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
                Instant 1-Click Interactive Demos
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Zero-configuration • High-virality presets
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: samples.length > 1 ? 'repeat(auto-fit, minmax(440px, 1fr))' : '1fr', gap: '14px' }}>
            {samples.map((sample, idx) => (
              <div
                key={sample.id || idx}
                className="glass-panel"
                style={{
                  padding: '18px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: idx === 1 ? '1.5px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(245, 158, 11, 0.25)',
                  background: idx === 1
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)'
                    : 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(99, 102, 241, 0.06) 100%)',
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, marginRight: '16px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: idx === 1 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: idx === 1 ? '#818cf8' : '#fbbf24',
                    flexShrink: 0
                  }}>
                    {idx === 1 ? <Video size={20} /> : <Play size={20} fill="#fbbf24" />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.94rem' }}>
                        {sample.title}
                      </span>
                      <span className={idx === 1 ? 'badge-ai' : 'badge-viral'}>
                        {idx === 1 ? 'Dual-Speaker Debate' : 'Podcast Demo'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {sample.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onSelectSample(sample)}
                  disabled={isLoading}
                  className="btn-primary"
                  style={{
                    background: idx === 1
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: idx === 1
                      ? '0 4px 14px rgba(99, 102, 241, 0.35)'
                      : '0 4px 14px rgba(245, 158, 11, 0.3)',
                    padding: '9px 16px',
                    fontSize: '0.85rem',
                    flexShrink: 0
                  }}
                >
                  {isLoading ? <Loader2 size={15} className="spin-animate" /> : <Play size={15} fill="white" />}
                  <span>{idx === 1 ? 'Try Debate Demo' : 'Try Podcast Demo'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
