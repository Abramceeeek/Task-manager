require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const db = require('./server/db');
const apiRoutes = require('./server/api');
const aiRoutes = require('./server/ai-routes');
const schedulerRoutes = require('./server/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});
app.use('/api', limiter);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/schedule', schedulerRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`AI Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
});