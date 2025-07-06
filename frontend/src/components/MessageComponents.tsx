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
import { useLanguage } from "../contexts/LanguageContext";

// Tool style detection - matches all Claude Code tools
type ToolStyle =
  | "mcp"
  | "todo"
  | "task"
  | "web"
  | "file_write"
  | "file_read"
  | "bash"
  | "notebook"
  | "exit"
  | "thinking"
  | "default";

// Map of exact tool names to their categories
const TOOL_CATEGORIES: Record<string, ToolStyle> = {
  // Task management
  Task: "task",
  TodoRead: "todo",
  TodoWrite: "todo",
  exit_plan_mode: "exit",

  // File operations
  Read: "file_read",
  Write: "file_write",
  Edit: "file_write",
  MultiEdit: "file_write",

  // Search and navigation
  Glob: "file_read",
  Grep: "file_read",
  LS: "file_read",

  // Web operations
  WebSearch: "web",
  WebFetch: "web",

  // Notebook operations
  NotebookRead: "notebook",
  NotebookEdit: "notebook",

  // System operations
  Bash: "bash",
};

function detectToolStyle(toolName: string, content?: string): ToolStyle {
  // First check exact matches
  if (TOOL_CATEGORIES[toolName]) {
    return TOOL_CATEGORIES[toolName];
  }

  const lowerName = toolName.toLowerCase();
  const lowerContent = content?.toLowerCase() || "";

  // MCP tool detection
  if (lowerName.startsWith("mcp__") || lowerName.includes("mcp")) {
    return "mcp";
  }

  // Thinking detection (from content)
  if (
    lowerContent.includes("thinking") ||
    lowerContent.includes("analyzing") ||
    lowerContent.includes("considering") ||
    lowerContent.includes("planning")
  ) {
    return "thinking";
  }

  return "default";
}

// Style configurations for different tool types
const TOOL_STYLES: Record<
  ToolStyle,
  {
    icon: string;
    iconBg: string;
    colorScheme: string;
    headerClass: string;
    badge?: string;
  }
> = {
  mcp: {
    icon: "🔌",
    iconBg: "bg-gradient-to-br from-purple-500 to-pink-500",
    colorScheme:
      "bg-gradient-to-br from-purple-900/20 to-pink-900/20 text-purple-300 border-purple-500/30",
    headerClass: "text-purple-400",
    badge: "MCP",
  },
  todo: {
    icon: "📋",
    iconBg: "bg-gradient-to-br from-green-500 to-emerald-500",
    colorScheme:
      "bg-gradient-to-br from-green-900/20 to-emerald-900/20 text-green-300 border-green-500/30",
    headerClass: "text-green-400",
    badge: "TODO",
  },
  task: {
    icon: "🚀",
    iconBg: "bg-gradient-to-br from-orange-500 to-red-500",
    colorScheme:
      "bg-gradient-to-br from-orange-900/20 to-red-900/20 text-orange-300 border-orange-500/30",
    headerClass: "text-orange-400",
    badge: "TASK",
  },
  web: {
    icon: "🌐",
    iconBg: "bg-gradient-to-br from-cyan-500 to-blue-500",
    colorScheme:
      "bg-gradient-to-br from-cyan-900/20 to-blue-900/20 text-cyan-300 border-cyan-500/30",
    headerClass: "text-cyan-400",
    badge: "WEB",
  },
  file_write: {
    icon: "✏️",
    iconBg: "bg-gradient-to-br from-yellow-500 to-orange-500",
    colorScheme:
      "bg-gradient-to-br from-yellow-900/20 to-orange-900/20 text-yellow-300 border-yellow-500/30",
    headerClass: "text-yellow-400",
    badge: "WRITE",
  },
  file_read: {
    icon: "📖",
    iconBg: "bg-gradient-to-br from-indigo-500 to-purple-500",
    colorScheme:
      "bg-gradient-to-br from-indigo-900/20 to-purple-900/20 text-indigo-300 border-indigo-500/30",
    headerClass: "text-indigo-400",
    badge: "READ",
  },
  bash: {
    icon: "💻",
    iconBg: "bg-gradient-to-br from-gray-600 to-gray-800",
    colorScheme:
      "bg-gradient-to-br from-gray-900/20 to-gray-800/20 text-gray-300 border-gray-500/30",
    headerClass: "text-gray-400",
    badge: "BASH",
  },
  notebook: {
    icon: "📓",
    iconBg: "bg-gradient-to-br from-pink-500 to-purple-500",
    colorScheme:
      "bg-gradient-to-br from-pink-900/20 to-purple-900/20 text-pink-300 border-pink-500/30",
    headerClass: "text-pink-400",
    badge: "NOTEBOOK",
  },
  exit: {
    icon: "🚪",
    iconBg: "bg-gradient-to-br from-red-500 to-pink-500",
    colorScheme:
      "bg-gradient-to-br from-red-900/20 to-pink-900/20 text-red-300 border-red-500/30",
    headerClass: "text-red-400",
    badge: "EXIT",
  },
  thinking: {
    icon: "💭",
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
    colorScheme:
      "bg-gradient-to-br from-blue-900/20 to-cyan-900/20 text-blue-300 border-blue-500/30",
    headerClass: "text-blue-400",
    badge: "THINKING",
  },
  default: {
    icon: "🔧",
    iconBg: "bg-accent",
    colorScheme: "bg-black-quaternary text-accent border-accent",
    headerClass: "text-accent",
  },
};

interface ChatMessageComponentProps {
  message: ChatMessage;
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  const { t } = useLanguage();
  const isUser = message.role === "user";
  const colorScheme = isUser
    ? "bg-gradient-primary text-primary"
    : "bg-black-quaternary text-primary border-accent";

  // Check if assistant message contains thinking patterns
  const isThinking =
    !isUser &&
    (message.content.toLowerCase().includes("let me think") ||
      message.content.toLowerCase().includes("analyzing") ||
      message.content.toLowerCase().includes("considering") ||
      message.content.toLowerCase().includes("i'll examine"));

  return (
    <MessageContainer
      alignment={isUser ? "right" : "left"}
      colorScheme={
        isUser
          ? colorScheme
          : isThinking
            ? "bg-gradient-to-br from-blue-900/20 to-cyan-900/20 text-blue-300 border-blue-500/30"
            : colorScheme
      }
    >
      <div className="mb-2 flex items-center justify-between gap-4">
        <div
          className={`text-xs font-semibold opacity-90 flex items-center gap-2 ${
            isUser
              ? "text-primary"
              : isThinking
                ? "text-blue-400"
                : "text-accent"
          }`}
        >
          {isUser ? (
            t("message.user")
          ) : (
            <>
              {isThinking && (
                <span className="w-5 h-5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs shadow-lg animate-pulse">
                  💭
                </span>
              )}
              {t("message.claude")}
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
  const { t } = useLanguage();

  // Generate details based on message type and subtype
  const getDetails = () => {
    if (message.type === "system" && message.subtype === "init") {
      return [
        `${t("message.model")}: ${message.model}`,
        `${t("message.session")}: ${message.session_id.substring(0, MESSAGE_CONSTANTS.SESSION_ID_DISPLAY_LENGTH)}`,
        `${t("message.tools")}: ${message.tools.length} ${t("message.available")}`,
        `${t("message.cwd")}: ${message.cwd}`,
        `${t("message.permissionMode")}: ${message.permissionMode}`,
        `${t("message.apiKeySource")}: ${message.apiKeySource}`,
      ].join("\n");
    } else if (message.type === "result") {
      const details = [
        `${t("message.duration")}: ${message.duration_ms}ms`,
        `${t("message.cost")}: $${message.total_cost_usd.toFixed(4)}`,
        `${t("message.tokens")}: ${message.usage.input_tokens} ${t("message.in")}, ${message.usage.output_tokens} ${t("message.out")}`,
      ];
      return details.join("\n");
    } else if (message.type === "error") {
      return message.message;
    }
    return JSON.stringify(message, null, 2);
  };

  // Get label based on message type
  const getLabel = () => {
    if (message.type === "system") return t("message.system");
    if (message.type === "result") return t("message.result");
    if (message.type === "error") return t("message.error");
    return t("message.message");
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

  // Format the tool arguments for better display
  const formatToolDisplay = (content: string) => {
    const match = content.match(/^([^(]+)(\(.+\))?$/);
    if (match) {
      const name = match[1].trim();
      const args = match[2] || "";
      return { name, args };
    }
    return { name: content, args: "" };
  };

  const { name, args } = formatToolDisplay(message.content);

  return (
    <MessageContainer
      alignment="left"
      colorScheme={style.colorScheme}
      className={`tool-message-${toolStyle} relative`}
    >
      <div
        className={`text-xs font-semibold mb-2 opacity-90 ${style.headerClass} flex items-center gap-2`}
      >
        <div
          className={`w-5 h-5 ${style.iconBg} rounded-full flex items-center justify-center text-white text-xs shadow-lg`}
        >
          {style.icon}
        </div>
        {style.badge && (
          <span
            className={`tool-badge text-[10px] px-2 py-0.5 rounded-full ${style.iconBg} text-white font-bold uppercase tracking-wide`}
          >
            {style.badge}
          </span>
        )}
        <span className="font-bold">{name}</span>
        {args && <span className="opacity-70 font-normal">{args}</span>}
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

  // Function to format content based on tool type
  const formatToolContent = (
    toolName: string,
    content: string,
  ): { formattedContent: string; badge?: string } => {
    // TodoRead/TodoWrite formatting
    if (toolName === "TodoRead" || toolName === "TodoWrite") {
      // Try to parse as JSON array
      if (content.includes("[{") && content.includes("}]")) {
        try {
          const todos = JSON.parse(content);
          if (Array.isArray(todos)) {
            const pending = todos.filter((t) => t.status === "pending").length;
            const inProgress = todos.filter(
              (t) => t.status === "in_progress",
            ).length;
            const completed = todos.filter(
              (t) => t.status === "completed",
            ).length;

            const formattedContent = todos
              .map(
                (todo: {
                  status: string;
                  priority: string;
                  content: string;
                }) => {
                  const statusIcon =
                    todo.status === "completed"
                      ? "✅"
                      : todo.status === "in_progress"
                        ? "🔄"
                        : "⭕";
                  const priorityColor =
                    todo.priority === "high"
                      ? "🔴"
                      : todo.priority === "medium"
                        ? "🟡"
                        : "🟢";
                  return `${statusIcon} ${priorityColor} ${todo.content}`;
                },
              )
              .join("\n");

            const badge = `${todos.length} tasks (${completed}✅ ${inProgress}🔄 ${pending}⭕)`;
            return { formattedContent, badge };
          }
        } catch {
          // Not valid JSON, fall through
        }
      }

      // If content contains success message
      if (
        content.includes("modified successfully") ||
        content.includes("empty")
      ) {
        return { formattedContent: content, badge: "Updated" };
      }
    }

    // Task tool formatting
    if (toolName === "Task") {
      return { formattedContent: content, badge: "Agent Result" };
    }

    // WebSearch/WebFetch formatting
    if (toolName === "WebSearch" || toolName === "WebFetch") {
      return { formattedContent: content, badge: "Web Result" };
    }

    // File operation formatting
    if (["Read", "Write", "Edit", "MultiEdit"].includes(toolName)) {
      const lines = content.split("\n").length;
      return { formattedContent: content, badge: `${lines} lines` };
    }

    // Bash command formatting
    if (toolName === "Bash") {
      const lines = content.split("\n").length;
      const hasError =
        content.toLowerCase().includes("error") ||
        content.toLowerCase().includes("failed");
      return {
        formattedContent: content,
        badge: hasError ? "Error" : `Output (${lines} lines)`,
      };
    }

    // Search/navigation tools formatting
    if (["Glob", "Grep", "LS"].includes(toolName)) {
      const lines = content.split("\n").filter((l) => l.trim()).length;
      if (lines === 0) {
        return { formattedContent: "No results found", badge: "0 results" };
      }
      return { formattedContent: content, badge: `${lines} results` };
    }

    // Notebook operations
    if (["NotebookRead", "NotebookEdit"].includes(toolName)) {
      return { formattedContent: content, badge: "Notebook" };
    }

    // Exit plan mode
    if (toolName === "exit_plan_mode") {
      return { formattedContent: content, badge: "Plan Mode Exit" };
    }

    // Default formatting
    return { formattedContent: content };
  };

  const { formattedContent, badge } = formatToolContent(
    message.toolName,
    message.content,
  );

  return (
    <CollapsibleDetails
      label={`${style.icon} ${message.toolName}`}
      details={formattedContent}
      badge={badge || message.summary}
      icon={<span className={style.iconBg}>✓</span>}
      colorScheme={{
        header: style.headerClass,
        content: "text-secondary font-mono",
        border:
          style.colorScheme.match(/border-[^\s]+/)?.[0] || "border-accent",
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
