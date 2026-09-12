import React from 'react';
import { Loader2, CheckCircle2, Mic, Flame, Video, Type, Sparkles, XCircle, Zap } from 'lucide-react';

export default function ProcessingStatus({ step, progressText, onCancel }) {
  const steps = [
    { id: 1, title: 'Audio Extraction & Demuxing', desc: 'Isolating 16kHz audio stream via FFmpeg', icon: Mic },
    { id: 2, title: 'Speech-to-Text & Word Alignment', desc: 'Faster-Whisper neural model calculating word timestamps', icon: Type },
    { id: 3, title: 'AI Virality & Hook Discovery', desc: 'Analyzing curiosity gaps, contrast words & hook scores', icon: Flame },
    { id: 4, title: 'Smart 9:16 Framing & Auto-Crop', desc: 'Preparing vertical aspect ratio & frosted blur background', icon: Video },
    { id: 5, title: 'Finalizing Kinetic Studio Clips', desc: 'Packaging word-by-word karaoke captions & presets', icon: Sparkles }
  ];

  return (
    <div style={{ maxWidth: '650px', margin: '50px auto', padding: '0 20px' }}>
      <div className="glass-panel" style={{ padding: '36px 32px', textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          border: '1px solid var(--border-glow)'
        }}>
          <Loader2 size={32} color="#818cf8" className="spin-animate" />
        </div>

        <h3 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.6rem',
          fontWeight: 700,
          marginBottom: '8px'
        }}>
          Repurposing Your Video...
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#a5b4fc', marginBottom: '24px', fontWeight: 500 }}>
          {progressText || 'Extracting speech and identifying high-retention moments...'}
        </p>

        {/* Speed Tip Box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          color: '#fbbf24',
          fontSize: '0.8rem',
          marginBottom: '26px',
          textAlign: 'left'
        }}>
          <Zap size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Need instant speed on 1hr+ videos?</strong> Paste a free Groq API key in <em>AI Settings</em> to transcribe any video in ~5 seconds!
          </span>
        </div>

        {/* Step List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left', marginBottom: '24px' }}>
          {steps.map(s => {
            const isDone = step > s.id;
            const isCurrent = step === s.id;
            const Icon = s.icon;

            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: isCurrent ? 'rgba(99, 102, 241, 0.12)' : isDone ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                  border: isCurrent ? '1px solid var(--border-focus)' : '1px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDone ? '#10b981' : isCurrent ? '#6366f1' : 'rgba(255, 255, 255, 0.06)',
                  color: '#ffffff'
                }}>
                  {isDone ? (
                    <CheckCircle2 size={18} />
                  ) : isCurrent ? (
                    <Loader2 size={16} className="spin-animate" />
                  ) : (
                    <Icon size={16} color="var(--text-dim)" />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    color: isCurrent ? '#ffffff' : isDone ? '#e2e8f0' : 'var(--text-dim)'
                  }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: isCurrent ? '#a5b4fc' : 'var(--text-dim)' }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '8px 16px', color: '#f87171' }}
          >
            <XCircle size={15} />
            <span>Cancel Processing</span>
          </button>
        )}
      </div>
    </div>
  );
}
