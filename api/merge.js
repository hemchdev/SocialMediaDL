const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const { createWriteStream, promises: fsPromises, statSync, createReadStream } = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream/promises');
const { randomUUID } = require('crypto');

ffmpeg.setFfmpegPath(ffmpegPath);

const withCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const isSafeUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (e) {
    return false;
  }
};

const downloadToTemp = async (url, ext) => {
  const filePath = path.join(os.tmpdir(), `${randomUUID()}.${ext}`);

  // Some CDNs reject requests without a browser-like UA or referer.
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.youtube.com/'
  };

  const response = await fetch(url, { headers, redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  const fileStream = createWriteStream(filePath);
  await pipeline(response.body, fileStream);
  return filePath;
};

const mergeFiles = (videoPath, audioPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions(['-c copy'])
      .save(outputPath)
      .on('end', resolve)
      .on('error', reject);
  });
};

const safeName = (name = 'video') => {
  return name.replace(/[^a-z0-9\-_.]+/gi, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'video';
};

module.exports = async (req, res) => {
  withCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { videoUrl, audioUrl, title } = body;

  if (!videoUrl || !audioUrl) {
    return res.status(400).json({ error: 'videoUrl and audioUrl are required' });
  }

  if (!isSafeUrl(videoUrl) || !isSafeUrl(audioUrl)) {
    return res.status(400).json({ error: 'Invalid URLs' });
  }

  let videoPath;
  let audioPath;
  let outputPath;

  try {
    videoPath = await downloadToTemp(videoUrl, 'mp4');
    audioPath = await downloadToTemp(audioUrl, 'm4a');
    outputPath = path.join(os.tmpdir(), `${randomUUID()}.mp4`);

    await mergeFiles(videoPath, audioPath, outputPath);

    const stats = statSync(outputPath);
    const fileStream = createReadStream(outputPath);
    const filename = `${safeName(title)}.mp4`;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);

    fileStream.pipe(res);
  } catch (error) {
    console.error('Merge error', error);
    res.status(500).json({ error: 'Failed to merge video and audio', details: error.message });
  } finally {
    const toRemove = [videoPath, audioPath, outputPath].filter(Boolean);
    await Promise.allSettled(toRemove.map((p) => fsPromises.unlink(p).catch(() => {})));
  }
};
