import type {
  ChatMessage,
  SystemMessage,
  ToolMessage,
  ToolResultMessage,
} from "../types";
import { TimestampComponent } from "./TimestampComponent";
import { MessageContainer } from "./messages/MessageContainer";
import { CollapsibleDetails } from "./messages/CollapsibleDetails";
import { MESSAGE_CONSTANTS } from "../utils/constants";

// Tool style detection
type ToolStyle = "mcp" | "todo" | "thinking" | "write" | "read" | "default";

function detectToolStyle(toolName: string, content?: string): ToolStyle {
  const lowerName = toolName.toLowerCase();
  const lowerContent = content?.toLowerCase() || "";
  
  // MCP tool detection
  if (lowerName.startsWith("mcp__") || lowerName.includes("mcp")) {
    return "mcp";
  }
  
  // Todo list detection
  if (lowerName.includes("todo") || lowerContent.includes("todo")) {
    return "todo";
  }
  
  // Thinking detection
  if (lowerContent.includes("thinking") || lowerContent.includes("analyzing") || 
      lowerContent.includes("considering") || lowerContent.includes("planning")) {
    return "thinking";
  }
  
  // Write operations
  if (lowerName.includes("write") || lowerName.includes("edit") || 
      lowerName.includes("create") || lowerName.includes("multi_edit")) {
    return "write";
  }
  
  // Read operations  
  if (lowerName.includes("read") || lowerName.includes("glob") || 
      lowerName.includes("grep") || lowerName.includes("ls") ||
      lowerName.includes("search") || lowerName.includes("find")) {
    return "read";
  }
  
  return "default";
}

// Style configurations for different tool types
const TOOL_STYLES: Record<ToolStyle, { 
  icon: string; 
  iconBg: string;
  colorScheme: string;
  headerClass: string;
  badge?: string;
}> = {
  mcp: {
    icon: "🔌",
    iconBg: "bg-gradient-to-br from-purple-500 to-pink-500",
    colorScheme: "bg-gradient-to-br from-purple-900/20 to-pink-900/20 text-purple-300 border-purple-500/30",
    headerClass: "text-purple-400",
    badge: "MCP"
  },
  todo: {
    icon: "✓",
    iconBg: "bg-gradient-to-br from-green-500 to-emerald-500",
    colorScheme: "bg-gradient-to-br from-green-900/20 to-emerald-900/20 text-green-300 border-green-500/30",
    headerClass: "text-green-400",
    badge: "TODO"
  },
  thinking: {
    icon: "💭",
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
    colorScheme: "bg-gradient-to-br from-blue-900/20 to-cyan-900/20 text-blue-300 border-blue-500/30",
    headerClass: "text-blue-400",
    badge: "THINKING"
  },
  write: {
    icon: "✏️",
    iconBg: "bg-gradient-to-br from-yellow-500 to-orange-500",
    colorScheme: "bg-gradient-to-br from-yellow-900/20 to-orange-900/20 text-yellow-300 border-yellow-500/30",
    headerClass: "text-yellow-400",
    badge: "WRITE"
  },
  read: {
    icon: "📖",
    iconBg: "bg-gradient-to-br from-indigo-500 to-purple-500",
    colorScheme: "bg-gradient-to-br from-indigo-900/20 to-purple-900/20 text-indigo-300 border-indigo-500/30",
    headerClass: "text-indigo-400",
    badge: "READ"
  },
  default: {
    icon: "🔧",
    iconBg: "bg-accent",
    colorScheme: "bg-black-quaternary text-accent border-accent",
    headerClass: "text-accent"
  }
};

interface ChatMessageComponentProps {
  message: ChatMessage;
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  const isUser = message.role === "user";
  const colorScheme = isUser
    ? "bg-gradient-primary text-primary"
    : "bg-black-quaternary text-primary border-accent";

  // Check if assistant message contains thinking patterns
  const isThinking = !isUser && (
    message.content.toLowerCase().includes("let me think") ||
    message.content.toLowerCase().includes("analyzing") ||
    message.content.toLowerCase().includes("considering") ||
    message.content.toLowerCase().includes("i'll examine")
  );

  return (
    <MessageContainer
      alignment={isUser ? "right" : "left"}
      colorScheme={isUser ? colorScheme : (isThinking 
        ? "bg-gradient-to-br from-blue-900/20 to-cyan-900/20 text-blue-300 border-blue-500/30"
        : colorScheme
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-4">
        <div
          className={`text-xs font-semibold opacity-90 flex items-center gap-2 ${
            isUser ? "text-primary" : (isThinking ? "text-blue-400" : "text-accent")
          }`}
        >
          {isUser ? "User" : (
            <>
              {isThinking && (
                <span className="w-5 h-5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs shadow-lg animate-pulse">
                  💭
                </span>
              )}
              Claude
            </>
          )}
        </div>
        <TimestampComponent
          timestamp={message.timestamp}
          className={`text-xs opacity-70 ${
            isUser ? "text-primary" : "text-tertiary"
          }`}
        />
      </div>
      <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
        {message.content}
      </pre>
    </MessageContainer>
  );
}

interface SystemMessageComponentProps {
  message: SystemMessage;
}

export function SystemMessageComponent({
  message,
}: SystemMessageComponentProps) {
  // Generate details based on message type and subtype
  const getDetails = () => {
    if (message.type === "system" && message.subtype === "init") {
      return [
        `Model: ${message.model}`,
        `Session: ${message.session_id.substring(0, MESSAGE_CONSTANTS.SESSION_ID_DISPLAY_LENGTH)}`,
        `Tools: ${message.tools.length} available`,
        `CWD: ${message.cwd}`,
        `Permission Mode: ${message.permissionMode}`,
        `API Key Source: ${message.apiKeySource}`,
      ].join("\n");
    } else if (message.type === "result") {
      const details = [
        `Duration: ${message.duration_ms}ms`,
        `Cost: $${message.total_cost_usd.toFixed(4)}`,
        `Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`,
      ];
      return details.join("\n");
    } else if (message.type === "error") {
      return message.message;
    }
    return JSON.stringify(message, null, 2);
  };

  // Get label based on message type
  const getLabel = () => {
    if (message.type === "system") return "System";
    if (message.type === "result") return "Result";
    if (message.type === "error") return "Error";
    return "Message";
  };

  const details = getDetails();

  return (
    <CollapsibleDetails
      label={getLabel()}
      details={details}
      badge={message.subtype}
      icon={<span className="bg-accent">⚙</span>}
      colorScheme={{
        header: "text-accent",
        content: "text-secondary",
        border: "border-accent",
        bg: "glass-card",
      }}
    />
  );
}

interface ToolMessageComponentProps {
  message: ToolMessage;
}

export function ToolMessageComponent({ message }: ToolMessageComponentProps) {
  // Extract tool name from content (format: "ToolName(args...)")
  const toolNameMatch = message.content.match(/^([^(]+)/);
  const toolName = toolNameMatch ? toolNameMatch[1].trim() : "Tool";
  const toolStyle = detectToolStyle(toolName, message.content);
  const style = TOOL_STYLES[toolStyle];
  
  return (
    <MessageContainer
      alignment="left"
      colorScheme={style.colorScheme}
      className={`tool-message-${toolStyle} relative`}
    >
      <div className={`text-xs font-semibold mb-2 opacity-90 ${style.headerClass} flex items-center gap-2`}>
        <div className={`w-5 h-5 ${style.iconBg} rounded-full flex items-center justify-center text-white text-xs shadow-lg`}>
          {style.icon}
        </div>
        {style.badge && (
          <span className={`tool-badge text-[10px] px-2 py-0.5 rounded-full ${style.iconBg} text-white font-bold uppercase tracking-wide`}>
            {style.badge}
          </span>
        )}
        <span className="flex-1">{message.content}</span>
      </div>
    </MessageContainer>
  );
}

interface ToolResultMessageComponentProps {
  message: ToolResultMessage;
}

export function ToolResultMessageComponent({
  message,
}: ToolResultMessageComponentProps) {
  const toolStyle = detectToolStyle(message.toolName, message.content);
  const style = TOOL_STYLES[toolStyle];
  
  // Special formatting for todo list results
  if (toolStyle === "todo" && message.content.includes("[{")) {
    try {
      const todos = JSON.parse(message.content);
      const formattedContent = todos.map((todo: any) => 
        `${todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '⏳' : '○'} [${todo.priority}] ${todo.content}`
      ).join('\n');
      
      return (
        <CollapsibleDetails
          label={`${style.icon} ${message.toolName}`}
          details={formattedContent}
          badge={`${todos.length} items`}
          icon={<span className={style.iconBg}>✓</span>}
          colorScheme={{
            header: style.headerClass,
            content: "text-secondary font-mono",
            border: style.colorScheme.match(/border-[^\s]+/)?.[0] || "border-accent",
            bg: "glass-card backdrop-blur-md",
          }}
          className="tool-result-details"
        />
      );
    } catch (e) {
      // Fall through to default rendering
    }
  }
  
  return (
    <CollapsibleDetails
      label={`${style.icon} ${message.toolName}`}
      details={message.content}
      badge={message.summary}
      icon={<span className={style.iconBg}>✓</span>}
      colorScheme={{
        header: style.headerClass,
        content: "text-secondary",
        border: style.colorScheme.match(/border-[^\s]+/)?.[0] || "border-accent",
        bg: "glass-card backdrop-blur-md",
      }}
      className="tool-result-details"
    />
  );
}

export function LoadingComponent() {
  return (
    <MessageContainer
      alignment="left"
      colorScheme="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 text-blue-300 border-blue-500/30"
    >
      <div className="text-xs font-semibold mb-2 opacity-90 text-blue-400 flex items-center gap-2">
        <span className="w-5 h-5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs shadow-lg animate-pulse">
          💭
        </span>
        Claude
      </div>
      <div className="flex items-center gap-2 text-sm">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="animate-pulse text-blue-400">Thinking...</span>
      </div>
    </MessageContainer>
  );
}
