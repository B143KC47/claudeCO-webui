// UI Constants
export const UI_CONSTANTS = {
  NEAR_BOTTOM_THRESHOLD_PX: 100,
  TEXTAREA_MAX_HEIGHT: 200,
} as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  ABORT: "Escape",
  SUBMIT: "Enter",
} as const;

// Message display constants
export const MESSAGE_CONSTANTS = {
  MAX_DISPLAY_WIDTH: {
    MOBILE: "85%",
    DESKTOP: "70%",
  },
  SUMMARY_MAX_LENGTH: 50,
  SESSION_ID_DISPLAY_LENGTH: 8,
} as const;

// Tool-related constants
export const TOOL_CONSTANTS = {
  MULTI_WORD_COMMANDS: ["cargo", "git", "npm", "yarn", "docker"],
  WILDCARD_COMMAND: "*",
  DEFAULT_TOOL_NAME: "Unknown",
} as const;

// Button style constants for consistent UI
export const BUTTON_STYLES = {
  // Primary action buttons (accent colored, prominent)
  PRIMARY: "px-4 py-2 bg-gradient-primary text-primary font-medium rounded-lg hover:glow-effect smooth-transition disabled:opacity-50 disabled:cursor-not-allowed",
  
  // Secondary action buttons (glass effect, subtle)
  SECONDARY: "px-4 py-2 glass-button text-secondary hover:text-primary smooth-transition disabled:opacity-50 disabled:cursor-not-allowed",
  
  // Danger/destructive actions
  DANGER: "px-4 py-2 bg-red-900/20 border border-red-400/30 text-red-400 rounded-lg hover:bg-red-900/30 hover:glow-effect smooth-transition disabled:opacity-50 disabled:cursor-not-allowed",
  
  // Icon buttons (Settings, Theme, History)
  ICON_BUTTON: "p-3 rounded-xl glass-button glow-border smooth-transition",
  
  // Tab buttons (for navigation)
  TAB_ACTIVE: "flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-primary text-primary glow-effect smooth-transition text-sm font-medium",
  TAB_INACTIVE: "flex items-center gap-2 px-3 py-2 rounded-lg text-secondary hover:text-primary hover:bg-black-secondary/50 smooth-transition text-sm font-medium",

  // History session items
  HISTORY_ITEM: "p-3 glass-card rounded-lg hover:glow-effect smooth-transition cursor-pointer",
  
  // Session list items
  SESSION_ITEM_ACTIVE: "p-4 rounded-lg border bg-accent/10 border-accent smooth-transition cursor-pointer",
  SESSION_ITEM_INACTIVE: "p-4 rounded-lg border bg-black-tertiary border-accent/20 hover:bg-black-quaternary smooth-transition cursor-pointer",
  
  // Small icon buttons
  ICON_SMALL: "p-2 rounded-lg hover:bg-black-quaternary smooth-transition",
  ICON_SMALL_DANGER: "p-2 rounded-lg hover:bg-red-900/20 smooth-transition",
} as const;
