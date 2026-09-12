import React from 'react';
import { Flame, Clock, Play, ArrowRight, ArrowLeft, Sparkles, Hash, TrendingUp, BarChart3 } from 'lucide-react';
import { formatTime } from '../utils/formatters';

export default function ClipList({ clips, onSelectClip, onNewVideo, videoMeta }) {
  // Helper to determine virality tier styling
  const getViralityTier = (score) => {
    if (score >= 90) {
      return {
        label: '🔥 Very High Virality',
        glowColor: 'rgba(16, 185, 129, 0.4)',
        borderColor: 'rgba(16, 185, 129, 0.6)',
        bgColor: 'rgba(16, 185, 129, 0.12)',
        textColor: '#34d399',
        barColor: 'linear-gradient(90deg, #10b981, #34d399)'
      };
    }
    if (score >= 80) {
      return {
        label: '⚡ High Virality',
        glowColor: 'rgba(6, 182, 212, 0.4)',
        borderColor: 'rgba(6, 182, 212, 0.6)',
        bgColor: 'rgba(6, 182, 212, 0.12)',
        textColor: '#38bdf8',
        barColor: 'linear-gradient(90deg, #06b6d4, #38bdf8)'
      };
    }
    return {
      label: '✨ Good Potential',
      glowColor: 'rgba(139, 92, 246, 0.4)',
      borderColor: 'rgba(139, 92, 246, 0.6)',
      bgColor: 'rgba(139, 92, 246, 0.12)',
      textColor: '#a78bfa',
      barColor: 'linear-gradient(90deg, #8b5cf6, #a78bfa)'
    };
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '24px auto 40px auto', padding: '0 24px' }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onNewVideo}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.84rem' }}
          >
            <ArrowLeft size={16} />
            <span>Upload Another</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.75rem',
                fontWeight: 800,
                letterSpacing: '-0.5px',
                color: '#ffffff'
              }}>
                Generated Viral Clips ({clips.length})
              </h2>
              <span style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}>
                9:16 VERTICAL
              </span>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Ranked by AI virality score • Auto-reframed to 9:16 with kinetic subtitle presets
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '8px 16px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.82rem',
          color: 'var(--text-muted)'
        }}>
          <Sparkles size={15} color="#f59e0b" />
          <span>Click any clip to enter the <strong>Studio Editor</strong></span>
        </div>
      </div>

      {/* Opus Clip Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '24px'
      }}>
        {clips.map((clip, index) => {
          const tier = getViralityTier(clip.viralityScore);
          
          // Opus-style simulated breakdown metrics
          const hookScore = Math.min(99, Math.round(clip.viralityScore * 1.04));
          const engagementScore = Math.min(98, Math.round(clip.viralityScore * 0.98));
          const pacingScore = Math.min(96, Math.round(clip.viralityScore * 0.94));

          return (
            <div
              key={clip.id || index}
              className="glass-card"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = tier.borderColor;
                e.currentTarget.style.boxShadow = `0 16px 36px -10px rgba(0, 0, 0, 0.75), 0 0 20px -5px ${tier.glowColor}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = 'var(--shadow-card)';
              }}
            >
              <div>
                {/* Top Row: Virality Score Pill & Timestamp */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  {/* Glowing Virality Score Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    background: tier.bgColor,
                    border: `1px solid ${tier.borderColor}`,
                    boxShadow: `0 0 14px ${tier.glowColor}`
                  }}>
                    <Flame size={16} color={tier.textColor} fill={tier.textColor} />
                    <span style={{
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      color: tier.textColor,
                      letterSpacing: '-0.2px'
                    }}>
                      Score {clip.viralityScore}
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      color: 'rgba(255, 255, 255, 0.45)',
                      fontWeight: 500
                    }}>
                      /100
                    </span>
                  </div>

                  {/* Timestamp & Duration */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <Clock size={13} />
                    <span style={{ fontWeight: 500 }}>
                      {formatTime(clip.start)} - {formatTime(clip.end)}
                    </span>
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      color: '#ffffff',
                      fontWeight: 600
                    }}>
                      {clip.duration}s
                    </span>
                  </div>
                </div>

                {/* Hook Tag & Virality Tier Label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: tier.textColor
                  }}>
                    {tier.label}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>•</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    color: '#818cf8'
                  }}>
                    {clip.hookType || 'Hook Highlight'}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.18rem',
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: '14px',
                  color: '#ffffff'
                }}>
                  {clip.title}
                </h3>

                {/* Opus-Style Metric Breakdown Progress Bars */}
                <div style={{
                  background: 'rgba(10, 14, 25, 0.65)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {/* Hook Metric */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Hook Strength</span>
                      <span style={{ fontWeight: 600, color: '#34d399' }}>{hookScore}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${hookScore}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '2px' }} />
                    </div>
                  </div>

                  {/* Engagement Flow */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Engagement Flow</span>
                      <span style={{ fontWeight: 600, color: '#38bdf8' }}>{engagementScore}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${engagementScore}%`, height: '100%', background: 'linear-gradient(90deg, #06b6d4, #38bdf8)', borderRadius: '2px' }} />
                    </div>
                  </div>

                  {/* Narrative Pacing */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Narrative Payoff</span>
                      <span style={{ fontWeight: 600, color: '#a78bfa' }}>{pacingScore}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${pacingScore}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)', borderRadius: '2px' }} />
                    </div>
                  </div>
                </div>

                {/* Virality Explanation (Why this clip works) */}
                <div style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.45,
                  marginBottom: '16px',
                  background: 'rgba(10, 14, 25, 0.5)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: `3px solid ${tier.borderColor}`
                }}>
                  <strong style={{ color: '#ffffff', fontWeight: 600 }}>Why this works: </strong>
                  {clip.viralityReason}
                </div>

                {/* Hashtags */}
                {clip.hashtags && clip.hashtags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                    {clip.hashtags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        style={{
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255, 255, 255, 0.04)'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div style={{
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)'
              }}>
                <button
                  onClick={() => onSelectClip(clip)}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    fontSize: '0.88rem',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} />
                    <span>Open in Studio</span>
                  </span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
