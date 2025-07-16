const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = 3001;


const allowedOrigins = [
  'https://media-player-chi-ten.vercel.app',
  'http://localhost:3000' // (optional, for local dev)
];
app.use(cors({
  origin: allowedOrigins
}));
app.use(express.json());

// Explicit OPTIONS handler for CORS preflight
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', allowedOrigins.join(','));
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Helper: Find first video file URL in HTML
function extractVideoUrl(html, baseUrl) {
    const $ = cheerio.load(html);
    // 1. Look for <video> tags with src
    let videoSrc = $('video').attr('src');
    if (videoSrc) return new URL(videoSrc, baseUrl).href;
    // 2. Look for <source> tags inside <video>
    videoSrc = $('video source').attr('src');
    if (videoSrc) return new URL(videoSrc, baseUrl).href;
    // 3. Look for direct links to video files
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.m4v', '.mov'];
    let found = null;
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && videoExtensions.some(ext => href.toLowerCase().includes(ext))) {
            found = new URL(href, baseUrl).href;
            return false;
        }
    });
    if (found) return found;
    // 4. Look for video files in script tags (basic regex)
    const scriptTags = $('script').map((i, el) => $(el).html()).get().join('\n');
    const regex = /(https?:\/\/[^"'\s]+\.(mp4|webm|ogg|m4v|mov))/i;
    const match = scriptTags.match(regex);
    if (match) return match[1];
    return null;
}

app.post('/api/extract-video', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return res.status(400).json({ error: 'Failed to fetch page' });
        const html = await response.text();
        const videoUrl = extractVideoUrl(html, url);
        if (videoUrl) {
            res.json({ videoUrl });
        } else {
            res.status(404).json({ error: 'No video file found on page' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Extractor backend running on http://localhost:${PORT}`);
});
