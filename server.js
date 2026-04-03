const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Cache for stats data (24 hours)
let statsCache = null;
let statsCacheTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Proxy endpoint for stats (cached)
app.get('/api/stats', asyncHandler(async (req, res) => {
    // Check cache
    if (statsCache && statsCacheTime && (Date.now() - statsCacheTime < CACHE_DURATION)) {
        console.log('📊 Serving stats from cache');
        return res.json(statsCache);
    }

    console.log('🔄 Fetching fresh stats data...');
    const response = await axios.get('https://api-cs.casino.org/svc-evolution-game-events/api/lightningdice/stats', {
        params: {
            duration: req.query.duration || 24,
            sortField: req.query.sortField || 'hotFrequency'
        },
        headers: {
            'Origin': 'https://www.casino.org',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.casino.org/',
            'Accept': 'application/json'
        },
        timeout: 10000
    });
    
    // Update cache
    statsCache = response.data;
    statsCacheTime = Date.now();
    
    console.log('✅ Stats data cached for 24 hours');
    res.json(response.data);
}));

// Proxy endpoint for latest (no cache - real-time)
app.get('/api/latest', asyncHandler(async (req, res) => {
    const response = await axios.get('https://api-cs.casino.org/svc-evolution-game-events/api/lightningdice/latest', {
        headers: {
            'Origin': 'https://www.casino.org',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.casino.org/',
            'Accept': 'application/json'
        },
        timeout: 5000
    });
    
    res.json(response.data);
}));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        cacheActive: statsCache ? true : false,
        uptime: process.uptime()
    });
});

// Serve ML files with correct MIME type
app.get('/ml/*.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'public', req.path));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n⚡ Lightning Dice Predictor Server`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📊 Stats API: http://localhost:${PORT}/api/stats`);
    console.log(`🔄 Latest API: http://localhost:${PORT}/api/latest`);
    console.log(`💚 Health: http://localhost:${PORT}/api/health`);
    console.log(`🚀 Server is running on port ${PORT}\n`);
});