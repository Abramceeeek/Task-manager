const express = require('express');
const router = express.Router();
const aiProvider = require('./ai');

router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text input required' });
    }

    const parsedTask = await aiProvider.parseTask(text);
    res.json(parsedTask);
  } catch (error) {
    console.error('AI parse error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/coach', async (req, res) => {
  try {
    const { goals, tasks } = req.body;
    
    if (!goals || !tasks) {
      return res.status(400).json({ error: 'Goals and tasks required' });
    }

    const advice = await aiProvider.coach(goals, tasks);
    res.json({ advice });
  } catch (error) {
    console.error('AI coach error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
