import React from 'react';
import { Film, Sliders, Sparkles, ChevronRight, Plus, CheckCircle2, Activity } from 'lucide-react';

export default function Header({ onOpenSettings, status, view = 'ingestion', onNavigate, onNewVideo }) {
  return (
    <header style={{
      margin: '14px 24px 8px 24px',
      padding: '12px 24px',
      borderRadius: 'var(--radius-md)',
      background: 'rgba(13, 17, 30, 0.82)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      zIndex: 30,
      boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.5)'
    }}>
      {/* Brand & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div
          onClick={() => onNavigate && onNavigate('ingestion')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: onNavigate ? 'pointer' : 'default',
            userSelect: 'none'
          }}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 18px rgba(99, 102, 241, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <Film size={20} color="#ffffff" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                fontWeight: 800,
                letterSpacing: '-0.3px',
                color: '#ffffff'
              }}>
                OpenClip
              </span>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                fontWeight: 400,
                color: '#818cf8'
              }}>
                Studio
              </span>
              <span className="badge-free" style={{ marginLeft: '4px' }}>FREE & UNLIMITED</span>
            </div>
          </div>
        </div>

        {/* Lowkey Breadcrumbs */}
        {view !== 'ingestion' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: '16px',
            borderLeft: '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <button
              onClick={() => onNavigate ? onNavigate('ingestion') : onNewVideo && onNewVideo()}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                padding: 0,
                fontSize: 'inherit'
              }}
              onMouseEnter={(e) => e.target.style.color = '#ffffff'}
              onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
            >
              Workspace
            </button>
            <ChevronRight size={13} color="var(--text-dim)" />
            {view === 'clips' ? (
              <span style={{ color: '#ffffff', fontWeight: 600 }}>Viral Clips</span>
            ) : (
              <>
                <button
                  onClick={() => onNavigate && onNavigate('clips')}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    padding: 0,
                    fontSize: 'inherit'
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                  onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                >
                  Viral Clips
                </button>
                <ChevronRight size={13} color="var(--text-dim)" />
                <span style={{ color: '#ffffff', fontWeight: 600 }}>Clip Studio</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Realtime Engine Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.78rem'
        }}>
          <span
            className="pulse-dot"
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981',
              display: 'inline-block'
            }}
          />
          <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
            {status?.ffmpegReady ? 'Local AI Engine' : 'AI Virality Engine Active'}
          </span>
        </div>

        {/* Quick New Video Button when inside clips or studio */}
        {view !== 'ingestion' && onNewVideo && (
          <button
            onClick={onNewVideo}
            className="btn-secondary"
            style={{
              padding: '7px 13px',
              fontSize: '0.8rem',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.05)'
            }}
            title="Repurpose a new video"
          >
            <Plus size={14} />
            <span>New Video</span>
          </button>
        )}

        {/* AI Settings Trigger */}
        <button
          onClick={onOpenSettings}
          className="btn-secondary"
          style={{
            padding: '7px 13px',
            fontSize: '0.8rem',
            gap: '6px'
          }}
          title="Configure API Keys or Settings"
        >
          <Sliders size={14} />
          <span>AI Settings</span>
        </button>
      </div>
    </header>
  );
}
