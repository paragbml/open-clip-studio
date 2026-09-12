const https = require('https');
const fs = require('fs');
const path = require('path');

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'were', 'they', 'what',
  'your', 'about', 'there', 'their', 'which', 'would', 'could', 'should', 'been',
  'will', 'when', 'them', 'some', 'than', 'into', 'just', 'more', 'also', 'very',
  'most', 'only', 'even', 'then', 'here', 'like', 'these', 'where', 'after', 'first'
]);

const DANGLING_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'so', 'because', 'like', 'if',
  'that', 'which', 'with', 'to', 'when', 'as', 'then', 'than', 'of', 'in',
  'on', 'at', 'by', 'for', 'about', 'is', 'are', 'was', 'were', 'my', 'your',
  'their', 'his', 'her', 'our', 'its', 'into', 'from', 'up', 'down', 'out',
  'over', 'under', 'just', 'very', 'really', 'also', 'even', 'who', 'whom',
  'whose', 'where', 'why', 'how', 'what', 'be', 'been', 'being', 'have', 'has', 'had'
]);

// Phrases indicative of stream setup, gear testing, and low-substance small talk
const BANTER_PHRASES = [
  'stream check', 'hair check', 'mic check', 'carry back', 'carry backpack',
  'finish up your copy', 'is it alive', 'can you hear me', 'check check',
  'keep it on me', 'testing mic', 'one two three', 'just making sure',
  'is it on', 'hold on let me', 'turn around', 'adjust the camera',
  'can you hold this', 'where are we going', 'let me grab', 'check check check',
  'can i rely', '200 followers', 'test test'
];
// Load custom hook phrases from config
const HOOK_PHRASES_PATH = path.join(__dirname, '..', 'config', 'hookPhrases.json');
let hookPhrases = [];
try {
  const raw = fs.readFileSync(HOOK_PHRASES_PATH, 'utf-8');
  hookPhrases = JSON.parse(raw);
} catch (e) {
  console.warn('Failed to load hook phrases, using defaults');
  hookPhrases = [];
}

/**
 * Generate a hook using local LLM endpoint.
 * Returns a Promise<string> that resolves to a short hook phrase.
 */
function generateHookAsync() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      prompt: 'Generate a short, catchy hook phrase (3-6 words) for a viral short video.',
      max_tokens: 12
    });
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.hook || parsed.text || 'Did you know?');
        } catch {
          resolve('Did you know?');
        }
      });
    });
    req.on('error', () => resolve('Did you know?'));
    req.write(postData);
    req.end();
  });
}


function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function cleanWord(w) {
  return (w || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractKeywords(words, count = 4) {
  const freq = {};
  words.forEach(w => {
    const clean = cleanWord(w.word);
    if (clean.length > 3 && !STOPWORDS.has(clean)) {
      freq[clean] = (freq[clean] || 0) + 1;
    }
  });

  return Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, count);
}

/**
 * Intelligent Sentence & Thought Boundary Parser
 * Groups spoken words into complete grammatical thoughts.
 */
function groupWordsIntoSentences(words) {
  if (!words || words.length === 0) return [];

  const sentences = [];
  let currentSentence = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentSentence.push(w);

    const rawWord = w.word.trim();
    const clean = cleanWord(rawWord);
    const hasPunctuation = /[.?!]$/.test(rawWord);
    const isNextWordValid = i < words.length - 1;
    const pauseAfter = isNextWordValid ? (words[i + 1].start - w.end) : 0;

    const isDangling = DANGLING_WORDS.has(clean);
    const isNaturalThoughtBoundary = pauseAfter > 0.85 && !isDangling && currentSentence.length >= 4;

    if (hasPunctuation || isNaturalThoughtBoundary || i === words.length - 1) {
      if (currentSentence.length > 0) {
        if (isDangling && i < words.length - 1 && currentSentence.length < 24) {
          continue;
        }

        sentences.push({
          start: currentSentence[0].start,
          end: currentSentence[currentSentence.length - 1].end,
          text: currentSentence.map(x => x.word).join(' '),
          words: currentSentence,
          endsInTerminalPunctuation: hasPunctuation,
          lastWordClean: clean
        });
        currentSentence = [];
      }
    }
  }

  if (currentSentence.length > 0) {
    sentences.push({
      start: currentSentence[0].start,
      end: currentSentence[currentSentence.length - 1].end,
      text: currentSentence.map(x => x.word).join(' '),
      words: currentSentence,
      endsInTerminalPunctuation: false,
      lastWordClean: cleanWord(currentSentence[currentSentence.length - 1].word)
    });
  }

  return sentences;
}

/**
 * High-Meaning Viral Clip Finder
 * Strictly targets 30s - 42s self-contained narrative clips.
 * Filters out mic checks/streamer small talk and prioritizes dialogue, debates, and story arcs.
 */
function analyzeClipsDynamically(words, fullText, videoDuration) {
  // Helper: simple sentiment word lists for quick scoring
  const POSITIVE_WORDS = new Set(['great', 'awesome', 'amazing', 'love', 'funny', 'win', 'winwin', 'awesome', 'wow', 'hilarious', 'laugh']);
  const NEGATIVE_WORDS = new Set(['bad', 'sad', 'hate', 'boring', 'terrible', 'pain', 'failure', 'danger', 'problem']);
  // Helper: compute an engagement boost based on pauses and speaker turns
  function computeEngagementBoost(segWords) {
    let boost = 0;
    // Longer pauses (>0.8s) indicate emphasis
    for (let i = 0; i < segWords.length - 1; i++) {
      const pause = segWords[i + 1].start - segWords[i].end;
      if (pause > 0.8) boost += 2;
    }
    // Speaker turn changes (detect by presence of typical address words)
    const turnWords = ['you', 'i', 'we', 'they', 'he', 'she'];
    const turns = segWords.filter(w => turnWords.includes(w.word.toLowerCase())).length;
    boost += Math.min(turns, 5);
    return boost;
  }
  // Helper: sentiment score for a segment
  function sentimentScore(segWords) {
    let score = 0;
    for (const w of segWords) {
      const lw = w.word.toLowerCase();
      if (POSITIVE_WORDS.has(lw)) score += 2;
      if (NEGATIVE_WORDS.has(lw)) score -= 2;
    }
    return score;
  }
  // Helper: expand a clip to include preceding/following sentences for context while staying within limits
  function expandClipContext(startIdx, endIdx, sentences, minDur, maxDur) {
    let start = startIdx, end = endIdx;
    // Try to include one preceding sentence if it improves hook quality
    if (start > 0) {
      const prev = sentences[start - 1];
      const newDur = sentences[end].end - prev.start;
      if (newDur >= minDur && newDur <= maxDur) start--;
    }
    // Try to include one following sentence if it provides payoff
    if (end < sentences.length - 1) {
      const next = sentences[end + 1];
      const newDur = next.end - sentences[start].start;
      if (newDur >= minDur && newDur <= maxDur) end++;
    }
    return { startIdx: start, endIdx: end };
  }

  if (!words || words.length === 0) return [];

  const sentences = groupWordsIntoSentences(words);
  if (sentences.length === 0) return [];

  const candidates = [];

  // Strictly target 30s - 42s as requested by user (allow a little padding for context expansion)
  const minDur = Math.min(30.0, Math.max(15.0, videoDuration * 0.70));
  const maxDur = Math.min(45.0, Math.max(35.0, videoDuration));

  // If video is shorter than target, encapsulate whole video
  if (videoDuration <= 35) {
    const topKeywords = extractKeywords(words, 3);
    const firstSentence = sentences[0]?.text || fullText.slice(0, 50);
    const titleText = toTitleCase(firstSentence.split(/\s+/).slice(0, 6).join(' ').replace(/[.,?!]/g, ''));

    return [{
      id: 'clip_1',
      start: 0,
      end: parseFloat(videoDuration.toFixed(2)),
      duration: parseFloat(videoDuration.toFixed(2)),
      viralityScore: 95,
      hookType: 'Core Message',
      title: `${titleText || 'Key Takeaway'} 🔥`,
      viralityReason: `Complete standalone message with high impact from start to finish.`,
      transcriptSnippet: fullText.slice(0, 160) + (fullText.length > 160 ? '...' : ''),
      words,
      hashtags: ['#shorts', '#viral', ...topKeywords.map(k => `#${k}`)],
      suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels']
    }];
  }

  // Scan through sentences
  for (let i = 0; i < sentences.length; i++) {
    const firstSentence = sentences[i];
    const firstTextLower = firstSentence.text.toLowerCase();

    // 1. BANTER FILTER: Immediately discard small talk and stream setup checks
    const isBanter = BANTER_PHRASES.some(phrase => firstTextLower.includes(phrase));
    if (isBanter) {
      continue; // Skip stream setup chatter completely!
    }

    let qualityScore = 70;
    let hookType = 'Deep Conversation';

    // Hook phrase detection from custom list
    const hasCustomHook = hookPhrases.some(h => firstTextLower.includes(h.toLowerCase()));
    if (hasCustomHook) {
      qualityScore += 12; // boost for strong opening hook
      hookType = 'Custom Hook';
    }

    // 2. DIALOGUE & CONTENT QUALITY SCORING
    // Inquiry & Question Hook
    if (firstTextLower.includes('?') || /^(can you explain|what does|what are you|why do|what happened|how do you|tell me|who are you)\b/i.test(firstTextLower)) {
      qualityScore += 18;
      hookType = 'Intense Question';
    } else if (/\b(sign|standing for|representing|believe|faith|religion|jesus|islam|christianity|gospel|society|law|rights|freedom|truth)\b/i.test(firstTextLower)) {
      qualityScore += 16;
      hookType = 'Thought-Provoking Topic';
    } else if (/\b(secret|truth|insane|crazy|mistake|problem|solution|heartbreaking|never|stop)\b/i.test(firstTextLower)) {
      qualityScore += 14;
      hookType = 'Bold Statement';
    } else if (/\b(basically|listen|my concern is|the truth is|years ago|i used to)\b/i.test(firstTextLower)) {
      qualityScore += 12;
      hookType = 'Personal Story';
    }

    // Penalize generic stream intros within the first 60 seconds
    if (firstSentence.start < 60 && /\b(what's up everybody|welcome back|we are here|most requested spot)\b/i.test(firstTextLower)) {
      qualityScore -= 20;
    }

    for (let j = i; j < sentences.length; j++) {
      const expanded = expandClipContext(i, j, sentences, minDur, maxDur);
      const startIdx = expanded.startIdx;
      const endIdx = expanded.endIdx;

      let windowWords = [];
      for (let k = startIdx; k <= endIdx; k++) {
        windowWords = windowWords.concat(sentences[k].words);
      }

      const windowStart = sentences[startIdx].start;
      const windowEnd = sentences[endIdx].end;
      const duration = windowEnd - windowStart;

      // Only accept if strictly within target minDur - maxDur window
      if (duration >= minDur && duration <= maxDur) {
        const lastSentence = sentences[endIdx];
        const lastWord = lastSentence.words[lastSentence.words.length - 1];
        const lastWordClean = cleanWord(lastWord?.word);

        // Discard if ending on dangling connector
        if (DANGLING_WORDS.has(lastWordClean)) {
          continue;
        }

        const segText = windowWords.map(w => w.word).join(' ');
        const segLower = segText.toLowerCase();

        // Check for banter inside the clip
        const containsHeavyBanter = BANTER_PHRASES.filter(p => segLower.includes(p)).length >= 2;
        if (containsHeavyBanter) {
          continue;
        }

        let score = qualityScore;
        score += sentimentScore(windowWords);
        score += computeEngagementBoost(windowWords);

        // Conclusion & Payoff Quality
        const lastSentenceText = lastSentence.text.toLowerCase();
        if (lastSentence.endsInTerminalPunctuation) {
          score += 6;
        }

        // Substantive payoff markers
        if (/\b(heartbreaking|die for everybody|spread the love|save|reason|that's what you're here to do|peace|believe|period|forever|solution)\b/i.test(lastSentenceText)) {
          score += 12;
        }

        // Dialogue turn bonus: if both question and answer are contained
        if (segText.includes('?') && (segLower.includes('basically') || segLower.includes('because') || segLower.includes('well') || segLower.includes('my concern'))) {
          score += 10;
        }

        // Pacing score: 120-175 WPM
        const wpm = (windowWords.length / (duration / 60));
        if (wpm >= 115 && wpm <= 180) score += 6;

        score = Math.min(99, Math.max(76, Math.round(score)));

        // Generate clean meaningful title
        let titleWords = firstSentence.text.split(/\s+/).slice(0, 8);
        while (titleWords.length > 3 && DANGLING_WORDS.has(cleanWord(titleWords[titleWords.length - 1]))) {
          titleWords.pop();
        }
        let cleanTitle = toTitleCase(titleWords.join(' ').replace(/[.,?!]/g, '').trim());
        if (!cleanTitle || cleanTitle.length < 5) cleanTitle = "The Real Meaning";

        const emoji = windowWords.find(w => w.emoji)?.emoji || (hookType.includes('Question') ? '🗣️' : hookType.includes('Topic') ? '💡' : '🔥');
        const dynamicTitle = `${cleanTitle} ${emoji}`;

        const reason = `High-meaning dialogue (${Math.round(wpm)} WPM): Opens with "${firstSentence.text.slice(0, 32)}...", develops topic context, and resolves with clean conclusion.`;

        candidates.push({
          id: `clip_${candidates.length + 1}`,
          start: parseFloat(windowStart.toFixed(2)),
          end: parseFloat(windowEnd.toFixed(2)),
          duration: parseFloat(duration.toFixed(2)),
          viralityScore: score,
          hookType,
          title: dynamicTitle,
          viralityReason: reason,
          transcriptSnippet: segText.slice(0, 180) + (segText.length > 180 ? '...' : ''),
          words: windowWords,
          hashtags: ['#shorts', '#viral', '#debate', '#conversation'],
          suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels'],
          // Attach generated hook if none was present
          generatedHook: hasCustomHook ? null : undefined
        });
      }
    }
  }

  // Sort descending by viralityScore
  candidates.sort((a, b) => b.viralityScore - a.viralityScore);

  // Deduplicate overlapping clips (allow a little more tolerance for context‑expanded clips)
  const finalClips = [];
  for (const cand of candidates) {
    const isOverlapping = finalClips.some(existing => {
      const overlapStart = Math.max(cand.start, existing.start);
      const overlapEnd = Math.min(cand.end, existing.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      return overlap > 0.30 * Math.min(cand.duration, existing.duration);
    });

    if (!isOverlapping && finalClips.length < 5) {
      finalClips.push(cand);
    }
  }

  return finalClips.length > 0 ? finalClips : candidates.slice(0, 4);


/**
 * Groq Llama-3 AI Virality Analyzer (Free Tier, 400ms inference)
 */
async function analyzeClipsWithGroq(words, fullText, videoDuration, apiKey) {
  const prompt = `You are a viral shorts editor for TikTok and YouTube Shorts.
Analyze this transcript and find top 3-5 high-meaning, engaging clips strictly between 30 and 40 seconds.
CRITICAL:
1. Ignore stream setup, camera checks, hair checks, backpack adjustments, or small-talk banter.
2. Select only substantive debates, interviews, stories, or compelling discussions that make COMPLETE sense.
3. Never end mid-sentence or mid-thought.

Duration: ${videoDuration}s.
Transcript:
${fullText}

Return valid JSON array:
[
  {
    "start": 88.0,
    "end": 124.0,
    "viralityScore": 98,
    "hookType": "Intense Debate",
    "title": "What Does Your Sign Mean? 🗣️",
    "viralityReason": "High-interest conversation with powerful question hook and complete emotional payoff.",
    "hashtags": ["#shorts", "#debate"]
  }
]`;

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const raw = parsed.choices[0].message.content;
          const jsonRes = JSON.parse(raw);
          const clipList = Array.isArray(jsonRes) ? jsonRes : (jsonRes.clips || jsonRes.segments || []);

          if (clipList.length > 0) {
            const enriched = clipList.map((c, i) => {
              const start = Math.max(0, parseFloat(c.start));
              const end = Math.min(videoDuration, parseFloat(c.end));
              return {
                id: `clip_groq_${i + 1}`,
                ...c,
                start,
                end,
                duration: parseFloat((end - start).toFixed(2)),
                words: words.filter(w => w.start >= start - 0.2 && w.end <= end + 0.2),
                suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels']
              };
            });
            return resolve(enriched);
          }
          resolve(analyzeClipsDynamically(words, fullText, videoDuration));
        } catch (e) {
          resolve(analyzeClipsDynamically(words, fullText, videoDuration));
        }
      });
    });

    req.on('error', () => {
      resolve(analyzeClipsDynamically(words, fullText, videoDuration));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Gemini Flash API Virality Analyzer (Free Tier)
 */
async function analyzeClipsWithGemini(words, fullText, videoDuration, apiKey) {
  const prompt = `You are a viral shorts editor. Select top 3-4 high-meaning clips between 30 and 40 seconds.
Exclude stream setup banter or mic checks.
Video duration: ${videoDuration}s.
Transcript:
${fullText}

Return valid JSON array:
[
  {
    "start": 88.0,
    "end": 124.0,
    "viralityScore": 97,
    "hookType": "Intense Debate",
    "title": "What Does Your Sign Mean? 🗣️",
    "viralityReason": "Complete contextual dialogue with strong opening and poignant resolution.",
    "hashtags": ["#shorts", "#viral"]
  }
]`;

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const rawText = parsed.candidates[0].content.parts[0].text;
          const clips = JSON.parse(rawText);
          const enriched = clips.map((c, i) => {
            const start = Math.max(0, parseFloat(c.start));
            const end = Math.min(videoDuration, parseFloat(c.end));
            return {
              id: `clip_gemini_${i + 1}`,
              ...c,
              start,
              end,
              duration: parseFloat((end - start).toFixed(2)),
              words: words.filter(w => w.start >= start - 0.2 && w.end <= end + 0.2),
              suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels']
            };
          });
          resolve(enriched);
        } catch (e) {
          resolve(analyzeClipsDynamically(words, fullText, videoDuration));
        }
      });
    });

    req.on('error', () => {
      resolve(analyzeClipsDynamically(words, fullText, videoDuration));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Master dispatcher
 */
async function discoverViralClips(words, fullText, videoDuration, keys = {}) {
  const groqKey = (typeof keys === 'string' ? null : keys?.groqApiKey) || process.env.GROQ_API_KEY;
  const geminiKey = (typeof keys === 'string' ? keys : keys?.geminiApiKey) || process.env.GEMINI_API_KEY;

  if (groqKey) {
    try {
      return await analyzeClipsWithGroq(words, fullText, videoDuration, groqKey);
    } catch (e) {
      console.warn('Groq analysis fallback to local:', e.message);
    }
  }

  if (geminiKey) {
    try {
      return await analyzeClipsWithGemini(words, fullText, videoDuration, geminiKey);
    } catch (e) {
      console.warn('Gemini analysis fallback to local:', e.message);
    }
  }

  return analyzeClipsDynamically(words, fullText, videoDuration);
    }
  
  // After clip discovery, enrich clips with generated hooks if needed
  const enrichedClips = [];
  for (const clip of (await (groqKey ? analyzeClipsWithGroq(words, fullText, videoDuration, groqKey) : (geminiKey ? analyzeClipsWithGemini(words, fullText, videoDuration, geminiKey) : analyzeClipsDynamically(words, fullText, videoDuration)))) ) {
    if (!clip.hookType && !clip.generatedHook) {
      // No custom hook detected, generate one
      try {
        const genHook = await generateHookAsync();
        clip.generatedHook = genHook;
        clip.hookType = 'Auto-Generated Hook';
        // Prepend hook text to title for visibility
        clip.title = `${genHook} 🔥 ${clip.title}`;
      } catch (e) {
        console.warn('Hook generation failed:', e);
      }
    }
    enrichedClips.push(clip);
  }
  return enrichedClips;
}


module.exports = {
  discoverViralClips,
  analyzeClipsDynamically,
  groupWordsIntoSentences
};
