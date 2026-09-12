/**
 * 60 FPS HTML5 Canvas Subtitle Engine
 * Renders kinetic word-by-word animated captions with karaoke highlighting and emojis
 */
export function drawKineticSubtitles(ctx, canvasWidth, canvasHeight, currentTime, words, options = {}) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (!words || words.length === 0) return;

  const {
    style = 'hormozi',
    fontSize = Math.round(canvasWidth * 0.056), // Responsive font size
    highlightColor = '#FFE600', // Neon Yellow
    primaryColor = '#FFFFFF',
    position = 'bottom', // 'bottom', 'center', 'top'
    showEmojis = true
  } = options;

  // Group words into chunks of 3-4 words
  const chunkSize = style === 'hormozi' ? 3 : 4;
  let activeChunk = null;
  let activeWord = null;

  for (let i = 0; i < words.length; i += chunkSize) {
    const group = words.slice(i, i + chunkSize);
    const start = group[0].start;
    const end = group[group.length - 1].end;

    if (currentTime >= start - 0.05 && currentTime <= end + 0.1) {
      activeChunk = group;
      activeWord = group.find(w => currentTime >= w.start && currentTime <= w.end) || group[0];
      break;
    }
  }

  if (!activeChunk) return;

  ctx.save();

  // Determine Y position
  let centerY = canvasHeight * 0.82; // Default bottom
  if (position === 'center') centerY = canvasHeight * 0.5;
  if (position === 'top') centerY = canvasHeight * 0.22;

  // Font setup
  let fontFamily = "'Montserrat', sans-serif";
  let fontWeight = '900';

  if (style === 'mrbeast') {
    fontFamily = "'Impact', sans-serif";
    fontWeight = '900';
  } else if (style === 'clean') {
    fontFamily = "'Inter', sans-serif";
    fontWeight = '700';
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Calculate total chunk width to center it horizontally
  const wordMetrics = activeChunk.map(w => {
    const text = style === 'hormozi' ? w.word.toUpperCase() : w.word;
    const isActive = activeWord && w === activeWord;
    const scale = isActive ? 1.1 : 1.0;
    
    // Set font to measure accurately
    ctx.font = `${fontWeight} ${Math.round(fontSize * scale)}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    return {
      word: w,
      text,
      isActive,
      width: metrics.width + (fontSize * 0.35),
      scale
    };
  });

  const totalWidth = wordMetrics.reduce((sum, item) => sum + item.width, 0);
  let currentX = (canvasWidth - totalWidth) / 2;

  // Render Pill Background if clean style
  if (style === 'clean') {
    ctx.fillStyle = 'rgba(10, 15, 26, 0.65)';
    const padX = fontSize * 0.6;
    const padY = fontSize * 0.4;
    const radius = 12;
    const boxX = currentX - padX;
    const boxY = centerY - fontSize * 0.7 - padY;
    const boxW = totalWidth + padX * 2;
    const boxH = fontSize * 1.4 + padY * 2;

    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, radius);
    ctx.fill();
  }

  // Draw each word
  wordMetrics.forEach(item => {
    const { word, text, isActive, width, scale } = item;
    const wordFontSize = Math.round(fontSize * scale);

    ctx.font = `${fontWeight} ${wordFontSize}px ${fontFamily}`;

    // Draw Emoji above active word if available
    if (showEmojis && isActive && word.emoji) {
      ctx.save();
      ctx.font = `${Math.round(fontSize * 1.2)}px sans-serif`;
      ctx.textAlign = 'center';
      const emojiY = centerY - wordFontSize * 0.9;
      ctx.fillText(word.emoji, currentX + width / 2, emojiY);
      ctx.restore();
    }

    // Shadow & Outline
    if (style === 'mrbeast') {
      ctx.lineWidth = Math.max(6, Math.round(fontSize * 0.16));
      ctx.strokeStyle = '#000000';
      ctx.strokeText(text, currentX, centerY);
    } else if (style === 'hormozi') {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;

      ctx.lineWidth = Math.max(5, Math.round(fontSize * 0.12));
      ctx.strokeStyle = '#000000';
      ctx.strokeText(text, currentX, centerY);
    } else if (style === 'cyberpunk') {
      ctx.shadowColor = isActive ? '#ec4899' : '#06b6d4';
      ctx.shadowBlur = 18;
    }

    // Fill Color
    if (isActive) {
      ctx.fillStyle = highlightColor;
    } else {
      ctx.fillStyle = primaryColor;
    }

    ctx.fillText(text, currentX, centerY);

    currentX += width;
  });

  ctx.restore();
}
