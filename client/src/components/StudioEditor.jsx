import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, RotateCcw, Download, Sparkles, Sliders, Type, Scissors,
  ArrowLeft, Palette, Check, RefreshCw, Smartphone, Monitor, Square,
  Zap, Volume2, Crosshair, Flame, Wand2, Eye, ShieldAlert, Sparkle,
  Users, Rows2
} from 'lucide-react';
import { drawKineticSubtitles } from '../utils/captionRenderer';
import { formatTimeDetailed, formatTime } from '../utils/formatters';

export default function StudioEditor({
  clip,
  videoUrl,
  filePath,
  onBack,
  onExport
}) {
  const videoRef = useRef(null);
  const bgVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastTriggeredSfxRef = useRef(null);
  const sfxAudiosRef = useRef({});
  const audioCtxRef = useRef(null);
  const audioBuffersRef = useRef({});

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(null);
  const [activeTab, setActiveTab] = useState('framing'); // 'framing' | 'pacing' | 'effects' | 'styles' | 'words'

  // Studio Customization States
  const [style, setStyle] = useState('hormozi'); // 'hormozi' | 'mrbeast' | 'clean' | 'cyberpunk'
  const [highlightColor, setHighlightColor] = useState('#FFE600');
  const [fontSize, setFontSize] = useState(54);
  const [captionPosition, setCaptionPosition] = useState('bottom');
  const [showEmojis, setShowEmojis] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [reframeMode, setReframeMode] = useState('smart_track'); // 'smart_track' | 'split_stacked' | 'crop_center' | 'blur_fill'

  // AI Tracking & Pacing States
  const [trackingData, setTrackingData] = useState({
    avgXPercent: 50.0,
    hasTwoSpeakers: false,
    speakerLeftPercent: 30.0,
    speakerRightPercent: 70.0,
    trajectory: []
  });
  const [speakerLeftPercent, setSpeakerLeftPercent] = useState(30.0);
  const [speakerRightPercent, setSpeakerRightPercent] = useState(70.0);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [enableJumpCut, setEnableJumpCut] = useState(true);
  const [enableSfx, setEnableSfx] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(1.0); // 0 to 1.5
  const [jumpCutData, setJumpCutData] = useState(null);
  const [activeSfxBadge, setActiveSfxBadge] = useState(null);
  const [showHookBanner, setShowHookBanner] = useState(true);
  const [hookBannerText, setHookBannerText] = useState(clip.title ? clip.title.toUpperCase() : 'VIRAL MOMENT 🔥');

  // Visual FX & Clipping Assets States
  const [enableSpotlight, setEnableSpotlight] = useState(false); // Natural lighting by default (not dark!)
  const [spotlightIntensity, setSpotlightIntensity] = useState(0.4);
  const [enablePunchInZoom, setEnablePunchInZoom] = useState(true);
  const [isZoomedPunch, setIsZoomedPunch] = useState(false);
  const [enableBeatFlash, setEnableBeatFlash] = useState(true);
  const [isBeatFlashing, setIsBeatFlashing] = useState(false);
  const [enableReactionBadges, setEnableReactionBadges] = useState(true);
  const [activeReactionBadge, setActiveReactionBadge] = useState(null);

  // Editable words & trim boundaries
  const [words, setWords] = useState(clip.words || []);
  const [trimStart, setTrimStart] = useState(clip.start);
  const [trimEnd, setTrimEnd] = useState(clip.end);

  const clipDuration = Math.max(0.5, parseFloat((trimEnd - trimStart).toFixed(2)));
  const previewVideoUrl = filePath
    ? `/api/clip-preview?filePath=${encodeURIComponent(filePath)}&startTime=${trimStart}&duration=${clipDuration}`
    : videoUrl;

  // Initialize Web Audio Engine and decode sound effect buffers (sourced from MyInstants)
  useEffect(() => {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtxRef.current = new AudioCtxClass();
      }
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }

    const sfxList = ['vine_boom', 'whoosh', 'ding', 'record_scratch', 'bruh', 'airhorn'];
    sfxList.forEach(name => {
      fetch(`/sfx/${name}.wav`)
        .then(r => r.arrayBuffer())
        .then(ab => {
          if (audioCtxRef.current) {
            return audioCtxRef.current.decodeAudioData(ab);
          }
        })
        .then(decoded => {
          if (decoded) audioBuffersRef.current[name] = decoded;
        })
        .catch(e => console.warn(`SFX decode error for ${name}:`, e));

      // HTML5 Audio fallback
      try {
        const a = new Audio(`/sfx/${name}.wav`);
        a.preload = 'auto';
        sfxAudiosRef.current[name] = a;
      } catch (e) {}
    });
  }, []);

  // Web Audio playback function
  const playSfx = (type) => {
    if (!enableSfx) return;

    // Always resume audio context if suspended by browser policy
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    if (audioCtxRef.current && audioBuffersRef.current[type]) {
      try {
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = audioBuffersRef.current[type];
        const gain = audioCtxRef.current.createGain();
        const baseVol = (type === 'vine_boom' || type === 'airhorn') ? 1.35 : (type === 'bruh' ? 1.25 : 1.0);
        gain.gain.value = baseVol * sfxVolume;
        source.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        source.start(0);
      } catch (e) {
        console.warn('Web audio playback issue:', e);
      }
    } else {
      const audio = sfxAudiosRef.current[type];
      if (audio) {
        audio.currentTime = 0;
        audio.volume = Math.min(1.0, ((type === 'vine_boom' || type === 'airhorn') ? 1.0 : 0.85) * sfxVolume);
        audio.play().catch(() => {});
      }
    }

    // Trigger Visual FX on Sound Effect Hits
    if (type === 'vine_boom') {
      if (enablePunchInZoom) {
        setIsZoomedPunch(true);
        setTimeout(() => setIsZoomedPunch(false), 1100);
      }
      if (enableBeatFlash) {
        setIsBeatFlashing(true);
        setTimeout(() => setIsBeatFlashing(false), 500);
      }
      if (enableReactionBadges) {
        setActiveReactionBadge('🔥 W MOMENT');
        setTimeout(() => setActiveReactionBadge(null), 1400);
      }
    } else if (type === 'record_scratch') {
      if (enablePunchInZoom) {
        setIsZoomedPunch(true);
        setTimeout(() => setIsZoomedPunch(false), 800);
      }
      if (enableReactionBadges) {
        setActiveReactionBadge('🚨 SUS MOMENT');
        setTimeout(() => setActiveReactionBadge(null), 1400);
      }
    } else if (type === 'ding') {
      if (enableReactionBadges) {
        setActiveReactionBadge('💡 BIG BRAIN');
        setTimeout(() => setActiveReactionBadge(null), 1200);
      }
    }
  };

  const triggerSfxBadge = (badgeText) => {
    setActiveSfxBadge(badgeText);
    setTimeout(() => setActiveSfxBadge(null), 1200);
  };

  // Fetch AI Tracking and Jump-Cut calculation
  useEffect(() => {
    if (!filePath) return;
    let isMounted = true;
    setIsTrackingLoading(true);

    fetch(`/api/clip-tracking?filePath=${encodeURIComponent(filePath)}&startTime=${trimStart}&duration=${clipDuration}`)
      .then(r => r.json())
      .then(data => {
        if (isMounted) {
          setTrackingData(data);
          if (data.speakerLeftPercent) setSpeakerLeftPercent(data.speakerLeftPercent);
          if (data.speakerRightPercent) setSpeakerRightPercent(data.speakerRightPercent);
          setIsTrackingLoading(false);
          // If video has two distinct speakers and user hasn't chosen yet, auto-suggest split_stacked!
          if (data.hasTwoSpeakers && reframeMode === 'smart_track') {
            setReframeMode('split_stacked');
          }
        }
      })
      .catch(err => {
        console.warn('Tracking fetch error:', err);
        if (isMounted) setIsTrackingLoading(false);
      });

    fetch('/api/jump-cuts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        words,
        startTime: trimStart,
        duration: clipDuration,
        silenceThreshold: 0.5
      })
    })
      .then(r => r.json())
      .then(data => {
        if (isMounted) setJumpCutData(data);
      })
      .catch(err => console.warn('Jump-cuts calculation error:', err));

    return () => { isMounted = false; };
  }, [filePath, trimStart, clipDuration, words]);

  // Interpolate tracking X position
  const getCurrentTrackingX = () => {
    if (!trackingData || !trackingData.trajectory || trackingData.trajectory.length === 0) {
      return trackingData?.avgXPercent || 50.0;
    }
    const t = videoRef.current ? videoRef.current.currentTime : currentTime;
    let closest = trackingData.trajectory[0];
    let minDiff = 9999;
    for (let i = 0; i < trackingData.trajectory.length; i++) {
      const pt = trackingData.trajectory[i];
      const diff = Math.abs(pt.t - t);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }
    return closest.xPercent;
  };

  // Sync canvas size with video/container
  const updateCanvas = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const targetW = 1080;
    const targetH = 1920;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    const absoluteTime = trimStart + (video.currentTime || 0);

    drawKineticSubtitles(ctx, targetW, targetH, absoluteTime, words, {
      style,
      fontSize,
      highlightColor,
      primaryColor: '#FFFFFF',
      position: reframeMode === 'split_stacked' ? 'center' : captionPosition,
      showEmojis,
      hookBannerText,
      showHookBanner
    });

    if (!video.paused && !video.ended) {
      animationFrameRef.current = requestAnimationFrame(updateCanvas);
    }
  };

  // Sync background/secondary video element
  const syncBgVideo = () => {
    const video = videoRef.current;
    const bg = bgVideoRef.current;
    if (!video || !bg) return;
    if (Math.abs(bg.currentTime - video.currentTime) > 0.08) {
      bg.currentTime = video.currentTime;
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (bgVideoRef.current && bgVideoRef.current.paused) {
        bgVideoRef.current.play().catch(() => {});
      }
      animationFrameRef.current = requestAnimationFrame(updateCanvas);
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (bgVideoRef.current && !bgVideoRef.current.paused) {
        bgVideoRef.current.pause();
      }
      cancelAnimationFrame(animationFrameRef.current);
      updateCanvas();
    };

    const handleTimeUpdate = () => {
      const vTime = video.currentTime;
      setCurrentTime(vTime);
      syncBgVideo();

      // 1. Smart Jump-Cut dead-air skipping
      if (enableJumpCut && jumpCutData?.segments && jumpCutData.segments.length > 1) {
        for (let i = 0; i < jumpCutData.segments.length - 1; i++) {
          const segEndRel = jumpCutData.segments[i].end - trimStart;
          const nextSegStartRel = jumpCutData.segments[i + 1].start - trimStart;
          if (vTime >= segEndRel && vTime < nextSegStartRel) {
            video.currentTime = nextSegStartRel;
            if (bgVideoRef.current) bgVideoRef.current.currentTime = nextSegStartRel;
            triggerSfxBadge('⚡ JUMP CUT');
            break;
          }
        }
      }

      // 2. Streamer SFX cue triggers (Vine Boom, Ding, Whoosh, Record Scratch)
      if (enableSfx && jumpCutData?.sfxEvents) {
        jumpCutData.sfxEvents.forEach(evt => {
          if (Math.abs(vTime - evt.time) < 0.15) {
            if (lastTriggeredSfxRef.current !== evt.time) {
              lastTriggeredSfxRef.current = evt.time;
              playSfx(evt.type);
              const badgeLabel = evt.type === 'vine_boom' ? '💥 VINE BOOM'
                : evt.type === 'whoosh' ? '💨 WHOOSH'
                : evt.type === 'ding' ? '🔔 DING'
                : '💿 RECORD SCRATCH';
              triggerSfxBadge(badgeLabel);
            }
          }
        });
      }

      if (vTime >= clipDuration) {
        video.pause();
        if (bgVideoRef.current) bgVideoRef.current.pause();
        video.currentTime = 0;
        if (bgVideoRef.current) bgVideoRef.current.currentTime = 0;
      }
      updateCanvas();
    };

    const handleWaiting = () => setVideoLoading(true);
    const handleCanPlay = () => {
      setVideoLoading(false);
      setVideoError(null);
      updateCanvas();
    };
    const handleError = (e) => {
      console.warn('Video preview error:', e);
      setVideoLoading(false);
      setVideoError('Video preview failed to load. Click to retry.');
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [trimStart, trimEnd, clipDuration, words, style, highlightColor, fontSize, captionPosition, showEmojis, enableJumpCut, enableSfx, jumpCutData, sfxVolume, enablePunchInZoom, enableBeatFlash, enableReactionBadges, reframeMode, hookBannerText, showHookBanner]);

  // Re-draw canvas immediately when styling, banner or words change
  useEffect(() => {
    updateCanvas();
  }, [style, highlightColor, fontSize, captionPosition, showEmojis, words, reframeMode, hookBannerText, showHookBanner]);

  const togglePlay = () => {
    const video = videoRef.current;
    const bg = bgVideoRef.current;
    if (!video) return;

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    if (video.paused) {
      if (video.currentTime >= clipDuration || video.currentTime < 0) {
        video.currentTime = 0;
        if (bg) bg.currentTime = 0;
      }
      video.play().then(() => {
        if (bg) bg.play().catch(() => {});
      }).catch(err => {
        console.warn('Playback error:', err);
      });
    } else {
      video.pause();
      if (bg) bg.pause();
    }
  };

  const handleSeek = (timeInClip) => {
    const video = videoRef.current;
    const bg = bgVideoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(clipDuration, timeInClip));
    video.currentTime = clamped;
    if (bg) bg.currentTime = clamped;
    setCurrentTime(clamped);
    updateCanvas();
  };

  const handleWordEdit = (index, newText) => {
    const updated = [...words];
    updated[index].word = newText;
    setWords(updated);
  };

  const handleWordEmojiChange = (index, newEmoji) => {
    const updated = [...words];
    updated[index].emoji = newEmoji || null;
    setWords(updated);
  };

  const handleExportClick = () => {
    onExport({
      filePath,
      clipId: clip.id,
      startTime: trimStart,
      duration: parseFloat((trimEnd - trimStart).toFixed(2)),
      aspectRatio,
      reframeMode,
      targetXPercent: trackingData?.avgXPercent || 50.0,
      speakerLeftPercent: speakerLeftPercent || trackingData?.speakerLeftPercent || 28.0,
      speakerRightPercent: speakerRightPercent || trackingData?.speakerRightPercent || 68.0,
      trajectory: trackingData?.trajectory || [],
      sfxEvents: enableSfx && jumpCutData ? jumpCutData.sfxEvents : [],
      enableSpotlight,
      style,
      fontSize,
      words,
      hookBannerText: showHookBanner ? hookBannerText : null,
      showHookBanner
    });
  };

  const colorPalette = [
    { name: 'Neon Yellow', hex: '#FFE600' },
    { name: 'Electric Green', hex: '#00FF66' },
    { name: 'Cyan Glow', hex: '#06B6D4' },
    { name: 'Hot Pink', hex: '#EC4899' },
    { name: 'Pure White', hex: '#FFFFFF' }
  ];

  return (
    <div style={{ maxWidth: '1280px', margin: '10px auto 30px auto', padding: '0 24px' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={onBack} className="btn-secondary" style={{ padding: '8px 14px' }}>
            <ArrowLeft size={16} />
            <span>Back to Clips</span>
          </button>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#ffffff'
            }}>
              {clip.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Virality Score: {clip.viralityScore}/100</span>
              <span>•</span>
              <span>Trim: {formatTime(trimStart)} - {formatTime(trimEnd)} ({(trimEnd - trimStart).toFixed(1)}s)</span>
              {trackingData.hasTwoSpeakers && (
                <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  👥 2 Speakers Detected
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleExportClick}
          className="btn-primary"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
          }}
        >
          <Download size={16} />
          <span>Export 1080x1920 Short</span>
        </button>
      </div>

      {/* Main Studio Workspace */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '420px 1fr',
        gap: '28px',
        alignItems: 'start'
      }}>
        {/* Left Column: Phone Mockup Video Player */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Aspect Ratio Selector */}
          <div style={{
            display: 'flex',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '14px'
          }}>
            <button
              onClick={() => setAspectRatio('9:16')}
              style={{
                background: aspectRatio === '9:16' ? 'var(--primary)' : 'transparent',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Smartphone size={14} />
              <span>9:16 Shorts</span>
            </button>
            <button
              onClick={() => setAspectRatio('1:1')}
              style={{
                background: aspectRatio === '1:1' ? 'var(--primary)' : 'transparent',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Square size={14} />
              <span>1:1 Square</span>
            </button>
            <button
              onClick={() => setAspectRatio('16:9')}
              style={{
                background: aspectRatio === '16:9' ? 'var(--primary)' : 'transparent',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Monitor size={14} />
              <span>16:9 Landscape</span>
            </button>
          </div>

          {/* Smartphone Mockup Frame */}
          <div style={{
            width: aspectRatio === '9:16' ? '330px' : aspectRatio === '1:1' ? '380px' : '420px',
            height: aspectRatio === '9:16' ? '586px' : aspectRatio === '1:1' ? '380px' : '236px',
            borderRadius: aspectRatio === '9:16' ? '36px' : '16px',
            padding: aspectRatio === '9:16' ? '12px' : '0',
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            boxShadow: isBeatFlashing
              ? '0 0 50px rgba(239, 68, 68, 0.9), 0 25px 50px -12px rgba(0, 0, 0, 0.8)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transition: 'box-shadow 0.15s ease'
          }}>
            {/* Screen Area */}
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: aspectRatio === '9:16' ? '26px' : '16px',
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: '#000000',
              boxShadow: isBeatFlashing
                ? 'inset 0 0 55px rgba(239, 68, 68, 0.95), inset 0 0 100px rgba(245, 158, 11, 0.5)'
                : 'none',
              transition: 'box-shadow 0.15s ease-out'
            }}>
              {/* LAYOUT OPTION A: Opus Clip Split-Screen Dual Speaker (Stacked Top & Bottom) */}
              {aspectRatio === '9:16' && reframeMode === 'split_stacked' ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Top Half: Speaker 1 */}
                  <div style={{ position: 'relative', width: '100%', height: '50%', overflow: 'hidden', backgroundColor: '#050811' }}>
                    <video
                      ref={videoRef}
                      src={previewVideoUrl}
                      playsInline
                      preload="auto"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: `${speakerLeftPercent}% center`,
                        cursor: 'pointer'
                      }}
                      onClick={togglePlay}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      color: '#a5b4fc',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Users size={11} />
                      <span>SPEAKER 1</span>
                    </div>
                  </div>

                  {/* Center Split Divider Bar */}
                  <div style={{
                    height: '4px',
                    background: 'linear-gradient(90deg, #6366f1 0%, #06b6d4 100%)',
                    boxShadow: '0 0 12px rgba(99, 102, 241, 0.9)',
                    zIndex: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    <span style={{
                      position: 'absolute',
                      background: '#090d16',
                      color: '#818cf8',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      letterSpacing: '0.04em'
                    }}>
                      SPLIT-SCREEN
                    </span>
                  </div>

                  {/* Bottom Half: Speaker 2 */}
                  <div style={{ position: 'relative', width: '100%', height: '50%', overflow: 'hidden', backgroundColor: '#050811' }}>
                    <video
                      ref={bgVideoRef}
                      src={previewVideoUrl}
                      playsInline
                      preload="auto"
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: `${speakerRightPercent}% center`,
                        cursor: 'pointer'
                      }}
                      onClick={togglePlay}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '10px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(6, 182, 212, 0.4)',
                      color: '#06b6d4',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Users size={11} />
                      <span>SPEAKER 2</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Blurred Background Layer for 9:16 blur_fill mode */}
                  {aspectRatio === '9:16' && reframeMode === 'blur_fill' && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      overflow: 'hidden',
                      filter: 'blur(22px) brightness(0.65)',
                      transform: 'scale(1.25)',
                      pointerEvents: 'none'
                    }}>
                      <video
                        ref={bgVideoRef}
                        src={previewVideoUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        playsInline
                        preload="auto"
                      />
                    </div>
                  )}

                  {/* Main Full-Bleed Video Element */}
                  <video
                    ref={videoRef}
                    src={previewVideoUrl}
                    playsInline
                    preload="auto"
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      objectFit: (aspectRatio === '9:16' && (reframeMode === 'smart_track' || reframeMode === 'crop_center')) ? 'cover' : 'contain',
                      objectPosition: (aspectRatio === '9:16' && reframeMode === 'smart_track') ? `${getCurrentTrackingX()}% center` : 'center center',
                      transform: isZoomedPunch ? 'scale(1.16) translate(1px, -2px)' : 'scale(1.0)',
                      transition: isZoomedPunch ? 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'transform 0.4s ease-out, object-position 0.25s ease-out',
                      zIndex: 2,
                      backgroundColor: '#000000',
                      cursor: 'pointer'
                    }}
                    onClick={togglePlay}
                  />

                  {/* Optional Subtle Spotlight (Disabled by default so video is bright & crisp) */}
                  {aspectRatio === '9:16' && enableSpotlight && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      zIndex: 3,
                      background: `radial-gradient(circle at ${getCurrentTrackingX()}% 42%, rgba(255, 255, 255, 0.05) 0%, transparent 45%, rgba(0, 0, 0, ${spotlightIntensity * 0.4}) 75%, rgba(0, 0, 0, ${spotlightIntensity * 0.6}) 100%)`,
                      transition: 'background 0.25s ease-out'
                    }} />
                  )}
                </>
              )}

              {/* Synchronous 60 FPS Kinetic Subtitle Canvas Overlay */}
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 6
                }}
              />

              {/* Dynamic Animated SFX Badge Popup */}
              {activeSfxBadge && (
                <div className="sfx-badge-animate" style={{
                  position: 'absolute',
                  top: '18px',
                  left: '50%',
                  zIndex: 10,
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  padding: '7px 16px',
                  borderRadius: '30px',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  letterSpacing: '0.04em',
                  boxShadow: '0 0 25px rgba(239, 68, 68, 0.85), 0 4px 12px rgba(0,0,0,0.5)',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                  pointerEvents: 'none',
                  textTransform: 'uppercase'
                }}>
                  {activeSfxBadge}
                </div>
              )}

              {/* Streamer Reaction Badge Overlay */}
              {activeReactionBadge && (
                <div className="sfx-badge-animate" style={{
                  position: 'absolute',
                  top: '64px',
                  right: '16px',
                  zIndex: 10,
                  background: activeReactionBadge.includes('W')
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : activeReactionBadge.includes('L')
                    ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  border: '2px solid rgba(255,255,255,0.4)',
                  pointerEvents: 'none'
                }}>
                  {activeReactionBadge}
                </div>
              )}

              {/* Clean AI Tracking Indicator (Minimal pill, no dashed boxes covering face) */}
              {aspectRatio === '9:16' && (
                <div style={{
                  position: 'absolute',
                  top: '14px',
                  left: '14px',
                  zIndex: 8,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  color: '#a5b4fc',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  pointerEvents: 'none'
                }}>
                  <Crosshair size={12} color="#818cf8" />
                  <span>
                    {reframeMode === 'split_stacked'
                      ? `Split 2-Speaker`
                      : `Tracked: ${getCurrentTrackingX().toFixed(0)}%`}
                  </span>
                </div>
              )}

              {/* Dead-Air Cut Pill */}
              {enableJumpCut && jumpCutData?.timeSaved > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  zIndex: 8,
                  background: 'rgba(16, 185, 129, 0.85)',
                  color: '#ffffff',
                  padding: '4px 8px',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  pointerEvents: 'none',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                }}>
                  <Zap size={11} />
                  <span>-{jumpCutData.timeSaved}s cut</span>
                </div>
              )}

              {/* Buffering / Loading Indicator */}
              {videoLoading && !videoError && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.45)',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    border: '3px solid rgba(255, 255, 255, 0.2)',
                    borderTopColor: 'var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  <span style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: 600 }}>Loading Studio Preview...</span>
                </div>
              )}

              {/* Video Error Banner */}
              {videoError && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 7,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(15, 23, 42, 0.94)',
                  padding: '20px',
                  textAlign: 'center',
                  gap: '12px'
                }}>
                  <p style={{ fontSize: '0.85rem', color: '#f87171', fontWeight: 600 }}>{videoError}</p>
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.load();
                        setVideoLoading(true);
                        setVideoError(null);
                      }
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  >
                    <RefreshCw size={14} />
                    <span>Retry Video</span>
                  </button>
                </div>
              )}

              {/* Play Overlay Button if paused */}
              {!isPlaying && !videoLoading && (
                <div
                  onClick={togglePlay}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.25)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.92)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 25px rgba(99, 102, 241, 0.65)',
                    transition: 'transform 0.15s ease'
                  }}>
                    <Play size={26} fill="#ffffff" color="#ffffff" style={{ marginLeft: '4px' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scrubber & Player Controls */}
          <div style={{
            width: '100%',
            maxWidth: '420px',
            marginTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={togglePlay}
                className="btn-secondary"
                style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center' }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} fill="white" />}
              </button>

              <input
                type="range"
                min={0}
                max={clipDuration}
                step="0.05"
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />

              <button
                onClick={() => handleSeek(0)}
                className="btn-secondary"
                style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center' }}
                title="Restart Clip"
              >
                <RotateCcw size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>{formatTimeDetailed(currentTime)}</span>
              <span>{formatTimeDetailed(clipDuration)}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Customization Panel */}
        <div className="glass-panel" style={{ padding: '24px', minHeight: '580px' }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '14px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setActiveTab('framing')}
              style={{
                background: activeTab === 'framing' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                color: activeTab === 'framing' ? '#818cf8' : 'var(--text-muted)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Rows2 size={15} color={activeTab === 'framing' ? '#06b6d4' : 'currentColor'} />
              <span>🎯 Framing &amp; Split-Screen</span>
            </button>

            <button
              onClick={() => setActiveTab('pacing')}
              style={{
                background: activeTab === 'pacing' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                color: activeTab === 'pacing' ? '#818cf8' : 'var(--text-muted)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={15} color={activeTab === 'pacing' ? '#f59e0b' : 'currentColor'} />
              <span>⚡ Pacing &amp; SFX</span>
            </button>

            <button
              onClick={() => setActiveTab('effects')}
              style={{
                background: activeTab === 'effects' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                color: activeTab === 'effects' ? '#818cf8' : 'var(--text-muted)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Wand2 size={15} color={activeTab === 'effects' ? '#ec4899' : 'currentColor'} />
              <span>✨ Visual FX</span>
            </button>

            <button
              onClick={() => setActiveTab('styles')}
              style={{
                background: activeTab === 'styles' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                color: activeTab === 'styles' ? '#818cf8' : 'var(--text-muted)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Palette size={15} />
              <span>Captions</span>
            </button>

            <button
              onClick={() => setActiveTab('words')}
              style={{
                background: activeTab === 'words' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                color: activeTab === 'words' ? '#818cf8' : 'var(--text-muted)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Type size={15} />
              <span>Words ({words.length})</span>
            </button>
          </div>

          {/* Tab 1: Framing & Split-Screen (Opus Clip Feature) */}
          {activeTab === 'framing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
                  AI 9:16 Video Reframing &amp; Multi-Speaker Layout
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Option 1: Opus Clip Dual-Speaker Split-Screen */}
                  <div
                    onClick={() => setReframeMode('split_stacked')}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      background: reframeMode === 'split_stacked' ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                      border: reframeMode === 'split_stacked' ? '1.5px solid #818cf8' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      boxShadow: reframeMode === 'split_stacked' ? '0 0 20px rgba(99, 102, 241, 0.3)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={17} color="#818cf8" />
                        <span style={{ fontWeight: 800, fontSize: '0.94rem', color: '#ffffff' }}>
                          👥 Dual-Speaker Split-Screen (Opus Clip Stacked)
                        </span>
                      </div>
                      {reframeMode === 'split_stacked' && <Check size={16} color="#818cf8" />}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                      Splits the 9:16 phone vertically into two stacked frames: Speaker 1 on top, Speaker 2 on bottom. Perfect for interviews, conversations, and podcasts!
                    </div>
                    {reframeMode === 'split_stacked' ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          marginTop: '12px',
                          padding: '12px',
                          background: 'rgba(15, 23, 42, 0.85)',
                          border: '1px solid rgba(129, 140, 248, 0.35)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e0e7ff' }}>
                            🎯 Dual Speaker Framing Adjuster
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#818cf8', fontWeight: 600 }}>
                            Live Preview Enabled
                          </span>
                        </div>

                        {/* Top Speaker Slider */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px', color: '#c7d2fe' }}>
                            <span>Top Speaker (Host / Left):</span>
                            <strong style={{ color: '#38bdf8' }}>{Math.round(speakerLeftPercent)}%</strong>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="90"
                            step="1"
                            value={speakerLeftPercent}
                            onChange={(e) => setSpeakerLeftPercent(parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#38bdf8',
                              cursor: 'pointer'
                            }}
                          />
                        </div>

                        {/* Bottom Speaker Slider */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px', color: '#c7d2fe' }}>
                            <span>Bottom Speaker (Guest / Right):</span>
                            <strong style={{ color: '#818cf8' }}>{Math.round(speakerRightPercent)}%</strong>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="90"
                            step="1"
                            value={speakerRightPercent}
                            onChange={(e) => setSpeakerRightPercent(parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#818cf8',
                              cursor: 'pointer'
                            }}
                          />
                        </div>

                        {/* Framing Presets */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                            QUICK PRESETS:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => { setSpeakerLeftPercent(30.0); setSpeakerRightPercent(70.0); }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                borderRadius: '4px',
                                background: (Math.round(speakerLeftPercent) === 30 && Math.round(speakerRightPercent) === 70) ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                                color: '#ffffff',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              Standard (30% / 70%)
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSpeakerLeftPercent(22.0); setSpeakerRightPercent(78.0); }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                borderRadius: '4px',
                                background: (Math.round(speakerLeftPercent) === 22 && Math.round(speakerRightPercent) === 78) ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                                color: '#ffffff',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              Wide Studio (22% / 78%)
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSpeakerLeftPercent(38.0); setSpeakerRightPercent(62.0); }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                borderRadius: '4px',
                                background: (Math.round(speakerLeftPercent) === 38 && Math.round(speakerRightPercent) === 62) ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                                color: '#ffffff',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              Close Dialogue (38% / 62%)
                            </button>
                            {trackingData?.speakerLeftPercent && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSpeakerLeftPercent(trackingData.speakerLeftPercent);
                                  setSpeakerRightPercent(trackingData.speakerRightPercent);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.7rem',
                                  borderRadius: '4px',
                                  background: (Math.round(speakerLeftPercent) === Math.round(trackingData.speakerLeftPercent) && Math.round(speakerRightPercent) === Math.round(trackingData.speakerRightPercent)) ? '#059669' : 'rgba(16, 185, 129, 0.15)',
                                  color: '#34d399',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                AI Detect ({Math.round(trackingData.speakerLeftPercent)}% / {Math.round(trackingData.speakerRightPercent)}%)
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.35)',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: '#a5b4fc'
                      }}>
                        <span>Top Speaker: <strong>{Math.round(speakerLeftPercent)}%</strong></span>
                        <span>Bottom Speaker: <strong>{Math.round(speakerRightPercent)}%</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Option 2: Smart Single Speaker (Auto-Pan) */}
                  <div
                    onClick={() => setReframeMode('smart_track')}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      background: reframeMode === 'smart_track' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                      border: reframeMode === 'smart_track' ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Crosshair size={16} color="#06b6d4" />
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff' }}>
                          🎯 Smart AI Single Speaker (Auto-Pan)
                        </span>
                      </div>
                      {reframeMode === 'smart_track' && <Check size={16} color="#818cf8" />}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                      Full-bleed vertical crop without letterboxing. Auto-pans smoothly to follow the primary speaker across the frame.
                    </div>
                  </div>

                  {/* Option 3: Center Speaker Crop */}
                  <div
                    onClick={() => setReframeMode('crop_center')}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      background: reframeMode === 'crop_center' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                      border: reframeMode === 'crop_center' ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>
                        📏 Center Fixed Crop (50% Middle)
                      </span>
                      {reframeMode === 'crop_center' && <Check size={16} color="#818cf8" />}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                      Fixed vertical crop locked strictly to the exact center 50% of the frame.
                    </div>
                  </div>

                  {/* Option 4: Frosted Blur Fill */}
                  <div
                    onClick={() => setReframeMode('blur_fill')}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      background: reframeMode === 'blur_fill' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                      border: reframeMode === 'blur_fill' ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>
                        ❄️ Frosted Blur Fill
                      </span>
                      {reframeMode === 'blur_fill' && <Check size={16} color="#818cf8" />}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                      Preserves 100% widescreen view with ambient blurred bars above and below.
                    </div>
                  </div>
                </div>
              </div>

              {/* Clip Start/End Trimmers */}
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
                  Fine-tune Clip Boundaries
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Clip Start (sec)</div>
                    <input
                      type="number"
                      step="0.1"
                      value={trimStart}
                      onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: '#ffffff',
                        fontWeight: 600
                      }}
                    />
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Clip End (sec)</div>
                    <input
                      type="number"
                      step="0.1"
                      value={trimEnd}
                      onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: '#ffffff',
                        fontWeight: 600
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Pacing & Streamer SFX */}
          {activeTab === 'pacing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Jump-Cut / Dead-Air Silence Removal */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f59e0b'
                    }}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                        Smart Jump-Cuts &amp; Silence Removal
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Trims dead-air pauses &gt;0.5s for rapid, punchy streamer pacing
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableJumpCut}
                    onChange={(e) => setEnableJumpCut(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>

                {jumpCutData && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '10px',
                    marginTop: '14px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Dead Air Trimmed</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                        {jumpCutData.timeSaved}s
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Jump-Cuts Made</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>
                        {jumpCutData.segments ? jumpCutData.segments.length - 1 : 0} cuts
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Punchy Duration</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#818cf8' }}>
                        {jumpCutData.condensedDuration || jumpCutData.newDuration}s
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Meme & Streamer Sound Effects with Web Audio Engine */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ef4444'
                    }}>
                      <Flame size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                        Streamer Meme Sound Effects (Web Audio Active)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Plays Vine Booms on punchlines &amp; Whooshes on cuts (baked into export)
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableSfx}
                    onChange={(e) => setEnableSfx(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>

                {/* SFX Volume Booster */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <Volume2 size={15} color="#818cf8" />
                    <span>SFX Master Gain</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      min="0.2"
                      max="1.5"
                      step="0.1"
                      value={sfxVolume}
                      onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                      style={{ width: '100px', accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', minWidth: '35px' }}>
                      {Math.round(sfxVolume * 100)}%
                    </span>
                  </div>
                </div>

                {/* Soundboard Test Buttons (Directly sourced from MyInstants) */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Streamer Soundboard (Authentic MyInstants SFX):</span>
                    <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>6 Active Sounds</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <button
                      onClick={() => { playSfx('vine_boom'); triggerSfxBadge('💥 VINE BOOM'); }}
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '8px 6px', justifyContent: 'center' }}
                    >
                      <span>💥 Vine Boom</span>
                    </button>
                    <button
                      onClick={() => { playSfx('whoosh'); triggerSfxBadge('💨 WHOOSH'); }}
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '8px 6px', justifyContent: 'center' }}
                    >
                      <span>💨 Whoosh</span>
                    </button>
                    <button
                      onClick={() => { playSfx('ding'); triggerSfxBadge('🔔 DING'); }}
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '8px 6px', justifyContent: 'center' }}
                    >
                      <span>🔔 Ding</span>
                    </button>
                    <button
                      onClick={() => { playSfx('record_scratch'); triggerSfxBadge('💿 SCRATCH'); }}
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '8px 6px', justifyContent: 'center' }}
                    >
                      <span>💿 Scratch</span>
                    </button>
                    <button
                      onClick={() => { playSfx('bruh'); triggerSfxBadge('🗿 BRUH'); }}
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '8px 6px', justifyContent: 'center' }}
                    >
                      <span>🗿 Bruh</span>
                    </button>
                    <button
                      onClick={() => { playSfx('airhorn'); triggerSfxBadge('🎺 AIRHORN'); }}
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '8px 6px', justifyContent: 'center' }}
                    >
                      <span>🎺 Airhorn</span>
                    </button>
                  </div>
                </div>

                {/* Scheduled Cues Timeline */}
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Scheduled SFX Timeline Events ({jumpCutData?.sfxEvents?.length || 0}):
                  </div>
                  <div style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    {jumpCutData?.sfxEvents?.map((evt, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: 'rgba(0,0,0,0.25)',
                          borderRadius: '6px',
                          fontSize: '0.78rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: evt.type === 'vine_boom' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                            color: evt.type === 'vine_boom' ? '#f87171' : '#818cf8',
                            fontWeight: 700
                          }}>
                            {evt.type === 'vine_boom' ? '💥 Vine Boom' : evt.type === 'whoosh' ? '💨 Whoosh' : evt.type === 'ding' ? '🔔 Ding' : '💿 Scratch'}
                          </span>
                          <span style={{ color: '#ffffff', fontWeight: 600 }}>{evt.trigger || evt.label}</span>
                        </div>
                        <button
                          onClick={() => handleSeek(evt.time)}
                          style={{
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            fontSize: '0.74rem',
                            textDecoration: 'underline'
                          }}
                        >
                          {evt.time.toFixed(1)}s
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Visual FX & Clipping Assets */}
          {activeTab === 'effects' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Impact Punch-In Zoom & Camera Shake */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#818cf8'
                    }}>
                      <Flame size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                        💥 Impact Punch-In Zoom &amp; Shake
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Zooms 1.15x with impact camera shake when punchlines or Vine Booms hit
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enablePunchInZoom}
                    onChange={(e) => setEnablePunchInZoom(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Dramatic Beat Lighting Flash */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f59e0b'
                    }}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                        ⚡ Dramatic Beat Lighting Flash
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Flashes screen borders with red/gold pulse on intense bass hits
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableBeatFlash}
                    onChange={(e) => setEnableBeatFlash(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Streamer Reaction Badges */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981'
                    }}>
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                        🏷️ Streamer Reaction Badges (W / L / SUS)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Pops floating reaction stickers (🔥 W, 💀 L, 🚨 SUS) on key moments
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableReactionBadges}
                    onChange={(e) => setEnableReactionBadges(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Optional Subtle Spotlight Lighting (Off by default for clean, natural brightness) */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'rgba(236, 72, 153, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ec4899'
                    }}>
                      <Wand2 size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                        🎯 Subtle Spotlight Lighting (Optional)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Adds subtle radiant lighting around speaker (kept off for maximum natural brightness)
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableSpotlight}
                    onChange={(e) => setEnableSpotlight(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Subtitle Styles */}
          {activeTab === 'styles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Presets */}
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
                  Caption Style Preset
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { id: 'hormozi', name: 'Alex Hormozi', desc: 'Bold uppercase, neon active word pop' },
                    { id: 'mrbeast', name: 'MrBeast Style', desc: 'Impact font, high-contrast dark stroke' },
                    { id: 'clean', name: 'Clean Modern', desc: 'Minimalist Inter with translucent pill' },
                    { id: 'cyberpunk', name: 'Cyber Neon', desc: 'Futuristic cyan glow and drop shadow' }
                  ].map(p => (
                    <div
                      key={p.id}
                      onClick={() => setStyle(p.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: style === p.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: style === p.id ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>{p.name}</span>
                        {style === p.id && <Check size={14} color="#818cf8" />}
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>{p.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Highlight Color */}
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
                  Active Spoken Word Highlight
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {colorPalette.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => setHighlightColor(c.hex)}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: c.hex,
                        border: highlightColor === c.hex ? '3px solid #ffffff' : '1px solid rgba(0,0,0,0.5)',
                        boxShadow: highlightColor === c.hex ? `0 0 14px ${c.hex}` : 'none',
                        cursor: 'pointer'
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Font Size Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.84rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Font Size</span>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="36"
                  max="76"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              {/* Caption Position */}
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
                  Vertical Caption Placement
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {['bottom', 'center', 'top'].map(pos => (
                    <button
                      key={pos}
                      onClick={() => setCaptionPosition(pos)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: captionPosition === pos ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: captionPosition === pos ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                        color: captionPosition === pos ? '#ffffff' : 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        textTransform: 'capitalize'
                      }}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Emojis Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Auto Animated Emojis</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>Pops relevant emojis (🔥, 💸, 🚀, 🤖) above spoken keywords</div>
                </div>
                <input
                  type="checkbox"
                  checked={showEmojis}
                  onChange={(e) => setShowEmojis(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Viral Top Hook Banner (Opus Signature Header) */}
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🏷️ Top Hook Headline Banner</span>
                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', background: 'rgba(99,102,241,0.25)', color: '#a5b4fc', borderRadius: '4px', fontWeight: 700 }}>OPUS CLIPS</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>Scroll-stopping header card pinned at the top of the 9:16 vertical short</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showHookBanner}
                    onChange={(e) => setShowHookBanner(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>
                {showHookBanner && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={hookBannerText}
                      onChange={(e) => setHookBannerText(e.target.value)}
                      placeholder="Enter viral headline banner..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#ffffff',
                        fontSize: '0.84rem',
                        fontWeight: 700
                      }}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0 10px' }}
                      onClick={() => setHookBannerText((clip.title ? clip.title.toUpperCase() : 'VIRAL MOMENT') + ' 🔥')}
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 5: Words & Emojis Editor */}
          {activeTab === 'words' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Click any word to seek the player. Edit text or add emojis to boost viewer engagement.
              </p>
              <div style={{
                maxHeight: '440px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '6px'
              }}>
                {words.map((w, idx) => {
                  const currentAbs = trimStart + currentTime;
                  const isActive = currentAbs >= w.start && currentAbs <= w.end;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                        border: isActive ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Timestamp button */}
                      <button
                        onClick={() => handleSeek(Math.max(0, Math.min(clipDuration, w.start - trimStart)))}
                        style={{
                          fontSize: '0.74rem',
                          color: '#818cf8',
                          background: 'rgba(99, 102, 241, 0.1)',
                          padding: '3px 7px',
                          borderRadius: '4px',
                          fontWeight: 600
                        }}
                      >
                        {formatTime(w.start)}
                      </button>

                      {/* Word Input */}
                      <input
                        type="text"
                        value={w.word}
                        onChange={(e) => handleWordEdit(idx, e.target.value)}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '0.9rem'
                        }}
                      />

                      {/* Emoji Input */}
                      <input
                        type="text"
                        placeholder="Emoji"
                        value={w.emoji || ''}
                        onChange={(e) => handleWordEmojiChange(idx, e.target.value)}
                        style={{
                          width: '44px',
                          textAlign: 'center',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '3px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
