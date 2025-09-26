const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

class AIProvider {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'gemini';
    this.setupProviders();
  }

  setupProviders() {
    if (this.provider === 'gemini' && process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.gemini.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' 
      });
    } else if (this.provider === 'openai' && process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  async parseTask(text) {
    if (!text || text.trim().length === 0) {
      return this.fallbackParse(text);
    }

    try {
      if (this.provider === 'gemini' && this.model) {
        return await this.parseWithGemini(text);
      } else if (this.provider === 'openai' && this.openai) {
        return await this.parseWithOpenAI(text);
      } else {
        return this.fallbackParse(text);
      }
    } catch (error) {
      console.error('AI parsing error:', error);
      return this.fallbackParse(text);
    }
  }

  async parseWithGemini(text) {
    const prompt = `Extract task information from this text and return ONLY a JSON object with these exact fields:
{
  "title": "string",
  "description": "string or null",
  "priority": "low|medium|high",
  "estimated_minutes": number or null,
  "due_at": "ISO datetime string or null",
  "deadline_at": "ISO datetime string or null",
  "start_after": "ISO datetime string or null",
  "energy": "deep|light",
  "location": "string or null"
}

Text: "${text}"

Rules:
- If duration is mentioned (like "2h", "30m", "1 hour"), convert to minutes
- If priority words like "urgent", "important", "asap" are mentioned, set priority to "high"
- If "low priority" or "whenever" is mentioned, set priority to "low"
- If "deep work", "focus", "concentration" is mentioned, set energy to "deep"
- If deadline/due date is mentioned, convert to ISO format
- Return ONLY the JSON object, no other text`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().trim();
    
    try {
      return JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', jsonText);
      return this.fallbackParse(text);
    }
  }

  async parseWithOpenAI(text) {
    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'Extract task information and return ONLY a JSON object with title, description, priority (low/medium/high), estimated_minutes, due_at, deadline_at, start_after, energy (deep/light), location. Convert durations to minutes. Return only valid JSON.'
      }, {
        role: 'user',
        content: text
      }],
      temperature: 0.1
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response.choices[0].message.content);
      return this.fallbackParse(text);
    }
  }

  fallbackParse(text) {
    const durationMatch = text.match(/(\d+)\s*(h|hour|hr|m|min|minute)/i);
    const priorityMatch = text.match(/\b(urgent|important|asap|critical|high)\b/i);
    const lowPriorityMatch = text.match(/\b(low priority|whenever|sometime)\b/i);
    const deepWorkMatch = text.match(/\b(deep work|focus|concentration|intensive)\b/i);

    return {
      title: text.trim(),
      description: null,
      priority: priorityMatch ? 'high' : lowPriorityMatch ? 'low' : 'medium',
      estimated_minutes: durationMatch ? 
        (durationMatch[2].toLowerCase().startsWith('h') ? 
          parseInt(durationMatch[1]) * 60 : 
          parseInt(durationMatch[1])) : null,
      due_at: null,
      deadline_at: null,
      start_after: null,
      energy: deepWorkMatch ? 'deep' : 'light',
      location: null
    };
  }

  async coach(goals, tasks) {
    if (!goals || !tasks || tasks.length === 0) {
      return "No goals or tasks provided for coaching.";
    }

    try {
      if (this.provider === 'gemini' && this.model) {
        return await this.coachWithGemini(goals, tasks);
      } else if (this.provider === 'openai' && this.openai) {
        return await this.coachWithOpenAI(goals, tasks);
      } else {
        return this.fallbackCoach(goals, tasks);
      }
    } catch (error) {
      console.error('AI coaching error:', error);
      return this.fallbackCoach(goals, tasks);
    }
  }

  async coachWithGemini(goals, tasks) {
    const prompt = `You are a productivity coach. Based on these goals and tasks, provide 2-3 actionable, specific pieces of advice.

Goals: ${goals}
Tasks: ${tasks.map(t => `- ${t.title} (${t.priority} priority, ${t.estimated_minutes || 'unknown'} min)`).join('\n')}

Provide concise, actionable advice. Focus on prioritization, time management, and productivity tips. Keep it under 200 words.`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  async coachWithOpenAI(goals, tasks) {
    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You are a productivity coach. Provide 2-3 actionable, specific pieces of advice based on goals and tasks. Keep it under 200 words.'
      }, {
        role: 'user',
        content: `Goals: ${goals}\nTasks: ${tasks.map(t => `- ${t.title} (${t.priority} priority, ${t.estimated_minutes || 'unknown'} min)`).join('\n')}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content;
  }

  fallbackCoach(goals, tasks) {
    const highPriorityTasks = tasks.filter(t => t.priority === 'high');
    const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    
    let advice = "Here's your productivity advice:\n\n";
    
    if (highPriorityTasks.length > 0) {
      advice += `1. Focus on your ${highPriorityTasks.length} high-priority task(s) first.\n`;
    }
    
    if (totalMinutes > 480) {
      advice += "2. You have a lot planned today. Consider breaking down large tasks or moving some to tomorrow.\n";
    }
    
    advice += "3. Take breaks between tasks to maintain focus and energy.";
    
    return advice;
  }
}

module.exports = new AIProvider();