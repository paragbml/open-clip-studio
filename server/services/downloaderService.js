const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const localBinYtDlp = path.join(__dirname, '..', 'bin', 'yt-dlp');
const defaultLocalYtDlp = path.join(process.env.HOME || '/home/parag', '.local/bin/yt-dlp');

function resolveYtDlpBin() {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
    return process.env.YTDLP_PATH;
  }
  if (fs.existsSync(localBinYtDlp)) {
    try { fs.chmodSync(localBinYtDlp, 0o755); } catch (e) {}
    return localBinYtDlp;
  }
  if (fs.existsSync(defaultLocalYtDlp)) {
    return defaultLocalYtDlp;
  }
  try {
    const whichOut = require('child_process').execSync('which yt-dlp 2>/dev/null').toString().trim();
    if (whichOut && fs.existsSync(whichOut)) return whichOut;
  } catch (e) {}
  return 'yt-dlp';
}

/**
 * Downloads a video from URL (YouTube, Vimeo, etc.)
 */
function downloadUrl(url, outputDir, onProgress = null) {
  return new Promise((resolve, reject) => {
    const fileId = `dl_${Date.now()}`;
    const outputTemplate = path.join(outputDir, `${fileId}.%(ext)s`);

    const cookieFile = path.join(__dirname, '../yt-cookies.txt');
    const cookieArgs = fs.existsSync(cookieFile)
      ? ['--cookies', cookieFile]
      : ['--no-cookies'];

    const args = [
      '--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
      '--merge-output-format', 'mp4',
      '--extractor-args', 'youtube:player_client=android,web',
      '-N', '8',                        // 8 concurrent connection fragments for 6-8x download speedup
      '--buffer-size', '16M',           // 16MB download buffer
      '--http-chunk-size', '10M',       // 10MB chunk size to defeat YouTube per-connection throttling
      '-o', outputTemplate,
      '--no-playlist',
      ...cookieArgs,
      url
    ];

    const ytdlpBin = resolveYtDlpBin();
    const proc = spawn(ytdlpBin, args, {
      env: {
        ...process.env,
        PATH: `${path.dirname(localBinYtDlp)}:/usr/local/bin:/usr/bin:/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ''}`
      }
    });

    let stderr = '';
    let stdout = '';

    proc.on('error', err => {
      console.error('yt-dlp execution error:', err);
      reject(new Error(`Failed to run yt-dlp (${ytdlpBin}): ${err.message}`));
    });

    proc.stdout.on('data', data => {
      const text = data.toString();
      stdout += text;
      const progressMatch = text.match(/(\d{1,3}\.\d)%/);
      if (progressMatch && onProgress) {
        onProgress(parseFloat(progressMatch[1]));
      }
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      if (code === 0) {
        // Find the resulting file
        const expectedFile = path.join(outputDir, `${fileId}.mp4`);
        if (fs.existsSync(expectedFile)) {
          resolve({ filePath: expectedFile, fileId });
        } else {
          // Look for any file with prefix
          const files = fs.readdirSync(outputDir).filter(f => f.startsWith(fileId));
          if (files.length > 0) {
            resolve({ filePath: path.join(outputDir, files[0]), fileId });
          } else {
            reject(new Error('Downloaded file not found on disk'));
          }
        }
      } else {
        reject(new Error(`yt-dlp failed (code ${code}): ${stderr || stdout}`));
      }
    });
  });
}

module.exports = {
  downloadUrl
};
