# Electron Security Scanner

A desktop security scanning application built with Electron, React, and TypeScript. It combines CDP (Chrome DevTools Protocol), OWASP ZAP, and Nuclei for comprehensive web application security scanning.

## Features

- **Multi-Browser Support**: Electron and Playwright integration for browser automation
- **ZAP Integration**: OWASP ZAP proxy for passive and active scanning
- **Nuclei Scanning**: Template-based vulnerability detection
- **Session Management**: Capture and replay authenticated sessions
- **Asset Discovery**: Subdomain enumeration and API discovery
- **Report Generation**: Export scan results in various formats
- **DefectDojo Integration**: Upload findings to DefectDojo for tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  (Browser Service, Session Manager, Credential Manager)     │
├─────────────────────────────────────────────────────────────┤
│                    Electron Renderer Process                 │
│  (React UI, Views, Stores, Components)                      │
├───────────────┬───────────────┬───────────────┬─────────────┤
│  CDP Service  │  ZAP Client   │ Nuclei Exec   │ Asset Disc. │
├───────────────┴───────────────┴───────────────┴─────────────┤
│                    External Tools                            │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐  │
│  │ Chrome  │  │   ZAP    │  │  Nuclei │  │ Subfinder   │  │
│  │ (CDP)   │  │  Proxy   │  │ Scanner │  │   / Amass   │  │
│  └─────────┘  └──────────┘  └─────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js >= 22.0.0
- npm >= 10.0.0
- OWASP ZAP (for proxy scanning)
- Nuclei (for vulnerability scanning)
- Playwright browsers (optional, for browser automation)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd test-server2

# Install dependencies
npm install

# Install external tools (ZAP, Nuclei, etc.)
# See tools/setup.sh for automated setup
```

## Development

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Building

```bash
# Build for development
npm run build

# Build for production (requires electron-forge)
npm run build:prod

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── main/                 # Electron main process
│   ├── index.ts         # Main entry point
│   ├── preload.ts       # Preload script
│   └── browser-preload.ts
├── renderer/            # React frontend
│   ├── App.tsx          # Main app component
│   ├── components/      # Reusable components
│   │   ├── Sidebar.tsx
│   │   └── ProgressBar.tsx
│   ├── views/           # Page views
│   │   ├── Dashboard.tsx
│   │   ├── ScanView.tsx
│   │   ├── ResultsView.tsx
│   │   └── Settings.tsx
│   ├── hooks/           # Custom React hooks
│   └── styles/          # Global styles
├── services/            # Business logic
│   ├── orchestrator.ts  # Scan orchestration
│   ├── browserService.ts
│   ├── cdpService.ts
│   ├── playwrightManager.ts
│   ├── zapClient.ts
│   ├── nucleiExecutor.ts
│   ├── assetDiscovery.ts
│   ├── sessionManager.ts
│   ├── credentialManager.ts
│   ├── reportGenerator.ts
│   └── defectDojoClient.ts
├── stores/              # State management (Zustand)
│   └── index.ts
├── types/               # TypeScript types
│   └── index.ts
└── utils/               # Utility functions
    └── index.ts
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ZAP_PATH` | Path to OWASP ZAP executable | - |
| `NUCLEI_PATH` | Path to Nuclei executable | - |
| `PLAYWRIGHT_BROWSERS_PATH` | Path to Playwright browsers | - |

### Application Settings

Configure through the Settings view:
- ZAP proxy port and options
- Nuclei templates and rate limiting
- Playwright browser settings
- DefectDojo integration
- General preferences

## Scanning Modes

| Mode | Description |
|------|-------------|
| **Quick** | Fast scan with essential checks |
| **Standard** | Balanced scan with ZAP spider and nuclei |
| **Deep** | Comprehensive scan with all tools |
| **Custom** | User-configured scan options |

## API Reference

### Scan Orchestrator

```typescript
import { ScanOrchestrator } from '@services/orchestrator';

const orchestrator = new ScanOrchestrator();

// Configure and start scan
orchestrator.configure({
  targetUrl: 'https://example.com',
  scanType: 'standard',
  authMode: 'none'
});

orchestrator.on('progress', (progress) => {
  console.log(`Phase: ${progress.phase}, Progress: ${progress.progress}%`);
});

orchestrator.start();
```

### ZAP Client

```typescript
import { ZAPClient } from '@services/zapClient';

const zap = new ZAPClient();
await zap.startProxy(8080);
await zap.spider('https://example.com');
const alerts = await zap.getAlerts();
```

### Nuclei Executor

```typescript
import { NucleiExecutor } from '@services/nucleiExecutor';

const nuclei = new NucleiExecutor();
await nuclei.initialize('/path/to/templates');
const findings = await nuclei.scan(['https://example.com']);
```

## Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## External Tool Setup

Use the provided setup script to install and configure external tools:

```bash
# Make setup script executable
chmod +x tools/setup.sh

# Run setup
./tools/setup.sh
```

This script will:
- Download and configure OWASP ZAP
- Install Nuclei
- Set up Playwright browsers
- Configure tool paths

## Tech Stack

- **Electron** - Desktop application framework
- **React 19** - UI library
- **TypeScript 5** - Type safety
- **Vite** - Build tool
- **Zustand** - State management
- **Vitest** - Testing framework
- **Lucide React** - Icons
- **ESLint + Prettier** - Code quality

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request
