export type FileStatus = 
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "ignored"
  | "conflicted";

export interface GitFile {
  path: string;
  status: FileStatus;
  staged: boolean;
  oldPath?: string; // For renamed files
}

export interface GitStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  files: GitFile[];
  hasConflicts: boolean;
  isDetached: boolean;
  isClean: boolean;
}

export interface GitCommit {
  hash: string;
  abbreviatedHash: string;
  subject: string;
  body?: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer?: {
    name: string;
    email: string;
    date: string;
  };
  refs?: string[];
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

export interface GitRemote {
  name: string;
  url: string;
  type: "fetch" | "push";
}

export interface GitDiff {
  path: string;
  additions: number;
  deletions: number;
  changes: GitDiffChange[];
  isBinary: boolean;
}

export interface GitDiffChange {
  type: "add" | "delete" | "normal";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface GitStageRequest {
  paths: string[];
}

export interface GitUnstageRequest {
  paths: string[];
}

export interface GitCommitRequest {
  message: string;
  amend?: boolean;
}

export interface GitPushRequest {
  remote?: string;
  branch?: string;
  force?: boolean;
  setUpstream?: boolean;
}

export interface GitPullRequest {
  remote?: string;
  branch?: string;
  rebase?: boolean;
}

export interface GitCheckoutRequest {
  branch: string;
  createNew?: boolean;
}

export interface GitStashRequest {
  message?: string;
  includeUntracked?: boolean;
}

export interface GitResetRequest {
  mode: "soft" | "mixed" | "hard";
  ref?: string;
}