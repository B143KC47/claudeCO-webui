# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Code Web UI

A comprehensive web-based interface for the Claude CLI tool that provides streaming responses, integrated development tools, session management, and multi-device support.

## Code Quality

This project uses automated quality checks to ensure consistent code standards:

- **Lefthook**: Git hooks manager that runs `make check` before every commit
- **Quality Commands**: Use `make check` to run all quality checks manually  
- **CI/CD**: GitHub Actions runs the same quality checks on every push

The pre-commit hook prevents commits with formatting, linting, or test failures.

### Setup for New Contributors

1. **Install Lefthook**: 
   ```bash
   # macOS
   brew install lefthook
   
   # Or download from https://github.com/evilmartians/lefthook/releases
   ```

2. **Install hooks**:
   ```bash
   lefthook install
   ```

3. **Verify setup**:
   ```bash
   lefthook run pre-commit
   ```

The `.lefthook.yml` configuration is tracked in the repository, ensuring consistent quality checks across all contributors.

## Architecture

This project consists of three main components:

### Backend (Deno)

- **Location**: `backend/`
- **Port**: 8080 (configurable via CLI argument or PORT environment variable)
- **Technology**: Deno with TypeScript + Hono framework
- **Purpose**: Executes `claude` commands and streams JSON responses to frontend

**Key Features**:

- Command line interface with `--port`, `--help`, `--version` options
- Startup validation to check Claude CLI availability
- Executes `claude --output-format stream-json --verbose -p <message>`
- Streams raw Claude JSON responses without modification
- Sets working directory to project root for claude command execution
- Provides CORS headers for frontend communication
- Single binary distribution support
- Session continuity support using Claude Code SDK's resume functionality

**API Endpoints** (25+ endpoints organized by function):

### Core Chat & AI
- `POST /api/chat` - Streaming chat interface with Claude
  - Request: `{ message: string, sessionId?: string, requestId: string, allowedTools?: string[], workingDirectory?: string, thinkingBudget?: number }`
  - Supports thinking mode with configurable token budgets
- `POST /api/abort/:requestId` - Abort ongoing request

### Project Management
- `GET /api/projects` - List available project directories
- `GET /api/projects/:encodedProjectName/histories` - Get project history
- `GET /api/projects/:encodedProjectName/histories/:sessionId` - Get specific conversation

### Session & History
- `GET /api/sessions/:sessionId` - Retrieve saved session
- `POST /api/sessions/:sessionId` - Save session state
- `DELETE /api/sessions/:sessionId` - Delete session
- `GET /api/conversations` - List all conversations
- `GET /api/histories` - Get conversation histories

### Git Operations
- `GET /api/git/status` - Repository status
- `POST /api/git/stage` - Stage files
- `POST /api/git/unstage` - Unstage files
- `POST /api/git/commit` - Create commit
- `POST /api/git/push` - Push changes
- `POST /api/git/pull` - Pull changes
- `GET /api/git/branches` - List branches
- `POST /api/git/checkout` - Switch branches
- `GET /api/git/log` - Commit history
- `GET /api/git/diff` - View changes

### Terminal Integration
- `POST /api/terminal/execute` - Execute commands
- `GET /api/terminal/shells` - List active shells
- `POST /api/terminal/abort/:shellId` - Abort shell command
- `GET /api/terminal/info` - Terminal information
- `POST /api/terminal/validate-path` - Validate file paths

### File Management
- `GET /api/files/list` - Browse directory contents

### MCP Server Management
- `GET /api/mcp/smithery` - Browse available MCP servers
- `POST /api/mcp/install` - Install MCP server
- `DELETE /api/mcp/uninstall` - Remove MCP server
- `GET /api/mcp/config` - Get MCP configuration
- `POST /api/mcp/config` - Update MCP configuration

### Authentication & Devices
- `POST /api/auth/register` - Register new device
- `POST /api/auth/approve` - Approve device access
- `POST /api/auth/reject` - Reject device
- `GET /api/auth/devices` - List connected devices
- `DELETE /api/auth/devices/:deviceId` - Revoke device access

### Usage & Billing
- `GET /api/billing` - Billing information
- `GET /api/usage` - Usage statistics and analytics

### Network & System
- `GET /api/network/urls` - Get connection URLs
- `/*` - Static file serving (single binary mode)

### Frontend (React)

- **Location**: `frontend/`
- **Port**: 3000 (configurable via `--port` CLI argument to `npm run dev`)
- **Technology**: Vite + React + SWC + TypeScript + TailwindCSS + React Router
- **Purpose**: Provides project selection and chat interface with streaming responses

**Key Features**:

- **Project Directory Selection**: Choose working directory before starting chat sessions
- **Routing System**: Separate pages for project selection and chat interface
- Real-time streaming response display with modular message processing
- Parses different Claude JSON message types (system, assistant, result, tool messages)
- TailwindCSS utility-first styling for responsive design
- Light/dark theme toggle with system preference detection and localStorage persistence
- Bottom-to-top message flow layout (messages start at bottom like modern chat apps)
- Auto-scroll to bottom with smart scroll detection (only auto-scrolls when user is near bottom)
- Accessibility features with ARIA attributes for screen readers
- Responsive chat interface with component-based architecture
- Comprehensive component testing with Vitest and Testing Library
- Automatic session tracking for conversation continuity within the same chat instance
- Request abort functionality with real-time cancellation
- Permission dialog handling for Claude tool permissions
- Enhanced error handling and user feedback
- Modular hook architecture for state management and business logic separation
- Reusable UI components with consistent design patterns

### Shared Types

- **Location**: `shared/`
- **Purpose**: TypeScript type definitions shared between backend and frontend

**Core Type Files**:

1. **`shared/types.ts`** - Core API types
   - `StreamResponse` - Streaming response format
   - `ChatRequest` - Enhanced chat request with thinking mode support
   - `ProjectsResponse` - Project directory listing
   - `SessionData` - Session state management

2. **`shared/gitTypes.ts`** - Git operation types
   - `GitStatus`, `GitCommit`, `GitBranch` - Git state types
   - `GitStageRequest`, `GitCommitRequest`, `GitPushRequest` - Operation requests
   - `FileStatus` - File change status enum

3. **`shared/billingTypes.ts`** - Usage and billing types
   - Usage tracking data structures
   - Cost calculation types
   - Analytics response formats

**Frontend-Specific Types** (`frontend/src/types.ts`):
- `ChatMessage`, `SystemMessage`, `ToolMessage` - UI message types
- `PermissionRequest` - Tool permission handling
- Terminal, file browser, and demo-related types

## Claude Command Integration

The backend uses the Claude Code SDK to execute claude commands. The SDK internally handles the claude command execution with appropriate parameters including:

- `--output-format stream-json` - Returns streaming JSON responses
- `--verbose` - Includes detailed execution information
- `-p <message>` - Prompt mode with user message

The SDK returns three types of JSON messages:

1. **System messages** (`type: "system"`) - Initialization and setup information
2. **Assistant messages** (`type: "assistant"`) - Actual response content
3. **Result messages** (`type: "result"`) - Execution summary with costs and usage

## Session Continuity

The application supports conversation continuity within the same chat session using Claude Code SDK's built-in session management.

### How It Works

1. **Initial Message**: First message in a chat session starts a new Claude session
2. **Session Tracking**: Frontend automatically extracts `session_id` from incoming SDK messages
3. **Continuation**: Subsequent messages include the `session_id` to maintain conversation context
4. **Backend Integration**: Backend passes `session_id` to Claude Code SDK via `options.resume` parameter

### Technical Implementation

- **Frontend**: Tracks `currentSessionId` state and includes it in API requests
- **Backend**: Accepts optional `sessionId` in `ChatRequest` and uses it with SDK's `resume` option
- **Streaming**: Session IDs are extracted from all SDK message types (`system`, `assistant`, `result`)
- **Automatic**: No user intervention required - session continuity is handled transparently

### Benefits

- **Context Preservation**: Maintains conversation context across multiple messages
- **Improved UX**: Users can reference previous messages and build on earlier discussions
- **Efficient**: Leverages Claude Code SDK's native session management
- **Seamless**: Works automatically without user configuration

## Mobile Device Authentication

The application supports secure mobile device connections through both LAN and WAN with an authorization flow.

### Features

1. **Device Registration**: Mobile devices can register with a name and type
2. **Authorization Flow**: Desktop users approve/reject device access requests
3. **Token Authentication**: Approved devices receive JWT tokens for API access
4. **Device Management**: View and revoke connected devices in Settings
5. **Network Discovery**: Automatic LAN/WAN URL detection for easy connection
6. **Rate Limiting**: Protection against brute force attempts

### How to Connect a Mobile Device

1. **On Desktop**: Navigate to Settings → Devices to see connection URLs
2. **On Mobile**: Open browser and navigate to one of the provided URLs
3. **Register Device**: Enter a device name (e.g., "John's iPhone")
4. **Authorization**: A popup appears on desktop asking "Is this your device?"
5. **Approve**: Click "Approve" to grant access
6. **Connected**: Mobile device receives authentication token

### API Authentication

Mobile devices use Bearer token authentication:

```javascript
fetch('http://server:8080/api/chat', {
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ message: 'Hello' })
})
```

### Security Features

- **JWT Tokens**: 30-day expiration with HMAC-SHA256 signing
- **Rate Limiting**: 5 requests per minute on auth endpoints
- **Device Tracking**: IP address and user agent logging
- **Revocation**: Instant access revocation from Settings
- **SQLite Storage**: Secure local database for device records


## Integrated Development Tools

The application includes comprehensive development tools accessible through the toolbar:

### Terminal Integration
- Execute shell commands with real-time output streaming
- Manage multiple shell sessions
- Path validation and security checks
- Command history and session persistence

### File Explorer
- Browse project directories
- Navigate file system with breadcrumb trail
- File type icons and metadata display
- Quick file operations

### Git Panel
- Full git workflow support (status, stage, commit, push, pull)
- Branch management and switching
- Visual diff viewer
- Commit history with detailed information
- Conflict resolution assistance

### Browser Panel (Demo Automation)
- Automated demo recording and playback
- Browser automation for testing
- Screenshot capabilities
- User interaction simulation

## MCP Tools Integration

### Built-in MCP Tools

#### 1. Context7 Tool

A context management tool that helps Claude maintain and query extended context across conversations:

```typescript
// MCP tool definition
{
  name: "context7",
  description: "Manage and query extended context with 7-level depth analysis",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["store", "retrieve", "analyze", "clear"],
        description: "Action to perform on context"
      },
      key: {
        type: "string",
        description: "Context key for storage/retrieval"
      },
      value: {
        type: "string",
        description: "Context value (for store action)"
      },
      depth: {
        type: "number",
        minimum: 1,
        maximum: 7,
        description: "Analysis depth level"
      }
    },
    required: ["action"]
  }
}
```

**Features**:
- Store context with hierarchical keys
- Retrieve context by key pattern
- Analyze relationships between contexts
- Support for 7 levels of context depth
- Automatic context pruning for memory efficiency

#### 2. Sequential Thinking Tool

Enables Claude to perform structured, step-by-step reasoning:

```typescript
// MCP tool definition
{
  name: "sequential_thinking",
  description: "Execute multi-step reasoning with validation and backtracking",
  inputSchema: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            validation: { type: "string" },
            fallback: { type: "string" }
          }
        },
        description: "Sequence of thinking steps"
      },
      mode: {
        type: "string",
        enum: ["linear", "branching", "iterative"],
        description: "Execution mode for steps"
      },
      maxIterations: {
        type: "number",
        description: "Maximum iterations for iterative mode"
      }
    },
    required: ["steps"]
  }
}
```

**Features**:
- Define reasoning steps with validation criteria
- Support for branching logic paths
- Automatic backtracking on validation failure
- Iteration support for refinement
- Step-by-step execution tracking



### Adding New MCP Tools

To add a new custom MCP tool:

1. **Create Tool Definition**:
```typescript
// backend/mcp/tools/myTool.ts
import { MCPTool } from "../types.ts";

export const myTool: MCPTool = {
  name: "my_tool",
  description: "Tool description",
  inputSchema: {
    type: "object",
    properties: {
      // Define input parameters
    },
    required: ["param1"]
  },
  handler: async (params) => {
    // Implement tool logic
    return {
      success: true,
      result: "Tool output"
    };
  }
};
```

2. **Register Tool**:
```typescript
// backend/mcp/tools/index.ts
import { myTool } from "./myTool.ts";

export const mcpTools = {
  my_tool: myTool,
  // ... other tools
};
```

3. **Tool Integration**:
The MCP server automatically exposes registered tools to Claude through the standard MCP protocol.

### Tool Design Principles

1. **Single Responsibility**: Each tool should have one clear purpose
2. **Validation**: Validate inputs and provide clear error messages
3. **Idempotency**: Tools should be safe to call multiple times
4. **Performance**: Optimize for quick response times
5. **Error Handling**: Graceful degradation with informative errors

### Usage Examples

#### Context7 Usage
```javascript
// Store context
{
  "action": "store",
  "key": "project.requirements.auth",
  "value": "JWT-based authentication required",
  "depth": 3
}

// Retrieve context
{
  "action": "retrieve",
  "key": "project.requirements.*",
  "depth": 2
}

// Analyze relationships
{
  "action": "analyze",
  "key": "project",
  "depth": 7
}
```

#### Sequential Thinking Usage
```javascript
{
  "steps": [
    {
      "description": "Analyze current authentication method",
      "validation": "method identified",
      "fallback": "assume no authentication"
    },
    {
      "description": "Design JWT implementation",
      "validation": "all endpoints covered",
      "fallback": "use basic auth"
    },
    {
      "description": "Implement security measures",
      "validation": "OWASP compliance",
      "fallback": "apply standard security"
    }
  ],
  "mode": "linear"
}
```

### Backend Integration

The MCP tools are integrated into the backend through:

1. **Tool Discovery**: Claude queries available tools on startup
2. **Tool Invocation**: Backend routes tool calls to appropriate handlers
3. **Response Streaming**: Results streamed back to Claude
4. **Error Handling**: Failures reported with context

### Benefits of Custom MCP Tools

1. **Tailored Functionality**: Tools designed for specific project needs
2. **Better Performance**: No external API calls required
3. **Enhanced Privacy**: Data stays within the application
4. **Flexible Evolution**: Easy to modify and extend
5. **Deep Integration**: Access to application state and context

### MCP Server Management

The application provides a complete MCP server management interface:

1. **Server Discovery**: Browse and search Smithery.ai registry
2. **Installation**: One-click installation of MCP servers
3. **Configuration**: Visual configuration editor
4. **Management**: Enable/disable servers, view logs
5. **Integration**: Seamless integration with Claude conversations

## Development

### Prerequisites

- Deno (for backend)
- Node.js (for frontend)
- Claude CLI tool installed and configured

### Port Configuration

The application supports flexible port configuration for development:

#### Unified Backend Port Management

Create a `.env` file in the project root to set the backend port:

```bash
# .env
PORT=9000
```

Both backend startup and frontend proxy configuration will automatically use this port:

```bash
cd backend && deno task dev     # Starts backend on port 9000
cd frontend && npm run dev      # Configures proxy to localhost:9000
```

#### Alternative Configuration Methods

- **Environment Variable**: `PORT=9000 deno task dev`
- **CLI Argument**: `deno run --env-file --allow-net --allow-run --allow-read --allow-env main.ts --port 9000`
- **Frontend Port**: `npm run dev -- --port 4000` (for frontend UI port)

### Running the Application

1. **Start Backend**:

   ```bash
   cd backend
   deno task dev
   ```

2. **Start Frontend**:

   ```bash
   cd frontend
   npm run dev
   ```

3. **Access Application**:
   - Frontend: http://localhost:3000 (or custom port via `npm run dev -- --port XXXX`)
   - Backend API: http://localhost:8080 (or PORT from .env file)
   - Mobile Auth: http://localhost:3000/mobile-auth (accessible from mobile devices)

### WSL2 Networking Configuration

If you're running on WSL2 (Windows Subsystem for Linux), additional setup is required for mobile device access:

#### The Problem

- WSL2 uses a virtual network that requires Windows firewall rules
- Backend defaults to binding on all interfaces (0.0.0.0) for mobile access
- Windows needs port forwarding rules to route traffic from your network to WSL

#### Quick Setup (Windows PowerShell as Administrator)

```powershell
# Run the automated setup script
cd /mnt/c/Users/YOUR_USERNAME/Desktop/project/web-application/claude-code-webui-main
./setup-firewall.ps1
```

This script automatically:
1. Creates Windows Firewall rules for ports 8080 (backend) and 3000 (frontend)
2. Detects your WSL IP address
3. Configures port forwarding from Windows → WSL
4. Shows connection URLs for your mobile device

#### Manual Configuration

If the script doesn't work, configure manually:

**1. Check your WSL IP**:
```bash
ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1
# Example output: 172.27.210.241
```

**2. Check your Windows IP** (on same network as phone):
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"}
# Example output: 192.168.1.100
```

**3. Add Windows Firewall Rules**:
```powershell
# Backend (port 8080)
New-NetFirewallRule -DisplayName "Claude Web UI - Backend" `
    -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow

# Frontend (port 3000)
New-NetFirewallRule -DisplayName "Claude Web UI - Frontend" `
    -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

**4. Configure Port Forwarding**:
```powershell
# Replace <WSL_IP> with your WSL IP from step 1
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=<WSL_IP>
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL_IP>
```

**5. Restart Backend**:
```bash
# Backend now binds to 0.0.0.0 by default
cd backend && deno task dev
```

#### Connecting from Mobile

After setup, your phone can connect using:
- **Windows IP**: `http://192.168.1.100:3000` (recommended)
- **WSL IP**: `http://172.27.210.241:3000` (direct, may not work on all networks)

#### Troubleshooting

**Backend not accessible from phone?**
```bash
# Check if backend is listening on all interfaces
ss -tuln | grep 8080
# Should show: 0.0.0.0:8080 (not 127.0.0.1:8080)
```

**Windows firewall blocking?**
```powershell
# Check firewall rules
Get-NetFirewallRule -DisplayName "Claude Web UI*" | Format-Table Name,Enabled,Action

# Test if port is open
Test-NetConnection -ComputerName localhost -Port 8080
```

**Port forwarding not working?**
```powershell
# View current port forwarding rules
netsh interface portproxy show v4tov4

# Remove and re-add if needed
netsh interface portproxy delete v4tov4 listenport=8080
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=<WSL_IP>
```

**WSL IP keeps changing?**

WSL2 IP addresses can change after Windows restarts. Re-run the setup script or update port forwarding manually.

#### Host Configuration

The backend now accepts a `HOST` environment variable to control binding:

```bash
# Default: 0.0.0.0 (all interfaces - mobile access enabled)
deno task dev

# Localhost only (mobile access disabled)
HOST=127.0.0.1 deno task dev

# Specific interface
HOST=192.168.1.100 deno task dev
```

For persistent configuration, add to `.env` file:
```bash
# .env
HOST=0.0.0.0  # Default for mobile access
PORT=8080
```

### Project Structure

```
├── backend/              # Deno backend server
│   ├── handlers/        # API endpoint handlers (14 files)
│   │   ├── auth.ts      # Device authentication
│   │   ├── billing.ts   # Usage and billing
│   │   ├── chat.ts      # Core chat functionality
│   │   ├── git.ts       # Git operations (19KB)
│   │   ├── terminal.ts  # Terminal integration (22KB)
│   │   ├── files.ts     # File management
│   │   ├── mcp.ts       # MCP server management
│   │   └── ...          # Additional handlers
│   ├── middleware/      # Express-style middleware
│   │   ├── auth.ts      # JWT authentication & rate limiting
│   │   └── config.ts    # Configuration middleware
│   ├── history/         # Conversation history management
│   ├── main.ts          # Application entry (227 lines)
│   ├── args.ts          # CLI argument parsing
│   └── deno.json        # Deno config & dependencies
├── frontend/            # React frontend application  
│   ├── src/
│   │   ├── components/  # UI components (20+ files)
│   │   │   ├── ChatPage.tsx         # Main chat interface
│   │   │   ├── Settings.tsx         # Settings interface
│   │   │   ├── DemoPage.tsx         # Demo automation
│   │   │   ├── HistoryView.tsx      # History browser
│   │   │   ├── toolbar/             # Development tools
│   │   │   │   ├── TerminalPanel.tsx
│   │   │   │   ├── GitPanel.tsx
│   │   │   │   ├── ExplorerPanel.tsx
│   │   │   │   └── BrowserPanel.tsx
│   │   │   ├── settings/            # Settings tabs
│   │   │   │   ├── DeviceTab.tsx
│   │   │   │   ├── MCPTab.tsx
│   │   │   │   ├── BillTab.tsx
│   │   │   │   └── GeneralTab.tsx
│   │   │   └── chat/                # Chat components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── services/    # Service layer
│   │   ├── contexts/    # React contexts
│   │   └── utils/       # Utility functions
│   └── package.json     # Dependencies & scripts
├── shared/              # Shared TypeScript types
│   ├── types.ts         # Core API types
│   ├── gitTypes.ts      # Git operation types
│   └── billingTypes.ts  # Usage tracking types
├── Makefile             # Development commands
├── .lefthook.yml        # Git hooks configuration
└── CLAUDE.md            # This documentation
```

## Key Design Decisions

1. **Raw JSON Streaming**: Backend passes Claude JSON responses without modification to allow frontend flexibility in handling different message types.

2. **Configurable Ports**: Backend port configurable via PORT environment variable or CLI argument, frontend port via CLI argument to allow independent development and deployment.

3. **TypeScript Throughout**: Consistent TypeScript usage across all components with shared type definitions.

4. **TailwindCSS Styling**: Uses @tailwindcss/vite plugin for utility-first CSS without separate CSS files.

5. **Theme System**: Light/dark theme toggle with automatic system preference detection and localStorage persistence.

6. **Project Directory Selection**: Users choose working directory before starting chat sessions, with support for both configured projects and custom directory selection.

7. **Routing Architecture**: React Router separates project selection and chat interfaces for better user experience.

8. **Dynamic Working Directory**: Claude commands execute in user-selected project directories for contextual file access.

9. **Request Management**: Unique request IDs enable request tracking and abort functionality for better user control.

10. **Tool Permission Handling**: Frontend permission dialog allows users to grant/deny tool access with proper state management.

11. **Comprehensive Error Handling**: Enhanced error states and user feedback for better debugging and user experience.

12. **Modular Architecture**: Frontend code is organized into specialized hooks and components for better maintainability and testability.

13. **Separation of Concerns**: Business logic, UI components, and utilities are clearly separated into different modules.

14. **Configuration Management**: Centralized configuration for API endpoints and application constants.

15. **Reusable Components**: Common UI patterns are extracted into reusable components to reduce duplication.

16. **Hook Composition**: Complex functionality is built by composing smaller, focused hooks that each handle a specific concern.

## Claude Code SDK Types Reference

**SDK Types**: `frontend/node_modules/@anthropic-ai/claude-code/sdk.d.ts`

### Common Patterns
```typescript
// Type extraction
const systemMsg = sdkMessage as Extract<SDKMessage, { type: "system" }>;
const assistantMsg = sdkMessage as Extract<SDKMessage, { type: "assistant" }>;
const resultMsg = sdkMessage as Extract<SDKMessage, { type: "result" }>;

// Assistant content access (nested structure!)
for (const item of assistantMsg.message.content) {
  if (item.type === "text") {
    const text = (item as { text: string }).text;
  } else if (item.type === "tool_use") {
    const toolUse = item as { name: string; input: Record<string, unknown> };
  }
}

// System message (no .message property)
console.log(systemMsg.cwd); // Direct access, no nesting
```

### Key Points
- **System**: Fields directly on object (`systemMsg.cwd`, `systemMsg.tools`)
- **Assistant**: Content nested under `message.content` 
- **Result**: Has `subtype` field (`success` | `error_max_turns` | `error_during_execution`)
- **Type Safety**: Always use `Extract<SDKMessage, { type: "..." }>` for narrowing

## Frontend Architecture Benefits

The modular frontend architecture provides several key benefits:

### Code Organization
- **Reduced File Size**: Main App.tsx reduced from 467 to 262 lines (44% reduction)
- **Focused Responsibilities**: Each file has a single, clear purpose
- **Logical Grouping**: Related functionality is organized into coherent modules

### Maintainability
- **Easier Debugging**: Issues can be isolated to specific modules
- **Simplified Testing**: Individual components and hooks can be tested in isolation
- **Clear Dependencies**: Import structure clearly shows component relationships

### Reusability
- **Shared Components**: `MessageContainer` and `CollapsibleDetails` reduce UI duplication
- **Utility Functions**: Common operations are centralized and reusable
- **Configuration**: API endpoints and constants are easily configurable

### Developer Experience
- **Type Safety**: Enhanced TypeScript coverage with stricter type definitions
- **IntelliSense**: Better IDE support with smaller, focused modules
- **Hot Reload**: Faster development cycles with smaller change surfaces

### Performance
- **Bundle Optimization**: Tree-shaking is more effective with modular code
- **Code Splitting**: Easier to implement lazy loading for large features
- **Memory Efficiency**: Reduced memory footprint with focused hooks

## Testing

The project includes comprehensive test suites for both frontend and backend components:

### Frontend Testing

- **Framework**: Vitest with Testing Library
- **Coverage**: Component testing, hook testing, and integration tests
- **Location**: Tests are co-located with source files (`*.test.ts`, `*.test.tsx`)
- **Run**: `make test-frontend` or `cd frontend && npm run test:run`

### Backend Testing  

- **Framework**: Deno's built-in test runner with std/assert
- **Coverage**: Path encoding utilities, API handlers, and integration tests
- **Location**: `backend/pathUtils.test.ts` and other `*.test.ts` files
- **Run**: `make test-backend` or `cd backend && deno task test`

### Unified Testing

- **All Tests**: `make test` - Runs both frontend and backend tests
- **Quality Checks**: `make check` - Includes tests in pre-commit quality validation
- **CI Integration**: GitHub Actions automatically runs all tests on push/PR

## Single Binary Distribution

The project supports creating self-contained executables for all major platforms:

### Local Building

```bash
# Build for current platform
cd backend && deno task build

# Cross-platform builds are handled by GitHub Actions
```

### Automated Releases

- **Trigger**: Push git tags (e.g., `git tag v1.0.0 && git push origin v1.0.0`)
- **Platforms**: Linux (x64/ARM64), macOS (x64/ARM64)
- **Output**: GitHub Releases with downloadable binaries
- **Features**: Frontend is automatically bundled into each binary

## Claude Code Dependency Management

### Current Version Policy

Both frontend and backend use **fixed versions** (without caret `^`) to ensure consistency:

- **Frontend**: `frontend/package.json` - `"@anthropic-ai/claude-code": "1.0.43"`
- **Backend**: `backend/deno.json` imports - `"@anthropic-ai/claude-code": "npm:@anthropic-ai/claude-code@1.0.43"`

### Version Update Procedure

When updating to a new Claude Code version (e.g., 1.0.40):

1. **Check current versions**:
   ```bash
   # Frontend
   grep "@anthropic-ai/claude-code" frontend/package.json
   
   # Backend  
   grep "@anthropic-ai/claude-code" backend/deno.json
   ```

2. **Update Frontend**:
   ```bash
   # Edit frontend/package.json - change version number
   # "@anthropic-ai/claude-code": "1.0.XX"
   cd frontend && npm install
   ```

3. **Update Backend**:
   ```bash
   # Edit backend/deno.json imports - change version number
   # "@anthropic-ai/claude-code": "npm:@anthropic-ai/claude-code@1.0.XX"
   cd backend && rm deno.lock && deno cache main.ts
   ```

4. **Verify and test**:
   ```bash
   make check
   ```

### Version Consistency Check

Ensure both environments use the same version:
```bash
# Should show the same version number
grep "@anthropic-ai/claude-code" frontend/package.json backend/deno.json
```

## Commands

### Primary Development Commands (from project root)

```bash
# Quality & Testing
make check              # Run all quality checks (format, lint, typecheck, test)
make test              # Run all tests (frontend + backend)
make format            # Format all code
make lint              # Lint all code
make typecheck         # Type check all code

# Development
make dev-backend       # Start backend server (port 8080 or PORT env)
make dev-frontend      # Start frontend dev server (port 3000)

# Building
make build             # Build complete application
make build-frontend    # Build frontend only
make build-backend     # Build backend binary

# Utilities
make install           # Install frontend dependencies
make clean             # Clean build artifacts
make format-files FILES="file1 file2"  # Format specific files
```

### Backend Commands

```bash
cd backend
deno task dev          # Development with --watch and --debug
deno task build        # Create single binary
deno task test         # Run tests
deno task format       # Format code
deno task lint         # Lint code
deno task check        # Type check
```

### Frontend Commands

```bash
cd frontend
npm run dev            # Development server
npm run dev:wsl        # WSL development (bind 0.0.0.0)
npm run build          # Production build
npm run test           # Run tests with watch
npm run test:run       # Run tests once
npm run format         # Format code
npm run lint           # Lint code
npm run typecheck      # Type check
npm run record-demo    # Record browser demo
```

**Note**: Lefthook automatically runs `make check` before every commit. GitHub Actions will also run all quality checks on push and pull requests.

## Development Workflow

### Pull Request Process

1. Create a feature branch from `main`: `git checkout -b feature/your-feature-name`
2. Make your changes and commit them (Lefthook runs `make check` automatically)
3. Push your branch and create a pull request
4. **Add appropriate labels** to categorize the changes (see Labels section below)
5. **Include essential PR information** as outlined in the Labels section
6. Request review and address feedback
7. Merge after approval and CI passes

#### Creating Pull Requests

Create pull requests with appropriate labels and essential information:

```bash
gh pr create --title "Your PR Title" \
  --label "appropriate,labels" \
  --body "Brief description"
```

**Note**: CHANGELOG.md is now automatically managed by tagpr - no manual updates needed!

### Labels

The project uses the following labels for categorizing pull requests and issues:

- 🐛 **`bug`** - Bug fixes (non-breaking changes that fix issues)
- ✨ **`feature`** - New features (non-breaking changes that add functionality)
- 💥 **`breaking`** - Breaking changes (changes that would cause existing functionality to not work as expected)
- 📚 **`documentation`** - Documentation improvements or additions
- ⚡ **`performance`** - Performance improvements
- 🔨 **`refactor`** - Code refactoring (no functional changes)
- 🧪 **`test`** - Adding or updating tests
- 🔧 **`chore`** - Maintenance, dependencies, tooling updates
- 🖥️ **`backend`** - Backend-related changes
- 🎨 **`frontend`** - Frontend-related changes

**For Claude**: When creating PRs, always include:

1. **Type of Change checkboxes**: Include the checkbox list from the template to categorize changes:
   ```
   - [ ] 🐛 `bug` - Bug fix (non-breaking change which fixes an issue)
   - [ ] ✨ `feature` - New feature (non-breaking change which adds functionality)
   - [ ] 💥 `breaking` - Breaking change
   - [ ] 📚 `documentation` - Documentation update
   - [ ] ⚡ `performance` - Performance improvement
   - [ ] 🔨 `refactor` - Code refactoring
   - [ ] 🧪 `test` - Adding or updating tests
   - [ ] 🔧 `chore` - Maintenance, dependencies, tooling
   - [ ] 🖥️ `backend` - Backend-related changes
   - [ ] 🎨 `frontend` - Frontend-related changes
   ```
2. **Description**: Brief summary of what changed and why
3. **GitHub labels**: Add corresponding labels using `--label` flag: `gh pr create --label "feature,documentation"`
4. **Test plan**: Include testing information if relevant

Multiple labels can be applied if the PR covers multiple areas.

### Release Process (Automated with tagpr)

1. **Feature PRs merged to main** → tagpr automatically creates/updates release PR
2. **Add version labels** to PRs if needed:
   - No label = patch version (v1.0.0 → v1.0.1)
   - `minor` label = minor version (v1.0.0 → v1.1.0)
   - `major` label = major version (v1.0.0 → v2.0.0)
3. **Review and merge release PR** → tagpr creates git tag automatically
4. **GitHub Actions builds binaries** and creates GitHub Release automatically
5. Update documentation if needed

**Manual override**: Edit `backend/VERSION` file directly if specific version needed

### GitHub Sub-Issues API

**For Claude**: When creating sub-issues to break down larger features:

```bash
# 1. Create the sub-issue normally
gh issue create --title "Sub-issue title" --body "..." --label "feature,enhancement"

# 2. Get the sub-issue ID
SUB_ISSUE_ID=$(gh api repos/owner/repo/issues/ISSUE_NUMBER --jq '.id')

# 3. Add it as sub-issue to parent issue
gh api repos/owner/repo/issues/PARENT_ISSUE_NUMBER/sub_issues \
  --method POST \
  --field sub_issue_id=$SUB_ISSUE_ID

# 4. Verify the relationship
gh api repos/owner/repo/issues/PARENT_ISSUE_NUMBER/sub_issues
```

**Key points**:
- Use issue **ID** (not number) for `sub_issue_id` parameter
- Endpoint is `/sub_issues` (plural) for POST operations
- Parent issue will show `sub_issues_summary` with total/completed counts
- Sub-issues automatically link to parent in GitHub UI

### Viewing Copilot Review Comments

**For Claude**: Copilot inline review comments are not shown in regular `gh pr view` output. To see them:

```bash
# View all inline review comments from Copilot
gh api repos/owner/repo/pulls/PR_NUMBER/comments

# Example for this repository
gh api repos/sugyan/claude-code-webui/pulls/39/comments
```

**Why this matters**:
- Copilot provides valuable code improvement suggestions
- These comments include security, performance, and code quality feedback
- They appear as inline comments on specific lines of code
- Missing these can lead to suboptimal code being merged
- Always check for Copilot feedback when reviewing PRs

## Important Guidelines

### Command Execution
- **Always run commands from the project root directory**
- When using `cd`, use absolute paths: `cd /mnt/c/Users/ko202/Desktop/project/web-application/claude-code-webui-main/backend`
- Use `make` commands when possible for consistency

### Code Quality
- **Pre-commit hooks are enforced** - `make check` runs automatically
- All code must pass format, lint, typecheck, and tests
- Follow existing patterns and conventions in the codebase

### API Development
- New endpoints go in `backend/handlers/`
- Add corresponding types to `shared/` directory
- Update frontend service layer when adding APIs
- Include proper error handling and validation

### Testing
- Write tests for new features
- Tests are co-located with source files
- Use Vitest for frontend, Deno test for backend
- Run `make test` before committing

### Security
- JWT tokens for authentication (30-day expiry)
- Rate limiting on sensitive endpoints
- Input validation on all API endpoints
- Never commit secrets or API keys
