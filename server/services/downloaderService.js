const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const defaultLocalYtDlp = path.join(process.env.HOME || '/home/parag', '.local/bin/yt-dlp');
const YTDLP_BIN = process.env.YTDLP_PATH || (fs.existsSync(defaultLocalYtDlp) ? defaultLocalYtDlp : 'yt-dlp');

/**
 * Downloads a video from URL (YouTube, Vimeo, etc.)
 */
function downloadUrl(url, outputDir, onProgress = null) {
  return new Promise((resolve, reject) => {
    const fileId = `dl_${Date.now()}`;
    const outputTemplate = path.join(outputDir, `${fileId}.%(ext)s`);

    // Fetch max 1080p mp4
    // visionos player client works for public YouTube videos without auth/JS runtime
    const cookieFile = path.join(__dirname, '../yt-cookies.txt');
    const cookieArgs = fs.existsSync(cookieFile)
      ? ['--cookies', cookieFile]        // use saved cookies for age-restricted content
      : ['--no-cookies'];               // no cookies needed for most public videos

    const args = [
      '--format', 'bestvideo[vcodec^=avc1][height<=1080]+bestaudio[ext=m4a]/bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '-N', '8',                        // 8 concurrent connection fragments for 6-8x download speedup
      '--buffer-size', '16M',           // 16MB download buffer
      '--http-chunk-size', '10M',       // 10MB chunk size to defeat YouTube per-connection throttling
      '-o', outputTemplate,
      '--no-playlist',
      ...cookieArgs,
      url
    ];

    const nodeBin = process.execPath; // current node binary
    const proc = spawn(YTDLP_BIN, args, {
      env: {
        ...process.env,
        PATH: `/usr/local/bin:/usr/bin:/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ''}`
      }
    });
    let stderr = '';
    let stdout = '';

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
