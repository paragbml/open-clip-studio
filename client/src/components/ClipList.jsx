import React from 'react';
import { Flame, Clock, Play, Edit3, Download, ArrowLeft, Share2, Sparkles, Hash } from 'lucide-react';
import { formatTime, getViralityBadge } from '../utils/formatters';

export default function ClipList({ clips, onSelectClip, onNewVideo, videoMeta }) {
  return (
    <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onNewVideo} className="btn-secondary" style={{ padding: '8px 14px' }}>
            <ArrowLeft size={16} />
            <span>New Video</span>
          </button>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.8rem',
              fontWeight: 800,
              letterSpacing: '-0.5px'
            }}>
              Generated Viral Clips ({clips.length})
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Ranked by AI Virality Score • Click any clip to customize captions, styling, and export.
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(99, 102, 241, 0.1)',
          padding: '8px 16px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          fontSize: '0.85rem',
          color: '#a5b4fc'
        }}>
          <Sparkles size={15} />
          <span>All clips ready in 9:16 vertical format</span>
        </div>
      </div>

      {/* Grid of Clips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '22px' }}>
        {clips.map((clip, index) => {
          const badge = getViralityBadge(clip.viralityScore);
          return (
            <div
              key={clip.id || index}
              className="glass-card"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              {/* Top Row: Virality Score & Timing */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    fontWeight: 700,
                    fontSize: '0.82rem'
                  }}>
                    <Flame size={14} fill="#fbbf24" />
                    <span>Score: {clip.viralityScore}/100</span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}>
                    <Clock size={13} />
                    <span>{formatTime(clip.start)} - {formatTime(clip.end)} ({clip.duration}s)</span>
                  </div>
                </div>

                {/* Hook Tag */}
                <div style={{
                  display: 'inline-block',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: '#818cf8',
                  marginBottom: '8px'
                }}>
                  {clip.hookType || 'Curiosity Gap'}
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: '10px',
                  color: '#ffffff'
                }}>
                  {clip.title}
                </h3>

                {/* Virality Explanation */}
                <p style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.45,
                  marginBottom: '14px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid #f59e0b'
                }}>
                  <strong style={{ color: '#fbbf24' }}>Why Viral: </strong>
                  {clip.viralityReason}
                </p>

                {/* Hashtags */}
                {clip.hashtags && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
                    {clip.hashtags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        style={{
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => onSelectClip(clip)}
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px', fontSize: '0.88rem' }}
                >
                  <Edit3 size={15} />
                  <span>Open in Studio</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
