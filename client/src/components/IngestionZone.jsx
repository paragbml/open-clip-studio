import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, Play, Sparkles, AlertCircle, ArrowRight, Loader2, Zap, Video, Check } from 'lucide-react';

export default function IngestionZone({
  onSelectSample,
  onUploadFile,
  onDownloadUrl,
  samples,
  isLoading,
  scanMode = 'lightning',
  onScanModeChange,
  enableHookScan = true,
  onEnableHookScanChange
}) {
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
    <div style={{ maxWidth: '1040px', margin: '30px auto 48px auto', padding: '0 24px' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          color: '#a5b4fc',
          fontSize: '0.82rem',
          fontWeight: 600,
          marginBottom: '16px'
        }}>
          <Sparkles size={14} color="#818cf8" />
          <span>AI-Powered Video Repurposing • Free & Unlimited</span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '2.8rem',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-1px',
          marginBottom: '14px',
          color: '#ffffff'
        }}>
          Turn Long Videos Into{' '}
          <span style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Viral Vertical Shorts
          </span>
        </h1>

        <p style={{
          fontSize: '1.05rem',
          color: 'var(--text-muted)',
          maxWidth: '640px',
          margin: '0 auto',
          lineHeight: 1.5
        }}>
          Auto-transcribe speech, detect top viral moments, auto-track speakers into 9:16, and generate animated kinetic subtitles.
        </p>
      </div>

      {/* Lowkey Pipeline Controls Strip */}
      <div style={{
        background: 'rgba(17, 22, 39, 0.6)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 20px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Speed Scan Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Analysis:
          </span>
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 'var(--radius-full)',
            padding: '3px',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              type="button"
              onClick={() => onScanModeChange && onScanModeChange('lightning')}
              style={{
                background: scanMode === 'lightning' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                border: scanMode === 'lightning' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid transparent',
                color: scanMode === 'lightning' ? '#fbbf24' : 'var(--text-muted)',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                fontSize: '0.78rem'
              }}
            >
              <Zap size={13} fill={scanMode === 'lightning' ? '#fbbf24' : 'none'} />
              <span>⚡ Lightning (10 min preview)</span>
            </button>

            <button
              type="button"
              onClick={() => onScanModeChange && onScanModeChange('full')}
              style={{
                background: scanMode === 'full' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                border: scanMode === 'full' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                color: scanMode === 'full' ? '#ffffff' : 'var(--text-muted)',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                fontSize: '0.78rem'
              }}
            >
              <Video size={13} />
              <span>Full Video Scan</span>
            </button>
          </div>
        </div>

        {/* Viral Hook Scan Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => onEnableHookScanChange && onEnableHookScanChange(!enableHookScan)}
            style={{
              background: enableHookScan
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(255, 255, 255, 0.03)',
              border: enableHookScan
                ? '1px solid rgba(16, 185, 129, 0.4)'
                : '1px solid var(--border-subtle)',
              color: enableHookScan ? '#34d399' : 'var(--text-muted)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{
              width: '30px',
              height: '16px',
              borderRadius: '8px',
              background: enableHookScan ? '#10b981' : 'rgba(255,255,255,0.15)',
              position: 'relative',
              display: 'inline-block',
              transition: 'background 0.2s ease',
              flexShrink: 0
            }}>
              <span style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: '2px',
                left: enableHookScan ? '16px' : '2px',
                transition: 'left 0.2s ease'
              }} />
            </span>
            <span>🎣 Prioritize Viral Hooks</span>
          </button>
        </div>
      </div>

      {/* Main Ingestion Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '22px', marginBottom: '32px' }}>
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
            border: dragActive ? '2px dashed #6366f1' : '1px dashed var(--border-subtle)',
            backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
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
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)'
          }}>
            <UploadCloud size={26} color="#818cf8" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px', color: '#ffffff' }}>
            Upload Local Video
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Drag &amp; drop MP4, MOV, MKV, or WEBM (up to 4GB)
          </p>
          <span className="btn-secondary" style={{ pointerEvents: 'none', fontSize: '0.82rem' }}>
            Browse Computer
          </span>
        </div>

        {/* URL Box */}
        <div className="glass-card" style={{
          padding: '36px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)'
          }}>
            <LinkIcon size={24} color="#06b6d4" />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px', color: '#ffffff' }}>
            Paste Public Video URL
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Supports YouTube, Twitter/X, Vimeo, and Twitch via built-in downloader
          </p>

          <form onSubmit={handleSubmitUrl} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                flex: 1,
                padding: '11px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(10, 14, 25, 0.85)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.86rem'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--border-focus)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            />
            <button
              type="submit"
              disabled={!url.trim() || isLoading}
              className="btn-primary"
              style={{ padding: '11px 18px' }}
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
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.01em' }}>
                Instant 1-Click Interactive Demos
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Zero-wait • Pre-rendered AI viral highlights
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: samples.length > 1 ? 'repeat(auto-fit, minmax(440px, 1fr))' : '1fr', gap: '16px' }}>
            {samples.map((sample, idx) => (
              <div
                key={sample.id || idx}
                className="glass-card"
                style={{
                  padding: '18px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: idx === 1 ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(245, 158, 11, 0.25)',
                  background: idx === 1
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(6, 182, 212, 0.06) 100%)'
                    : 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(99, 102, 241, 0.06) 100%)',
                  borderRadius: 'var(--radius-md)'
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
                      <span style={{ fontWeight: 700, fontSize: '0.94rem', color: '#ffffff' }}>
                        {sample.title}
                      </span>
                      <span className={idx === 1 ? 'badge-viral' : 'badge-viral'} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
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
                    fontSize: '0.84rem',
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
