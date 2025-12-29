import { useRef, useEffect } from "react";
import type { AllMessage, CommandSuggestion } from "../../types";
import {
  isChatMessage,
  isSystemMessage,
  isToolMessage,
  isToolResultMessage,
} from "../../types";
import {
  ChatMessageComponent,
  SystemMessageComponent,
  ToolMessageComponent,
  ToolResultMessageComponent,
  LoadingComponent,
} from "../MessageComponents";
import { CommandShowcase } from "./CommandShowcase";
// import { UI_CONSTANTS } from "../../utils/constants"; // Unused for now

interface ChatMessagesProps {
  messages: AllMessage[];
  isLoading: boolean;
  suggestions?: CommandSuggestion[];
  onCommandClick?: (command: string) => void;
}

export function ChatMessages({
  messages,
  isLoading,
  suggestions = [],
  onCommandClick,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesEndRef.current.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Check if user is near bottom of messages (unused but kept for future use)
  // const isNearBottom = () => {
  //   const container = messagesContainerRef.current;
  //   if (!container) return true;

  //   const { scrollTop, scrollHeight, clientHeight } = container;
  //   return (
  //     scrollHeight - scrollTop - clientHeight <
  //     UI_CONSTANTS.NEAR_BOTTOM_THRESHOLD_PX
  //   );
  // };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Determine message grouping for iOS-style consecutive message spacing
  const getMessageGrouping = (
    index: number,
  ): "first" | "middle" | "last" | "single" | false => {
    const currentMsg = messages[index];
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

    // Only group chat messages
    if (!isChatMessage(currentMsg)) return false;

    const currentRole = currentMsg.role;
    const prevRole = prevMsg && isChatMessage(prevMsg) ? prevMsg.role : null;
    const nextRole = nextMsg && isChatMessage(nextMsg) ? nextMsg.role : null;

    // Check time difference (group if less than 2 minutes apart)
    const isCloseInTime = (msg1: AllMessage, msg2: AllMessage | null) => {
      if (!msg2) return false;
      const diff = Math.abs(msg1.timestamp - msg2.timestamp);
      return diff < 120000; // 2 minutes in milliseconds
    };

    const sameAsPrev =
      prevRole === currentRole && isCloseInTime(currentMsg, prevMsg);
    const sameAsNext =
      nextRole === currentRole && isCloseInTime(currentMsg, nextMsg);

    if (!sameAsPrev && !sameAsNext) return "single";
    if (sameAsPrev && sameAsNext) return "middle";
    if (!sameAsPrev && sameAsNext) return "first";
    if (sameAsPrev && !sameAsNext) return "last";

    return false;
  };

  const renderMessage = (message: AllMessage, index: number) => {
    // Use timestamp as key for stable rendering, fallback to index if needed
    const key = `${message.timestamp}-${index}`;
    const grouping = getMessageGrouping(index);

    if (isSystemMessage(message)) {
      return <SystemMessageComponent key={key} message={message} />;
    } else if (isToolMessage(message)) {
      return <ToolMessageComponent key={key} message={message} />;
    } else if (isToolResultMessage(message)) {
      return <ToolResultMessageComponent key={key} message={message} />;
    } else if (isChatMessage(message)) {
      return (
        <ChatMessageComponent key={key} message={message} grouping={grouping} />
      );
    }
    return null;
  };

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto glass-card p-5 md:p-6 rounded-3xl flex flex-col min-h-0 ios-momentum-scroll card-transition border border-accent/10"
      style={{
        background: "linear-gradient(135deg, rgba(26, 26, 26, 0.85) 0%, rgba(18, 18, 18, 0.90) 100%)",
      }}
    >
      {messages.length === 0 ? (
        <EmptyState
          suggestions={suggestions}
          onCommandClick={onCommandClick}
        />
      ) : (
        <>
          {/* Spacer div to push messages to the bottom */}
          <div className="flex-1 min-h-[20px]" aria-hidden="true"></div>
          <div>{messages.map(renderMessage)}</div>
          {isLoading && <LoadingComponent />}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}

interface EmptyStateProps {
  suggestions: CommandSuggestion[];
  onCommandClick?: (command: string) => void;
}

function EmptyState({ suggestions, onCommandClick }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center text-center text-secondary animate-scale-in">
      <div className="w-full max-w-2xl">
        {/* Welcome Message */}
        <div className="mb-12">
          <div className="text-8xl mb-10 opacity-80 animate-float-gentle">
            <span role="img" aria-label="chat icon" className="inline-block">
              💬
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold enhanced-text-gradient mb-6 tracking-tight">
            Start a conversation with Claude
          </h2>
          <p className="text-lg md:text-xl mt-4 opacity-90 text-secondary leading-relaxed max-w-xl mx-auto">
            Ask me anything - I can help with coding, writing, analysis, and
            more
          </p>
        </div>

        {/* Command Showcase */}
        {suggestions.length > 0 && onCommandClick && (
          <CommandShowcase
            suggestions={suggestions}
            onCommandClick={onCommandClick}
          />
        )}

        {/* Capability Tags (shown if no suggestions) */}
        {suggestions.length === 0 && (
          <div className="mt-10 flex justify-center gap-4 flex-wrap">
            <div className="glass-card px-6 py-3 rounded-full text-sm text-accent font-medium card-transition border border-accent/20 backdrop-blur-xl hover:border-accent/40 hover:bg-accent/5">
              ✨ Code assistance
            </div>
            <div className="glass-card px-6 py-3 rounded-full text-sm text-accent font-medium card-transition border border-accent/20 backdrop-blur-xl hover:border-accent/40 hover:bg-accent/5">
              📝 Writing help
            </div>
            <div className="glass-card px-6 py-3 rounded-full text-sm text-accent font-medium card-transition border border-accent/20 backdrop-blur-xl hover:border-accent/40 hover:bg-accent/5">
              💡 Problem solving
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
