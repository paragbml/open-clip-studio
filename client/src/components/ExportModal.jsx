import React, { useEffect } from 'react';
import { Download, CheckCircle, Loader2, X, Film, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ExportModal({ isRendering, exportResult, error, onClose }) {
  useEffect(() => {
    if (exportResult && exportResult.success) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [exportResult]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '520px',
        width: '100%',
        padding: '32px',
        position: 'relative',
        textAlign: 'center',
        border: '1px solid var(--border-focus)',
        boxShadow: '0 25px 60px -15px rgba(99, 102, 241, 0.4)'
      }}>
        {/* Close button */}
        {!isRendering && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* Rendering State */}
        {isRendering && (
          <div>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(16, 185, 129, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Loader2 size={36} color="#10b981" className="spin-animate" />
            </div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
              Rendering 1080x1920 Short...
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              FFmpeg is converting video to 9:16 vertical ratio and burning synchronized kinetic subtitles with zero watermarks.
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(244, 63, 94, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#f43f5e'
            }}>
              <X size={32} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px', color: '#f43f5e' }}>
              Export Failed
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {error}
            </p>
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        )}

        {/* Success State */}
        {exportResult && exportResult.success && (
          <div>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#10b981',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
            }}>
              <CheckCircle size={36} />
            </div>

            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
              Your Viral Short is Ready! 🎉
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Rendered in pristine 1080x1920 HD vertical resolution with burned-in dynamic captions.
            </p>

            {/* Video Preview */}
            <div style={{
              maxWidth: '220px',
              height: '340px',
              margin: '0 auto 24px',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.6)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: '#000000'
            }}>
              <video
                src={exportResult.downloadUrl}
                controls
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <a
                href={exportResult.downloadUrl}
                download={exportResult.fileName}
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  textDecoration: 'none',
                  padding: '12px 24px',
                  fontSize: '0.95rem'
                }}
              >
                <Download size={18} />
                <span>Download MP4 Video</span>
              </a>

              <button onClick={onClose} className="btn-secondary" style={{ padding: '12px 20px' }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
