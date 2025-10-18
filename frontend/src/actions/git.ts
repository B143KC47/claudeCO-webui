import { getApiUrl } from "../config/api";
import type {
  GitStatus,
  GitBranch,
  GitCommit,
  GitDiff,
  GitStageRequest,
  GitUnstageRequest,
  GitCommitRequest,
  GitPushRequest,
  GitPullRequest,
  GitCheckoutRequest,
} from "../../shared/gitTypes";

// Type definitions for action results
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type GitStatusResult = ActionResult<GitStatus>;
export type GitBranchesResult = ActionResult<GitBranch[]>;
export type GitCommitsResult = ActionResult<GitCommit[]>;
export type GitDiffResult = ActionResult<GitDiff>;
export type GitOperationResult = ActionResult<{ message?: string }>;

// Helper function for API calls
async function gitApiCall<T>(
  endpoint: string,
  method: string = "GET",
  body?: any,
): Promise<ActionResult<T>> {
  try {
    const response = await fetch(getApiUrl(endpoint), {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error || response.statusText;
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error(`Git API error (${endpoint}):`, error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

// Git status action
export async function getGitStatus(
  workingDirectory: string,
): Promise<GitStatusResult> {
  return gitApiCall<GitStatus>("/api/git/status", "POST", { workingDirectory });
}

// Get branches action
export async function getGitBranches(
  workingDirectory: string,
): Promise<GitBranchesResult> {
  return gitApiCall<GitBranch[]>("/api/git/branches", "POST", {
    workingDirectory,
  });
}

// Get commit history action
export async function getGitLog(
  workingDirectory: string,
  limit: number = 20,
): Promise<GitCommitsResult> {
  return gitApiCall<GitCommit[]>("/api/git/log", "POST", {
    workingDirectory,
    limit,
  });
}

// Get file diff action
export async function getGitDiff(
  workingDirectory: string,
  path: string,
  staged: boolean = false,
): Promise<GitDiffResult> {
  return gitApiCall<GitDiff>("/api/git/diff", "POST", {
    workingDirectory,
    path,
    staged,
  });
}

// Stage files action
export async function stageFiles(
  workingDirectory: string,
  paths: string[],
): Promise<GitOperationResult> {
  const result = await gitApiCall<{ success: boolean }>(
    "/api/git/stage",
    "POST",
    { workingDirectory, paths } as GitStageRequest & {
      workingDirectory: string;
    },
  );

  if (result.success) {
    return { success: true, data: { message: "Files staged successfully" } };
  }
  return result;
}

// Unstage files action
export async function unstageFiles(
  workingDirectory: string,
  paths: string[],
): Promise<GitOperationResult> {
  const result = await gitApiCall<{ success: boolean }>(
    "/api/git/unstage",
    "POST",
    { workingDirectory, paths } as GitUnstageRequest & {
      workingDirectory: string;
    },
  );

  if (result.success) {
    return { success: true, data: { message: "Files unstaged successfully" } };
  }
  return result;
}

// Commit changes action with form validation
export async function commitChanges(
  workingDirectory: string,
  message: string,
  amend: boolean = false,
): Promise<GitOperationResult> {
  // Validate commit message
  if (!message || !message.trim()) {
    return { success: false, error: "Commit message is required" };
  }

  const result = await gitApiCall<{ success: boolean; output?: string }>(
    "/api/git/commit",
    "POST",
    { workingDirectory, message, amend } as GitCommitRequest & {
      workingDirectory: string;
    },
  );

  if (result.success) {
    return {
      success: true,
      data: { message: result.data.output || "Changes committed successfully" },
    };
  }
  return result;
}

// Push changes action
export async function pushChanges(
  workingDirectory: string,
  options?: Partial<GitPushRequest>,
): Promise<GitOperationResult> {
  const result = await gitApiCall<{ success: boolean; output?: string }>(
    "/api/git/push",
    "POST",
    { workingDirectory, ...options },
  );

  if (result.success) {
    return {
      success: true,
      data: { message: result.data.output || "Changes pushed successfully" },
    };
  }
  return result;
}

// Pull changes action
export async function pullChanges(
  workingDirectory: string,
  options?: Partial<GitPullRequest>,
): Promise<GitOperationResult> {
  const result = await gitApiCall<{ success: boolean; output?: string }>(
    "/api/git/pull",
    "POST",
    { workingDirectory, ...options },
  );

  if (result.success) {
    return {
      success: true,
      data: { message: result.data.output || "Changes pulled successfully" },
    };
  }
  return result;
}

// Checkout branch action
export async function checkoutBranch(
  workingDirectory: string,
  branch: string,
  createNew: boolean = false,
): Promise<GitOperationResult> {
  const result = await gitApiCall<{ success: boolean }>(
    "/api/git/checkout",
    "POST",
    { workingDirectory, branch, createNew } as GitCheckoutRequest & {
      workingDirectory: string;
    },
  );

  if (result.success) {
    return {
      success: true,
      data: { message: `Switched to branch '${branch}'` },
    };
  }
  return result;
}

// Bulk stage/unstage helper
export async function toggleFileStaging(
  workingDirectory: string,
  file: { path: string; staged: boolean },
): Promise<GitOperationResult> {
  if (file.staged) {
    return unstageFiles(workingDirectory, [file.path]);
  } else {
    return stageFiles(workingDirectory, [file.path]);
  }
}

// Stage all changes
export async function stageAllChanges(
  workingDirectory: string,
): Promise<GitOperationResult> {
  // First get the status to find unstaged files
  const statusResult = await getGitStatus(workingDirectory);
  if (!statusResult.success) {
    return statusResult;
  }

  const unstagedFiles = statusResult.data.files
    .filter((file) => !file.staged)
    .map((file) => file.path);

  if (unstagedFiles.length === 0) {
    return { success: true, data: { message: "No unstaged files to stage" } };
  }

  return stageFiles(workingDirectory, unstagedFiles);
}

// Unstage all changes
export async function unstageAllChanges(
  workingDirectory: string,
): Promise<GitOperationResult> {
  // First get the status to find staged files
  const statusResult = await getGitStatus(workingDirectory);
  if (!statusResult.success) {
    return statusResult;
  }

  const stagedFiles = statusResult.data.files
    .filter((file) => file.staged)
    .map((file) => file.path);

  if (stagedFiles.length === 0) {
    return { success: true, data: { message: "No staged files to unstage" } };
  }

  return unstageFiles(workingDirectory, stagedFiles);
}
