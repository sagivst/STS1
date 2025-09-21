# Simultaneous Translation Solution (STS)

A real-time English ⇄ Japanese translation solution for sales calls, designed specifically for CFD and financial services. The system provides bidirectional translation with sub-2-second latency using WebSocket streaming architecture.

## 🚀 Quick Start with GitHub Codespaces

This project is optimized for GitHub Codespaces with automatic setup and configuration.

### Prerequisites

Before starting, you'll need API keys for:
- **Deepgram** (Speech-to-Text): [Get API key](https://deepgram.com)
- **DeepL** (Translation): [Get API key](https://www.deepl.com/pro-api)
- **Azure Speech** (Text-to-Speech): [Get API key](https://portal.azure.com)

### Setup in Codespaces

1. **Open in Codespaces**: Click the "Code" button and select "Create codespace on main"

2. **Configure Environment**: Copy the example environment file and add your API keys:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Install Dependencies** (automatically done by devcontainer):
   ```bash
   npm install
   ```

4. **Start the Application**:
   ```bash
   npm run dev
   ```

The application will be available on port 3000, automatically forwarded by Codespaces.

## 🏗️ Architecture

### Core Components

- **Speech-to-Text (STT)**: Deepgram Nova-3 model for real-time transcription
- **Machine Translation (MT)**: DeepL API for high-accuracy contextual translation  
- **Text-to-Speech (TTS)**: Azure Neural TTS for natural voice synthesis
- **Session Management**: Redis-backed session state with automatic cleanup
- **WebSocket Server**: Node.js with Express.js for real-time communication

### Technology Stack

- **Runtime**: Node.js 22.x LTS
- **Framework**: Express.js 5.1.0
- **WebSocket**: ws 8.18.3
- **Language**: TypeScript
- **Cache**: Redis 7.x
- **Monitoring**: Prometheus + Winston logging

## 🔧 API Documentation

### Health Check
```bash
GET /health
```

### Authentication
```bash
POST /auth/token
Content-Type: application/json

{
  "userId": "user123"
}
```

### WebSocket Connection
```
ws://localhost:3000?token=<jwt_token>&sessionId=<session_id>
```

## 📊 Performance Targets

- **STT Latency**: ≤1.0 seconds with >95% accuracy
- **Translation Latency**: ≤0.3 seconds with >95% accuracy
- **TTS Latency**: ≤0.6 seconds with professional tone
- **End-to-End Latency**: ≤1.8 seconds average
- **Concurrent Sessions**: 50+ simultaneous translations
- **Availability**: 99.5% uptime during business hours

## 🔒 Security Features

- **Authentication**: JWT tokens with role-based access
- **Encryption**: TLS 1.3 for HTTP, WSS for WebSocket
- **Data Privacy**: No persistent transcript storage
- **API Security**: Rate limiting and input validation
- **Compliance**: Audit logging for regulatory requirements

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm test             # Run tests
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Project Structure

```
src/
├── app.ts              # Express application setup
├── server.ts           # WebSocket server and main entry
├── config/
│   └── environment.ts  # Configuration management
├── services/
│   └── session.ts      # Session management
├── middleware/
│   └── auth.ts         # JWT authentication
├── utils/
│   ├── logger.ts       # Winston logging setup
│   ├── cache.ts        # Redis caching utilities
│   └── errors.ts       # Custom error classes
└── types/
    └── index.ts        # TypeScript definitions
```

## 🐳 Docker Support

The project includes Docker configuration for containerized deployment:

```bash
# Build and run with Docker Compose
docker-compose up -d
```

This starts:
- Translation service on port 3000
- Redis on port 6379
- Prometheus monitoring on port 9090

## 📈 Monitoring

### Key Metrics
- Translation latency and throughput
- Active session count
- Error rates and types
- Memory and CPU usage

### Endpoints
- **Health**: `GET /health`
- **Metrics**: `GET /metrics` (Prometheus format)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run quality checks: `npm run lint && npm test`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For technical support:
- Check the troubleshooting section in the full README
- Review application logs in the `logs/` directory
- Monitor system metrics via `/metrics` endpoint
- Contact the development team

---

**Note**: This is a proof-of-concept implementation. For production deployment, ensure proper API key management, security hardening, and infrastructure scaling.
