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

// ─── Engagement & Emotion word banks ────────────────────────────────────────

const EMOTION_WORDS = {
  surprise:   new Set(['wow', 'whoa', 'omg', 'insane', 'crazy', 'unbelievable', 'incredible', 'no way', 'what', 'seriously', 'really', 'shocking', 'mind-blowing']),
  humor:      new Set(['funny', 'hilarious', 'lol', 'laugh', 'laughing', 'joke', 'joking', 'haha', 'lmao', 'comedy', 'bro', 'bruh', 'dawg']),
  conflict:   new Set(['wrong', 'disagree', 'argue', 'fight', 'versus', 'debate', 'no', 'but', 'however', 'actually', 'false', 'lie', 'liar', 'foolish', 'stupid', 'nonsense']),
  empathy:    new Set(['love', 'heart', 'feel', 'feeling', 'cry', 'crying', 'emotional', 'sad', 'beautiful', 'kind', 'care', 'caring', 'peace', 'forgive']),
  authority:  new Set(['research', 'study', 'studies', 'scientist', 'professor', 'expert', 'data', 'proven', 'evidence', 'fact', 'facts', 'statistics', 'according']),
  curiosity:  new Set(['secret', 'hidden', 'nobody', 'unknown', 'mystery', 'discover', 'reveal', 'truth', 'untold', 'expose', 'behind', 'real']),
  urgency:    new Set(['now', 'today', 'immediately', 'stop', 'must', 'need', 'urgent', 'critical', 'important', 'warning', 'danger', 'quickly']),
  positive:   new Set(['great', 'awesome', 'amazing', 'love', 'win', 'wonderful', 'fantastic', 'perfect', 'brilliant', 'excellent', 'best']),
  negative:   new Set(['bad', 'hate', 'boring', 'terrible', 'pain', 'failure', 'worst', 'awful', 'horrible', 'disgusting'])
};

// Hook opening patterns ranked by viral potential
const HOOK_PATTERNS = [
  { regex: /^(wait|hold on|stop|listen|okay so|so basically|here's the thing|let me tell you)/i, type: 'Attention Grabber', boost: 22 },
  { regex: /^(can you explain|what does|what do you|what are you|why do|what happened|how do you|tell me|who are you|what is)/i, type: 'Intense Question', boost: 20 },
  { regex: /^(i think|in my opinion|my concern|honestly|to be honest|the truth is|the problem is)/i, type: 'Hot Take', boost: 18 },
  { regex: /^(so i was|when i was|years ago|back when|i remember|i used to|one time|one day)/i, type: 'Storytelling', boost: 17 },
  { regex: /\?/, type: 'Question Hook', boost: 15 },
  { regex: /^(you know what|people don't realize|nobody talks about|most people|everyone thinks)/i, type: 'Contrarian Take', boost: 19 },
  { regex: /^(imagine|picture this|think about|what if|have you ever)/i, type: 'Imagination Hook', boost: 16 },
  { regex: /\b(died|killed|attacked|arrested|shot|stabbed|punched|pushed)\b/i, type: 'Dramatic Event', boost: 18 },
  { regex: /\b(million|billion|thousand|percent|hundred)\b/i, type: 'Stat-Based Hook', boost: 14 }
];

// Conclusive payoff patterns
const PAYOFF_PATTERNS = [
  { regex: /\b(that's why|that's the reason|and that's|so yeah|at the end of the day|bottom line|the point is)\b/i, boost: 14 },
  { regex: /\b(believe|peace|solution|forever|love|amen|god bless|thank you|exactly|period)\b/i, boost: 10 },
  { regex: /[.!]$/, boost: 6 },
  { regex: /\?$/, boost: 4 }
];

// ─── Utility Functions ──────────────────────────────────────────────────────

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

// ─── Sentence Boundary Detection ────────────────────────────────────────────

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
        if (isDangling && i < words.length - 1 && currentSentence.length < 24) continue;
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

// ─── Advanced Scoring Helpers ───────────────────────────────────────────────

/**
 * Measures emotional intensity across a word sequence.
 * Returns { totalScore, dominantEmotion, emotionBreakdown }
 */
function scoreEmotionalIntensity(segWords) {
  const breakdown = {};
  let total = 0;
  for (const category of Object.keys(EMOTION_WORDS)) {
    let count = 0;
    for (const w of segWords) {
      if (EMOTION_WORDS[category].has(cleanWord(w.word))) count++;
    }
    if (count > 0) {
      const weight = category === 'conflict' || category === 'surprise' ? 3 : category === 'humor' ? 4 : 2;
      const catScore = count * weight;
      breakdown[category] = catScore;
      total += catScore;
    }
  }
  const dominant = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
  return { totalScore: Math.min(total, 20), dominantEmotion: dominant ? dominant[0] : null, breakdown };
}

/**
 * Detects conversational turn-taking.
 * Looks for pronoun alternation patterns (I→you→I) and question-answer flows.
 */
function scoreTurnTaking(segWords, sentences, startIdx, endIdx) {
  let turns = 0;
  let hasQA = false;
  let lastPronounGroup = null;

  for (const w of segWords) {
    const lw = cleanWord(w.word);
    let group = null;
    if (['i', 'me', 'my', 'mine', 'myself'].includes(lw)) group = 'self';
    else if (['you', 'your', 'yours', 'yourself'].includes(lw)) group = 'other';

    if (group && group !== lastPronounGroup) {
      if (lastPronounGroup) turns++;
      lastPronounGroup = group;
    }
  }

  // Q&A detection: is there a question mark followed by a non-question sentence?
  for (let s = startIdx; s < endIdx; s++) {
    if (sentences[s].text.includes('?') && s + 1 <= endIdx && !sentences[s + 1].text.includes('?')) {
      hasQA = true;
      break;
    }
  }

  return { turnScore: Math.min(turns * 2, 12), hasQA };
}

/**
 * Measures speech energy variation — monotone speech scores low, varied pacing scores high.
 * Looks at inter-word timing variance as a proxy for vocal energy.
 */
function scorePacingVariation(segWords) {
  if (segWords.length < 10) return 0;
  const gaps = [];
  for (let i = 0; i < segWords.length - 1; i++) {
    gaps.push(segWords[i + 1].start - segWords[i].end);
  }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length;
  const stddev = Math.sqrt(variance);

  // High stddev = varied pacing = more engaging
  if (stddev > 0.4) return 8;
  if (stddev > 0.25) return 5;
  if (stddev > 0.15) return 3;
  return 0;
}

/**
 * Topic coherence — measures whether a clip stays on topic via keyword density.
 * A clip where the top 3 keywords appear frequently is more coherent.
 */
function scoreTopicCoherence(segWords) {
  const freq = {};
  for (const w of segWords) {
    const c = cleanWord(w.word);
    if (c.length > 3 && !STOPWORDS.has(c)) {
      freq[c] = (freq[c] || 0) + 1;
    }
  }
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalUnique = Object.keys(freq).length;
  if (totalUnique === 0) return 0;
  const topFreqSum = topWords.reduce((s, [, count]) => s + count, 0);
  const totalWords = segWords.length;
  const coherenceRatio = topFreqSum / totalWords;

  // Higher ratio = more focused topic = more coherent
  if (coherenceRatio > 0.12) return 8;
  if (coherenceRatio > 0.08) return 5;
  if (coherenceRatio > 0.05) return 3;
  return 0;
}

/**
 * Generates a unique, specific "Why Viral" reason based on the clip's actual content.
 */
function generateViralReason(clip, sentences, startIdx, endIdx, emotionData, turnData, wpm) {
  const parts = [];
  const openingText = sentences[startIdx].text.slice(0, 40);
  const closingText = sentences[endIdx].text.slice(-40);

  // Hook description
  parts.push(`Opens with ${clip.hookType.toLowerCase()}: "${openingText}..."`);

  // Emotional content
  if (emotionData.dominantEmotion) {
    const emotionLabels = {
      surprise: 'surprise/shock moments', humor: 'humor & comedic energy',
      conflict: 'debate & disagreement', empathy: 'emotional depth',
      authority: 'credible claims & evidence', curiosity: 'curiosity gaps',
      urgency: 'urgency & stakes', positive: 'positive energy', negative: 'raw intensity'
    };
    parts.push(`${emotionLabels[emotionData.dominantEmotion] || emotionData.dominantEmotion}`);
  }

  // Turn-taking
  if (turnData.hasQA) parts.push('complete Q&A exchange');
  else if (turnData.turnScore > 6) parts.push('dynamic back-and-forth dialogue');

  // Pacing
  if (wpm >= 140 && wpm <= 170) parts.push('optimal speech pacing');
  else if (wpm > 170) parts.push('high-energy rapid delivery');

  // Payoff
  parts.push(`resolves with "...${closingText}"`);

  return parts.join(' • ');
}


// ─── Main Clip Discovery Engine ─────────────────────────────────────────────

/**
 * High-Quality Viral Clip Finder v2
 * Multi-signal engagement scoring: emotional intensity, turn-taking, pacing variation,
 * topic coherence, hook quality, payoff quality, conversation completeness.
 *
 * @param {Object} options - { enableHookScan: boolean }
 */
function analyzeClipsDynamically(words, fullText, videoDuration, options = {}) {
  const { enableHookScan = true } = options;

  if (!words || words.length === 0) return [];
  const sentences = groupWordsIntoSentences(words);
  if (sentences.length === 0) return [];

  const candidates = [];
  const minDur = Math.min(28.0, Math.max(15.0, videoDuration * 0.65));
  const maxDur = Math.min(50.0, Math.max(35.0, videoDuration));

  // Short-video fast path
  if (videoDuration <= 35) {
    const topKeywords = extractKeywords(words, 3);
    const firstSentence = sentences[0]?.text || fullText.slice(0, 50);
    const titleText = toTitleCase(firstSentence.split(/\s+/).slice(0, 6).join(' ').replace(/[.,?!]/g, ''));
    return [{
      id: 'clip_1', start: 0, end: parseFloat(videoDuration.toFixed(2)),
      duration: parseFloat(videoDuration.toFixed(2)), viralityScore: 95,
      hookType: 'Core Message', title: `${titleText || 'Key Takeaway'} 🔥`,
      viralityReason: 'Complete standalone message with high impact from start to finish.',
      transcriptSnippet: fullText.slice(0, 160) + (fullText.length > 160 ? '...' : ''),
      words, hashtags: ['#shorts', '#viral', ...topKeywords.map(k => `#${k}`)],
      suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels']
    }];
  }

  // ── Pre-compute per-sentence banter flags to skip O(n) work inside inner loop ──
  const sentenceBanter = sentences.map(s => {
    const lower = s.text.toLowerCase();
    return BANTER_PHRASES.some(phrase => lower.includes(phrase));
  });

  // ── Sliding window with sentence-level jumps (not word-level) ──
  // Use a stride of 1 sentence for the start, and find the optimal end
  for (let i = 0; i < sentences.length; i++) {
    if (sentenceBanter[i]) continue;

    const firstSentence = sentences[i];
    const firstTextLower = firstSentence.text.toLowerCase();

    // ── HOOK SCORING ──
    let hookScore = 0;
    let hookType = 'Conversation';

    if (enableHookScan) {
      // Custom hooks from config
      const hasCustomHook = hookPhrases.some(h => firstTextLower.includes(h.toLowerCase()));
      if (hasCustomHook) {
        hookScore += 15;
        hookType = 'Custom Hook';
      }

      // Pattern-based hooks
      for (const pattern of HOOK_PATTERNS) {
        if (pattern.regex.test(firstTextLower)) {
          if (pattern.boost > hookScore) {
            hookScore = pattern.boost;
            hookType = pattern.type;
          }
          break;
        }
      }
    }

    // Penalize generic intro chatter
    if (firstSentence.start < 60 && /\b(what's up everybody|welcome back|we are here|most requested spot|hey guys|what's going on|how's everyone)\b/i.test(firstTextLower)) {
      hookScore -= 25;
    }

    // ── Find optimal end sentence ──
    // Skip ahead in larger strides for very long videos to limit candidate count
    const stride = sentences.length > 200 ? 2 : 1;

    for (let j = i + 3; j < sentences.length; j += stride) {
      const windowStart = firstSentence.start;
      const windowEnd = sentences[j].end;
      const duration = windowEnd - windowStart;

      // Early exit if we've passed maxDur
      if (duration > maxDur + 5) break;

      if (duration < minDur || duration > maxDur) continue;

      const lastSentence = sentences[j];
      const lastWord = lastSentence.words[lastSentence.words.length - 1];
      const lastWordClean = cleanWord(lastWord?.word);

      // Never end on a dangling word
      if (DANGLING_WORDS.has(lastWordClean)) continue;

      // Collect words for this window
      let windowWords = [];
      let banterCount = 0;
      for (let k = i; k <= j; k++) {
        windowWords = windowWords.concat(sentences[k].words);
        if (sentenceBanter[k]) banterCount++;
      }

      // Skip clips with too much banter
      if (banterCount >= 2) continue;

      // ── MULTI-SIGNAL SCORING ──
      let score = 50; // Base score

      // 1. Hook quality
      score += hookScore;

      // 2. Emotional intensity
      const emotionData = scoreEmotionalIntensity(windowWords);
      score += emotionData.totalScore;

      // 3. Turn-taking / dialogue quality
      const turnData = scoreTurnTaking(windowWords, sentences, i, j);
      score += turnData.turnScore;
      if (turnData.hasQA) score += 12; // Massive boost for complete Q&A

      // 4. Pacing variation (not monotone)
      score += scorePacingVariation(windowWords);

      // 5. Topic coherence
      score += scoreTopicCoherence(windowWords);

      // 6. Payoff quality — how well does the clip end?
      const lastSentenceText = lastSentence.text;
      for (const payoff of PAYOFF_PATTERNS) {
        if (payoff.regex.test(lastSentenceText)) {
          score += payoff.boost;
          break;
        }
      }

      // 7. Speech rate in optimal range
      const wpm = (windowWords.length / (duration / 60));
      if (wpm >= 120 && wpm <= 175) score += 6;
      else if (wpm >= 100 && wpm <= 200) score += 3;
      else if (wpm < 60 || wpm > 250) score -= 8; // Too slow or too fast

      // 8. Word count density — very short clips with few words are boring
      if (windowWords.length < 40) score -= 10;
      if (windowWords.length > 80) score += 3;

      // 9. Penalize clips that start with filler
      const firstWord = cleanWord(firstSentence.words[0]?.word);
      if (['um', 'uh', 'like', 'so', 'okay', 'yeah', 'well', 'right'].includes(firstWord)) {
        score -= 5;
      }

      // Clamp score
      score = Math.min(99, Math.max(55, Math.round(score)));

      // Generate title
      let titleWords = firstSentence.text.split(/\s+/).slice(0, 8);
      while (titleWords.length > 3 && DANGLING_WORDS.has(cleanWord(titleWords[titleWords.length - 1]))) {
        titleWords.pop();
      }
      let cleanTitle = toTitleCase(titleWords.join(' ').replace(/[.,?!]/g, '').trim());
      if (!cleanTitle || cleanTitle.length < 5) cleanTitle = 'The Real Meaning';

      const emojiMap = {
        'Intense Question': '🗣️', 'Hot Take': '🔥', 'Storytelling': '📖',
        'Question Hook': '❓', 'Contrarian Take': '💡', 'Attention Grabber': '⚡',
        'Imagination Hook': '✨', 'Dramatic Event': '😱', 'Stat-Based Hook': '📊',
        'Thought-Provoking Topic': '💡', 'Bold Statement': '🔥', 'Personal Story': '📖',
        'Custom Hook': '🎯', 'Conversation': '💬'
      };
      const emoji = emojiMap[hookType] || '🔥';

      const reason = generateViralReason(
        { hookType }, sentences, i, j, emotionData, turnData, wpm
      );

      candidates.push({
        id: `clip_${candidates.length + 1}`,
        start: parseFloat(windowStart.toFixed(2)),
        end: parseFloat(windowEnd.toFixed(2)),
        duration: parseFloat(duration.toFixed(2)),
        viralityScore: score,
        hookType,
        title: `${cleanTitle} ${emoji}`,
        viralityReason: reason,
        transcriptSnippet: windowWords.map(w => w.word).join(' ').slice(0, 200) + '...',
        words: windowWords,
        hashtags: ['#shorts', '#viral', ...extractKeywords(windowWords, 2).map(k => `#${k}`)],
        suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels'],
        generatedHook: null
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.viralityScore - a.viralityScore);

  // Deduplicate — reject if >25% time overlap with a higher-scoring clip
  const finalClips = [];
  for (const cand of candidates) {
    const isOverlapping = finalClips.some(existing => {
      const overlapStart = Math.max(cand.start, existing.start);
      const overlapEnd = Math.min(cand.end, existing.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      return overlap > 0.25 * Math.min(cand.duration, existing.duration);
    });
    if (!isOverlapping) {
      finalClips.push(cand);
      if (finalClips.length >= 6) break;
    }
  }

  return finalClips.length > 0 ? finalClips : candidates.slice(0, 5);
}


// ─── LLM-Based Analyzers ────────────────────────────────────────────────────

async function analyzeClipsWithGroq(words, fullText, videoDuration, apiKey) {
  const prompt = `You are a viral shorts editor for TikTok and YouTube Shorts.
Analyze this transcript and find the top 5 most ENGAGING clips, each strictly between 30 and 45 seconds.

CRITICAL RULES:
1. IGNORE stream setup, camera checks, hair checks, backpack adjustments, or small-talk banter.
2. Select ONLY segments with HIGH ENGAGEMENT: debates, arguments, shocking revelations, funny moments, emotional stories, or thought-provoking questions.
3. Each clip MUST start with a strong hook (question, bold statement, or attention grabber) and end with a payoff (conclusion, punchline, or resolution).
4. NEVER end mid-sentence or mid-thought. Each clip must be self-contained and make complete sense.
5. Prioritize: conflict/debate > humor/funny > emotional/story > educational > general conversation.

Video Duration: ${videoDuration}s.
Transcript:
${fullText.slice(0, 12000)}

Return ONLY a valid JSON array (no wrapping object):
[
  {
    "start": 88.0,
    "end": 124.0,
    "viralityScore": 98,
    "hookType": "Intense Debate",
    "title": "What Does Your Sign Mean? 🗣️",
    "viralityReason": "Opens with provocative question, features heated back-and-forth debate, resolves with powerful statement.",
    "hashtags": ["#shorts", "#debate"]
  }
]`;

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.15
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
                start, end,
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

    req.on('error', () => resolve(analyzeClipsDynamically(words, fullText, videoDuration)));
    req.write(postData);
    req.end();
  });
}

async function analyzeClipsWithGemini(words, fullText, videoDuration, apiKey) {
  const prompt = `You are a viral shorts editor. Find the top 5 most engaging clips (30-45 seconds each).
Rules: Ignore banter/setup. Each clip needs a strong hook + complete payoff. Prioritize conflict, humor, emotion.
Video duration: ${videoDuration}s.
Transcript:
${fullText.slice(0, 12000)}

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
              id: `clip_gemini_${i + 1}`, ...c, start, end,
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

    req.on('error', () => resolve(analyzeClipsDynamically(words, fullText, videoDuration)));
    req.write(postData);
    req.end();
  });
}


// ─── Master Dispatcher ──────────────────────────────────────────────────────

async function discoverViralClips(words, fullText, videoDuration, keys = {}, options = {}) {
  const groqKey = (typeof keys === 'string' ? null : keys?.groqApiKey) || process.env.GROQ_API_KEY;
  const geminiKey = (typeof keys === 'string' ? keys : keys?.geminiApiKey) || process.env.GEMINI_API_KEY;
  const { enableHookScan = true } = options;

  let clips = null;

  if (groqKey) {
    try {
      clips = await analyzeClipsWithGroq(words, fullText, videoDuration, groqKey);
    } catch (e) {
      console.warn('Groq analysis fallback to local:', e.message);
    }
  }

  if (!clips && geminiKey) {
    try {
      clips = await analyzeClipsWithGemini(words, fullText, videoDuration, geminiKey);
    } catch (e) {
      console.warn('Gemini analysis fallback to local:', e.message);
    }
  }

  if (!clips) {
    clips = analyzeClipsDynamically(words, fullText, videoDuration, { enableHookScan });
  }

  return clips;
}


module.exports = {
  discoverViralClips,
  analyzeClipsDynamically,
  groupWordsIntoSentences
};
