import type { GitFile, FileStatus } from "../../shared/gitTypes";

// File status icons with better visual representation
export const FILE_STATUS_ICONS: Record<FileStatus, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  copied: "C",
  untracked: "U",
  ignored: "I",
  conflicted: "!",
};

// File status colors with better contrast
export const FILE_STATUS_COLORS: Record<FileStatus, string> = {
  modified: "text-yellow-500 dark:text-yellow-400",
  added: "text-green-500 dark:text-green-400",
  deleted: "text-red-500 dark:text-red-400",
  renamed: "text-blue-500 dark:text-blue-400",
  copied: "text-blue-500 dark:text-blue-400",
  untracked: "text-gray-500 dark:text-gray-400",
  ignored: "text-gray-600 dark:text-gray-500",
  conflicted: "text-orange-500 dark:text-orange-400",
};

// Background colors for file status
export const FILE_STATUS_BG_COLORS: Record<FileStatus, string> = {
  modified: "bg-yellow-500/10",
  added: "bg-green-500/10",
  deleted: "bg-red-500/10",
  renamed: "bg-blue-500/10",
  copied: "bg-blue-500/10",
  untracked: "bg-gray-500/10",
  ignored: "bg-gray-600/10",
  conflicted: "bg-orange-500/10",
};

// Group files by their staged/unstaged status
export interface GroupedFiles {
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: GitFile[];
  conflicted: GitFile[];
}

export function groupFilesByStatus(files: GitFile[]): GroupedFiles {
  return files.reduce<GroupedFiles>(
    (groups, file) => {
      if (file.status === "conflicted") {
        groups.conflicted.push(file);
      } else if (file.status === "untracked") {
        groups.untracked.push(file);
      } else if (file.staged) {
        groups.staged.push(file);
      } else {
        groups.unstaged.push(file);
      }
      return groups;
    },
    {
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: [],
    },
  );
}

// Get file extension for icon display
export function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return "";
  return path.substring(lastDot + 1).toLowerCase();
}

// File type icons mapping
export const FILE_TYPE_ICONS: Record<string, string> = {
  // Code files
  js: "📄",
  jsx: "⚛️",
  ts: "📘",
  tsx: "⚛️",
  py: "🐍",
  java: "☕",
  c: "🔷",
  cpp: "🔷",
  cs: "🔷",
  go: "🐹",
  rs: "🦀",
  rb: "💎",
  php: "🐘",
  swift: "🦜",

  // Web files
  html: "🌐",
  css: "🎨",
  scss: "🎨",
  sass: "🎨",
  less: "🎨",

  // Data files
  json: "📊",
  xml: "📋",
  yaml: "📋",
  yml: "📋",
  toml: "📋",

  // Documentation
  md: "📝",
  mdx: "📝",
  txt: "📄",
  pdf: "📕",

  // Images
  png: "🖼️",
  jpg: "🖼️",
  jpeg: "🖼️",
  gif: "🖼️",
  svg: "🖼️",
  ico: "🖼️",

  // Other
  env: "🔒",
  gitignore: "🚫",
  lock: "🔒",
  log: "📜",
  sh: "💻",
  bat: "💻",
};

export function getFileIcon(path: string): string {
  const extension = getFileExtension(path);
  const fileName = path.split("/").pop() || "";

  // Special file names
  if (fileName === ".gitignore") return "🚫";
  if (fileName.startsWith(".env")) return "🔒";
  if (fileName === "package.json") return "📦";
  if (fileName === "tsconfig.json") return "🔧";
  if (fileName === "Dockerfile") return "🐳";

  return FILE_TYPE_ICONS[extension] || "📄";
}

// Format file path for display
export function formatFilePath(path: string, maxLength: number = 50): string {
  if (path.length <= maxLength) return path;

  const parts = path.split("/");
  if (parts.length === 1) {
    // Single long filename
    return "..." + path.substring(path.length - maxLength + 3);
  }

  // Try to keep the filename and truncate the path
  const fileName = parts[parts.length - 1];
  if (fileName.length >= maxLength - 3) {
    return "..." + fileName.substring(fileName.length - maxLength + 3);
  }

  // Build path from end to start until we exceed maxLength
  let result = fileName;
  for (let i = parts.length - 2; i >= 0; i--) {
    const newPath = parts[i] + "/" + result;
    if (newPath.length + 3 > maxLength) {
      return ".../" + result;
    }
    result = newPath;
  }

  return result;
}

// Get relative time string
export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return then.toLocaleDateString();
}

// Parse commit message for better display
export interface ParsedCommitMessage {
  type?: string;
  scope?: string;
  subject: string;
  body?: string;
}

export function parseCommitMessage(message: string): ParsedCommitMessage {
  // Check for conventional commit format
  const conventionalMatch = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)/);

  if (conventionalMatch) {
    const [, type, scope, rest] = conventionalMatch;
    const [subject, ...bodyParts] = rest.split("\n");

    return {
      type,
      scope,
      subject: subject.trim(),
      body: bodyParts.join("\n").trim() || undefined,
    };
  }

  // Regular commit message
  const [subject, ...bodyParts] = message.split("\n");
  return {
    subject: subject.trim(),
    body: bodyParts.join("\n").trim() || undefined,
  };
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Generate commit message suggestions based on staged files
export function generateCommitSuggestions(files: GitFile[]): string[] {
  const suggestions: string[] = [];

  // Group by file type/area
  const byExtension = files.reduce<Record<string, number>>((acc, file) => {
    const ext = getFileExtension(file.path);
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});

  // Analyze changes
  const hasOnlyOneFile = files.length === 1;
  const hasOnlyAdded = files.every((f) => f.status === "added");
  const hasOnlyModified = files.every((f) => f.status === "modified");
  const hasOnlyDeleted = files.every((f) => f.status === "deleted");

  if (hasOnlyOneFile) {
    const file = files[0];
    const fileName = file.path.split("/").pop() || file.path;

    if (file.status === "added") {
      suggestions.push(`feat: add ${fileName}`);
    } else if (file.status === "modified") {
      suggestions.push(`fix: update ${fileName}`);
      suggestions.push(`refactor: improve ${fileName}`);
    } else if (file.status === "deleted") {
      suggestions.push(`chore: remove ${fileName}`);
    }
  } else {
    // Multiple files
    if (hasOnlyAdded) {
      suggestions.push("feat: add new files");
    } else if (hasOnlyModified) {
      suggestions.push("fix: update multiple files");
      suggestions.push("refactor: improve code structure");
    } else if (hasOnlyDeleted) {
      suggestions.push("chore: clean up unused files");
    } else {
      suggestions.push("feat: implement new feature");
      suggestions.push("fix: resolve issues");
      suggestions.push("refactor: restructure codebase");
    }
  }

  // Add type-specific suggestions
  if (byExtension.test || byExtension.spec) {
    suggestions.push("test: update test cases");
  }
  if (byExtension.md || byExtension.mdx) {
    suggestions.push("docs: update documentation");
  }
  if (byExtension.css || byExtension.scss || byExtension.less) {
    suggestions.push("style: update styles");
  }

  return suggestions.slice(0, 5);
}

// Validate commit message
export interface CommitMessageValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCommitMessage(
  message: string,
): CommitMessageValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if message is empty
  if (!message || !message.trim()) {
    errors.push("Commit message cannot be empty");
    return { isValid: false, errors, warnings };
  }

  const lines = message.trim().split("\n");
  const subject = lines[0];

  // Check subject line length
  if (subject.length > 72) {
    warnings.push("Subject line should be 72 characters or less");
  }

  if (subject.length < 10) {
    errors.push("Subject line is too short (minimum 10 characters)");
  }

  // Check for proper capitalization
  if (
    subject[0] !== subject[0].toUpperCase() &&
    !subject.match(/^(\w+)(?:\([^)]+\))?:/)
  ) {
    warnings.push("Subject line should start with a capital letter");
  }

  // Check for trailing period
  if (subject.endsWith(".")) {
    warnings.push("Subject line should not end with a period");
  }

  // Check for blank line after subject if there's a body
  if (lines.length > 1 && lines[1].trim() !== "") {
    errors.push("Separate subject from body with a blank line");
  }

  // Check body line length
  for (let i = 2; i < lines.length; i++) {
    if (lines[i].length > 100) {
      warnings.push(`Line ${i + 1} exceeds 100 characters`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
