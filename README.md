# Motion AI - Smart Task Manager

A production-ready AI-powered task manager with intelligent scheduling, natural language processing, and optimization-based planning. Built with Node.js, Python OR-Tools solver, and modern web technologies.

## 🚀 Features

- **AI-Powered Task Parsing**: Natural language input with Gemini API (free tier)
- **Intelligent Scheduling**: OR-Tools CP-SAT optimization for optimal time blocking
- **Voice Input**: Speech-to-text task creation
- **Smart Planning**: Auto-generate daily schedules with constraints and preferences
- **Modern UI**: Responsive design with dark/light themes
- **Real-time Updates**: Live task management and schedule updates
- **Keyboard Shortcuts**: Power user features (Ctrl+N, Ctrl+P, Ctrl+A)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Node.js API   │    │  Python Solver  │
│   (Static HTML) │◄──►│   (Express)     │◄──►│   (FastAPI)     │
│   + Tailwind    │    │   + SQLite      │    │   + OR-Tools    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Tech Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Backend**: Node.js, Express.js, SQLite
- **Solver**: Python 3.11, FastAPI, OR-Tools CP-SAT
- **AI**: Google Gemini API (free), OpenAI (optional)
- **Containerization**: Docker, Docker Compose

## 📋 Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo>
cd motion-ai-task-manager
```

### 2. Configure Environment

```bash
cp env.example .env
```

Edit `.env` and add your API keys:

```bash
# Required: Get free Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: OpenAI fallback
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Google Calendar integration
FEATURE_CALENDAR=1
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 3. Run with Docker

```bash
# Start all services
docker compose up --build

# In another terminal, seed the database
docker compose exec node npm run seed
```

### 4. Access the Application

- **Web App**: http://localhost:3000
- **API Docs**: http://localhost:3000/api (if implemented)
- **Solver Health**: http://localhost:8001/health

## 🔑 Getting API Keys

### Gemini API (FREE - Recommended)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key to your `.env` file

### OpenAI API (Optional)
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create account and add payment method
3. Generate new secret key
4. Copy to your `.env` file

### Google Calendar (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials
5. Set redirect URI: `http://localhost:3000/oauth2/callback`

## 🎯 Demo Scenario

After seeding, you'll have:

1. **4 Demo Tasks**:
   - "Finish RILA section" (120m, high priority, deep work)
   - "Call Jamshid" (30m, medium priority, light work)
   - "Review quarterly reports" (90m, high priority, deep work)
   - "Team standup meeting" (15m, medium priority, light work)

2. **1 Fixed Calendar Event**:
   - Morning Team Meeting (9:00-10:00 AM)

3. **Try the Flow**:
   - Click "Auto Plan" to generate schedule
   - Review the proposed time blocks
   - Click "Approve & Apply" to confirm
   - View your scheduled day in the right panel

## 🎮 Usage Guide

### Adding Tasks

1. **Quick Add**: Type task in the input field and press Enter
2. **AI Parse**: Use "AI Parse" button for natural language processing
3. **Voice Input**: Click microphone icon for speech-to-text
4. **Examples**:
   - "Write report for 2 hours high priority"
   - "Call mom tomorrow at 3pm for 30 minutes"
   - "Deep work session for 90 minutes before lunch"

### Planning Your Day

1. Click "Auto Plan" to generate schedule
2. Review proposed time blocks in Plan Preview
3. Use "Dry Run" toggle to preview without applying
4. Click "Approve & Apply" to confirm schedule
5. View your day in the Schedule timeline

### AI Coaching

1. Enter your goals in the Coach section
2. Click "Get AI Advice" for personalized tips
3. Get suggestions on prioritization and time management

## ⌨️ Keyboard Shortcuts

- `Ctrl/Cmd + N`: Focus task input
- `Ctrl/Cmd + P`: Auto plan day
- `Ctrl/Cmd + A`: Approve plan (when available)

## 🧪 Testing

```bash
# Run Node.js tests
npm test

# Run Python solver tests
docker compose exec solver pytest

# Run all tests
docker compose exec node npm test && docker compose exec solver pytest
```

## 🔧 Development

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Start Node.js server
npm run dev

# Start Python solver (in another terminal)
cd solver
pip install -r requirements.txt
python main.py
```

### Database Management

```bash
# Reset database
rm -rf data/
npm run seed

# View database
sqlite3 data/tasks.db
```

## 📊 API Endpoints

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Scheduling
- `POST /api/schedule/plan` - Generate schedule
- `POST /api/schedule/apply` - Apply schedule
- `GET /api/blocks` - List scheduled blocks

### AI
- `POST /api/ai/parse` - Parse natural language
- `POST /api/ai/coach` - Get AI advice

## 🐛 Troubleshooting

### Common Issues

1. **"Solver service unavailable"**
   - Check if Python solver is running: `docker compose ps`
   - Restart: `docker compose restart solver`

2. **"AI parsing failed"**
   - Verify API key in `.env`
   - Check internet connection
   - Try fallback parsing (no API key needed)

3. **"Database locked"**
   - Stop all services: `docker compose down`
   - Remove database: `rm -rf data/`
   - Restart: `docker compose up --build`

4. **Port conflicts**
   - Change ports in `docker-compose.yml`
   - Update `SOLVER_URL` in `.env`

### Logs

```bash
# View all logs
docker compose logs

# View specific service logs
docker compose logs node
docker compose logs solver
```

## 🔒 Security

- API keys stored in environment variables
- Rate limiting on API endpoints
- CORS configured for localhost
- No sensitive data in logs

## 📈 Performance

- SQLite with WAL mode for concurrent access
- OR-Tools CP-SAT for optimal scheduling
- Efficient 15-minute time slots
- Caching for repeated AI requests

## 🚀 Deployment

### Production Setup

1. Update environment variables for production
2. Use PostgreSQL instead of SQLite
3. Add reverse proxy (nginx)
4. Set up SSL certificates
5. Configure monitoring and logging

### Docker Production

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Deploy
docker compose -f docker-compose.prod.yml up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check troubleshooting section above
- Open GitHub issue for bugs
- Contact: [your-email@domain.com]

---

**Built with ❤️ for productivity enthusiasts**