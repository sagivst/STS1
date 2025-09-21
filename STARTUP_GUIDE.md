# Startup Guide

## Prerequisites
- Node.js 18+ installed
- Redis server running locally

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Redis (required for caching):**
   ```bash
   # On Ubuntu/Debian:
   sudo systemctl start redis-server
   
   # Or using Docker:
   docker run -d -p 6379:6379 redis:alpine
   ```

3. **Build the application:**
   ```bash
   npm run build
   ```

4. **Start the application:**
   ```bash
   # Development mode (with hot reload):
   npm run dev
   
   # Production mode:
   npm start
   ```

## Environment Configuration

Make sure your `.env` file contains all required API keys:
- `DEEPGRAM_API_KEY` - For speech-to-text
- `DEEPL_API_KEY` - For translation
- `AZURE_SPEECH_KEY` - For text-to-speech
- `AZURE_SPEECH_REGION` - Azure region (e.g., germanywestcentral)

## Testing

Run tests to verify everything is working:
```bash
npm test
```

## Application URLs

- Main application: http://localhost:3000
- Metrics endpoint: http://localhost:9090

## Troubleshooting

1. **Redis connection errors:** Make sure Redis is running on port 6379
2. **API key errors:** Verify all environment variables are set correctly
3. **Build errors:** Run `npm run lint` to check for code issues

## GitHub Codespaces

This project is configured for GitHub Codespaces with automatic setup of all dependencies.
