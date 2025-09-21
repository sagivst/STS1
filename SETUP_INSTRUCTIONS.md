# Simultaneous Translation Solution - Setup Instructions

## Overview
This is a complete implementation of a real-time English ⇄ Japanese translation solution for sales calls with <2 second end-to-end latency using:
- **Deepgram Nova-3** for Speech-to-Text (STT)
- **DeepL API** for Machine Translation (MT) 
- **Azure Neural TTS** for Text-to-Speech (TTS)

## GitHub Repository Setup

Since I don't have permissions to create repositories in your GitHub account, please follow these steps:

### 1. Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `simultaneous-translation-solution`
3. Description: `Real-time English ⇄ Japanese translation solution for sales calls with <2s latency using Deepgram STT, DeepL translation, and Azure TTS`
4. Set to **Public**
5. **Do NOT** initialize with README, .gitignore, or license (we have these files)
6. Click "Create repository"

### 2. Upload Project Files
1. Download the project archive: `simultaneous-translation-solution.tar.gz`
2. Extract the archive locally
3. Navigate to the extracted folder in terminal
4. Run these commands (replace `YOUR_USERNAME` with your GitHub username):

```bash
git remote add origin https://github.com/YOUR_USERNAME/simultaneous-translation-solution.git
git push -u origin devin/1726923230-simultaneous-translation-solution
```

### 3. Create Pull Request
1. Go to your repository on GitHub
2. You'll see a banner to "Compare & pull request" for the new branch
3. Click it and create the PR with title: "feat: implement simultaneous translation solution"

## API Keys Setup

You'll need to obtain API keys from these services:

### Deepgram (STT)
1. Sign up at https://deepgram.com
2. Go to API Keys section in dashboard
3. Create a new API key
4. **Note**: Requires credit card even for free tier ($200 free credit)

### DeepL (Translation)
1. Sign up at https://www.deepl.com/pro-api
2. Choose the free plan (500,000 characters/month)
3. Get your API key from the dashboard
4. **Note**: No credit card required for free tier

### Azure Speech (TTS)
1. Sign up for Azure Portal
2. Create a "Speech Service" resource
3. Get the API key and region from the resource
4. **Note**: Requires credit card even for free tier (5 hours free monthly)

### Environment Configuration
1. Copy `.env.example` to `.env`
2. Fill in your API keys:

```env
# Deepgram Configuration
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# DeepL Configuration  
DEEPL_API_KEY=your_deepl_api_key_here
DEEPL_API_URL=https://api-free.deepl.com

# Azure Speech Configuration
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here

# Server Configuration
PORT=3000
NODE_ENV=development

# Redis Configuration (for local development)
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# Performance Configuration
MAX_CONCURRENT_SESSIONS=50
```

## GitHub Codespaces Setup

The project is pre-configured for GitHub Codespaces:

1. Go to your repository on GitHub
2. Click the green "Code" button
3. Select "Codespaces" tab
4. Click "Create codespace on main"

The devcontainer will automatically:
- Set up Node.js 22 environment
- Install all dependencies
- Configure VS Code extensions
- Start Redis server
- Forward necessary ports (3000, 6379, 9090)

## Local Development

### Prerequisites
- Node.js 18+ 
- Redis server
- Docker (optional)

### Setup
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

### Docker Setup
```bash
# Start with Docker Compose (includes Redis)
docker-compose up -d

# Or build and run manually
docker build -t sts-solution .
docker run -p 3000:3000 --env-file .env sts-solution
```

## Architecture Overview

### Core Components
- **WebSocket Server**: Real-time bidirectional communication
- **STT Service**: Deepgram integration for speech recognition
- **Translation Service**: DeepL integration for text translation  
- **TTS Service**: Azure Speech integration for voice synthesis
- **Session Manager**: Handles concurrent user sessions
- **Cache Layer**: Redis-based multi-level caching

### Performance Targets
- **STT Latency**: ≤1.0 seconds
- **Translation Latency**: ≤0.3 seconds  
- **TTS Latency**: ≤0.6 seconds
- **End-to-End**: ≤1.8 seconds average
- **Concurrent Sessions**: 50+ simultaneous users
- **Uptime**: 99.5% during business hours

### Security Features
- JWT-based authentication
- Role-based access control
- No persistent transcript storage (in-memory only)
- TLS 1.3 encryption
- Comprehensive audit logging

## Project Structure
```
src/
├── app.ts                 # Express application setup
├── server.ts             # WebSocket server and startup
├── config/
│   └── environment.ts    # Configuration management
├── services/
│   ├── stt.ts           # Deepgram STT integration
│   ├── translation.ts   # DeepL translation service
│   ├── tts.ts           # Azure TTS integration
│   └── session.ts       # Session management
├── middleware/
│   ├── auth.ts          # Authentication middleware
│   ├── validation.ts    # Request validation
│   └── monitoring.ts    # Performance monitoring
├── utils/
│   ├── logger.ts        # Winston logging
│   ├── cache.ts         # Redis caching
│   └── errors.ts        # Custom error classes
└── types/
    └── index.ts         # TypeScript definitions
```

## Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Monitoring

Prometheus metrics are available at `/metrics` endpoint when running.

## Support

For issues or questions about this implementation, please create an issue in the GitHub repository.

---

**Implementation by**: Devin AI  
**Devin Run**: https://app.devin.ai/sessions/f78768acbdf044bf9de7c70e0dc4fea4  
**Requested by**: @sagivst
