/**
 * Smart Jump-Cut & Streamer Dynamic Pacing Engine
 * Detects dead air (>0.5s gaps), generates jump-cut manifests, and maps streamer SFX cues.
 */

/**
 * Calculates jump-cut speech segments from word-level timestamps, eliminating dead air.
 * @param {Array} words - Array of word objects { word, start, end }
 * @param {number} clipStart - Starting second of the clip in original video
 * @param {number} clipEnd - Ending second of the clip in original video
 * @param {number} silenceThreshold - Minimum pause duration in seconds to trigger a jump-cut (default 0.5s)
 */
function calculateJumpCuts(words = [], clipStart = 0, clipEnd = 30, silenceThreshold = 0.5) {
  const originalDuration = Math.max(0.5, clipEnd - clipStart);

  if (!words || words.length === 0) {
    return {
      hasJumpCuts: false,
      originalDuration: parseFloat(originalDuration.toFixed(2)),
      condensedDuration: parseFloat(originalDuration.toFixed(2)),
      timeSaved: 0,
      segments: [{ start: clipStart, end: clipEnd, duration: parseFloat(originalDuration.toFixed(2)) }],
      sfxEvents: []
    };
  }

  // Filter words within the clip range
  const clipWords = words.filter(w => w.end >= clipStart && w.start <= clipEnd);

  if (clipWords.length === 0) {
    return {
      hasJumpCuts: false,
      originalDuration: parseFloat(originalDuration.toFixed(2)),
      condensedDuration: parseFloat(originalDuration.toFixed(2)),
      timeSaved: 0,
      segments: [{ start: clipStart, end: clipEnd, duration: parseFloat(originalDuration.toFixed(2)) }],
      sfxEvents: []
    };
  }

  const segments = [];
  let segStart = Math.max(clipStart, clipWords[0].start - 0.1);
  let prevWordEnd = clipWords[0].end;

  for (let i = 1; i < clipWords.length; i++) {
    const currentWord = clipWords[i];
    const gap = currentWord.start - prevWordEnd;

    if (gap > silenceThreshold) {
      const segEnd = Math.min(clipEnd, prevWordEnd + 0.08);
      if (segEnd > segStart + 0.25) {
        segments.push({
          start: parseFloat(segStart.toFixed(2)),
          end: parseFloat(segEnd.toFixed(2)),
          duration: parseFloat((segEnd - segStart).toFixed(2))
        });
      }
      segStart = Math.max(clipStart, currentWord.start - 0.06);
    }
    prevWordEnd = currentWord.end;
  }

  // Final segment
  const finalEnd = Math.min(clipEnd, prevWordEnd + 0.12);
  if (finalEnd > segStart + 0.25) {
    segments.push({
      start: parseFloat(segStart.toFixed(2)),
      end: parseFloat(finalEnd.toFixed(2)),
      duration: parseFloat((finalEnd - segStart).toFixed(2))
    });
  }

  // If no significant gaps were detected, keep the single clip range
  if (segments.length <= 1) {
    segments.length = 0;
    segments.push({
      start: clipStart,
      end: clipEnd,
      duration: parseFloat(originalDuration.toFixed(2))
    });
  }

  const condensedDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  const timeSaved = Math.max(0, originalDuration - condensedDuration);

  // Generate Streamer Meme SFX Cues
  const sfxEvents = [];
  let elapsedInCut = 0;

  // 1. Whoosh transition on jump cuts
  for (let i = 1; i < segments.length; i++) {
    elapsedInCut += segments[i - 1].duration;
    sfxEvents.push({
      type: 'whoosh',
      time: parseFloat(elapsedInCut.toFixed(2)),
      label: '💨 Fast Air Whoosh',
      trigger: 'Jump-Cut Transition'
    });
  }

  // 2. High-energy keywords detection
  const punchlineKeywords = [
    'what', 'why', 'how', 'no', 'crazy', 'insane', 'never', 'died', 'killed', 'money',
    'bro', 'proof', 'literally', 'everybody', 'truth', 'secret', 'million', 'billion',
    'fail', 'destroy', 'wild', 'huge', 'shocking', 'omg', 'stop', 'wrong', 'false', 'impossible'
  ];

  const insightKeywords = ['key', 'solution', 'rule', 'learn', 'free', 'win', 'smart', 'best', 'success', 'answer'];
  const scratchKeywords = ['wait', 'hold on', 'what the', 'hold up', 'pause'];

  clipWords.forEach(w => {
    const clean = (w.word || '').toLowerCase().replace(/[^a-z]/g, '');
    const relTime = parseFloat((w.start - clipStart).toFixed(2));

    if (relTime > 0.6 && relTime < condensedDuration - 0.6) {
      // Check for Vine Boom
      if (punchlineKeywords.includes(clean)) {
        const hasRecent = sfxEvents.some(e => Math.abs(e.time - relTime) < 2.2);
        if (!hasRecent && sfxEvents.filter(e => e.type === 'vine_boom').length < 3) {
          sfxEvents.push({
            type: 'vine_boom',
            time: relTime,
            label: `💥 Vine Boom: "${w.word}"`,
            trigger: `Punchline: "${w.word}"`
          });
        }
      }
      // Check for Ding
      else if (insightKeywords.includes(clean)) {
        const hasRecent = sfxEvents.some(e => Math.abs(e.time - relTime) < 2.0);
        if (!hasRecent && sfxEvents.filter(e => e.type === 'ding').length < 2) {
          sfxEvents.push({
            type: 'ding',
            time: relTime,
            label: `🔔 Key Insight: "${w.word}"`,
            trigger: `Insight: "${w.word}"`
          });
        }
      }
      // Check for Record Scratch
      else if (scratchKeywords.includes(clean)) {
        const hasRecent = sfxEvents.some(e => Math.abs(e.time - relTime) < 2.5);
        if (!hasRecent && sfxEvents.filter(e => e.type === 'record_scratch').length < 1) {
          sfxEvents.push({
            type: 'record_scratch',
            time: relTime,
            label: `💿 Record Scratch: "${w.word}"`,
            trigger: `Awkward Pause: "${w.word}"`
          });
        }
      }
    }
  });

  // Guarantee at least 1-2 punchy SFX moments if clip has speech
  if (sfxEvents.filter(e => e.type === 'vine_boom').length === 0 && clipWords.length > 8) {
    // Pick the most emphasized or middle word
    const midIdx = Math.min(clipWords.length - 2, Math.max(3, Math.floor(clipWords.length / 3)));
    const targetWord = clipWords[midIdx];
    const relTime = parseFloat(Math.max(1.0, targetWord.start - clipStart).toFixed(2));
    sfxEvents.push({
      type: 'vine_boom',
      time: relTime,
      label: `💥 Vine Boom: "${targetWord.word}"`,
      trigger: `Hook Accent: "${targetWord.word}"`
    });
  }

  return {
    hasJumpCuts: segments.length > 1,
    originalDuration: parseFloat(originalDuration.toFixed(2)),
    condensedDuration: parseFloat(condensedDuration.toFixed(2)),
    timeSaved: parseFloat(timeSaved.toFixed(2)),
    segments,
    sfxEvents: sfxEvents.sort((a, b) => a.time - b.time)
  };
}

module.exports = {
  calculateJumpCuts
};
