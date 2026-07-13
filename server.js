// Minimal static web server for Web-Slinger (serves the game files).
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(__dirname, { extensions: ['html'] }));
app.get('/health', (_req, res) => res.type('text/plain').send('ok'));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Web-Slinger listening on port ' + PORT));
