import { Context } from "hono";
import type {
  FileStatus,
  GitBranch,
  GitCheckoutRequest,
  GitCommit,
  GitCommitRequest,
  GitDiff,
  GitDiffChange,
  GitFile,
  GitPullRequest,
  GitPushRequest,
  GitStageRequest,
  GitStatus,
  GitUnstageRequest,
} from "../../shared/gitTypes.ts";

/**
 * Execute a git command and return the output
 */
async function executeGitCommand(
  args: string[],
  workingDirectory: string,
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    console.log(`[Git] Executing: git ${args.join(" ")} in ${workingDirectory}`);
    
    const cmd = new Deno.Command("git", {
      args,
      cwd: workingDirectory,
      stdout: "piped",
      stderr: "piped",
    });

    const output = await cmd.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);
    
    if (!output.success) {
      console.error(`[Git] Command failed: ${stderr}`);
    }
    
    return {
      stdout,
      stderr,
      success: output.success,
    };
  } catch (error) {
    console.error(`[Git] Command execution error:`, error);
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      success: false,
    };
  }
}

/**
 * Parse git status porcelain output
 */
function parseGitStatus(output: string): GitFile[] {
  const files: GitFile[] = [];
  
  if (!output || !output.trim()) {
    return files;
  }

  const lines = output.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    // Ensure line has at least 3 characters (status code + space)
    if (line.length < 3) {
      console.warn("Skipping invalid git status line:", line);
      continue;
    }

    const statusCode = line.substring(0, 2);
    const filePath = line.substring(2).trim();

    // Skip if no file path
    if (!filePath) {
      continue;
    }

    let status: FileStatus = "modified";
    let staged = false;

    // Parse status codes
    const indexStatus = statusCode[0];
    const workTreeStatus = statusCode[1];

    if (indexStatus === "?" && workTreeStatus === "?") {
      status = "untracked";
    } else if (indexStatus === "!" && workTreeStatus === "!") {
      status = "ignored";
    } else {
      // Check if staged
      if (indexStatus !== " " && indexStatus !== "?") {
        staged = true;
      }

      // Determine status
      if (indexStatus === "A" || workTreeStatus === "A") {
        status = "added";
      } else if (indexStatus === "D" || workTreeStatus === "D") {
        status = "deleted";
      } else if (indexStatus === "M" || workTreeStatus === "M") {
        status = "modified";
      } else if (indexStatus === "R" || workTreeStatus === "R") {
        status = "renamed";
      } else if (indexStatus === "C" || workTreeStatus === "C") {
        status = "copied";
      } else if (indexStatus === "U" || workTreeStatus === "U") {
        status = "conflicted";
      }
    }

    // Handle renamed/copied files
    let path = filePath;
    let oldPath: string | undefined;
    if (status === "renamed" || status === "copied") {
      const parts = filePath.split(" -> ");
      if (parts.length === 2) {
        oldPath = parts[0].trim();
        path = parts[1].trim();
      }
    }

    // Validate path
    if (!path) {
      console.warn("Skipping file with empty path");
      continue;
    }

    files.push({ path, status, staged, oldPath });
  }

  return files;
}

/**
 * Get current branch and upstream info
 */
async function getBranchInfo(workingDirectory: string): Promise<{
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  isDetached: boolean;
}> {
  // Get current branch
  const branchResult = await executeGitCommand(
    ["symbolic-ref", "--short", "HEAD"],
    workingDirectory,
  );

  let branch = "HEAD";
  let isDetached = false;

  if (branchResult.success) {
    branch = branchResult.stdout.trim();
  } else {
    // Check if in detached HEAD state
    const revResult = await executeGitCommand(
      ["rev-parse", "--short", "HEAD"],
      workingDirectory,
    );
    if (revResult.success) {
      branch = revResult.stdout.trim();
      isDetached = true;
    }
  }

  // Get upstream tracking info
  let upstream: string | undefined;
  let ahead = 0;
  let behind = 0;

  if (!isDetached) {
    const upstreamResult = await executeGitCommand(
      ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`],
      workingDirectory,
    );

    if (upstreamResult.success) {
      upstream = upstreamResult.stdout.trim();

      // Get ahead/behind counts
      const countResult = await executeGitCommand(
        ["rev-list", "--count", "--left-right", `${upstream}...${branch}`],
        workingDirectory,
      );

      if (countResult.success) {
        const [behindStr, aheadStr] = countResult.stdout.trim().split("\t");
        behind = parseInt(behindStr) || 0;
        ahead = parseInt(aheadStr) || 0;
      }
    }
  }

  return { branch, upstream, ahead, behind, isDetached };
}

/**
 * Handle POST /api/git/status
 */
export async function handleGitStatus(c: Context) {
  try {
    const { workingDirectory } = await c.req.json();

    // Validate working directory
    if (!workingDirectory) {
      console.error("No working directory provided");
      return c.json({ error: "No working directory provided" }, 400);
    }

    console.log(`[Git] Checking git status for: ${workingDirectory}`);

    // Check if directory exists
    try {
      const dirInfo = await Deno.stat(workingDirectory);
      if (!dirInfo.isDirectory) {
        console.error(`Not a directory: ${workingDirectory}`);
        return c.json({ error: "Invalid directory path" }, 400);
      }
    } catch (err) {
      console.error(`Directory not found: ${workingDirectory}`, err);
      return c.json({ error: "Directory not found" }, 400);
    }

    // Check if it's a git repository
    const gitCheckResult = await executeGitCommand(
      ["rev-parse", "--git-dir"],
      workingDirectory,
    );

    if (!gitCheckResult.success) {
      console.error(`Not a git repository: ${workingDirectory}`);
      return c.json({ error: "Not a git repository" }, 400);
    }

    // Get file status
    const statusResult = await executeGitCommand(
      ["status", "--porcelain=v1"],
      workingDirectory,
    );

    if (!statusResult.success) {
      console.error("Git status command failed:", statusResult.stderr);
      return c.json({ error: `Git status failed: ${statusResult.stderr}` }, 500);
    }

    const files = parseGitStatus(statusResult.stdout);
    const branchInfo = await getBranchInfo(workingDirectory);

    const status: GitStatus = {
      ...branchInfo,
      files,
      hasConflicts: files.some((f) => f.status === "conflicted"),
      isClean: files.length === 0,
    };

    return c.json(status);
  } catch (error) {
    console.error("Error getting git status:", error);
    return c.json({ error: "Failed to get git status" }, 500);
  }
}

/**
 * Handle GET /api/git/branches
 */
export async function handleGitBranches(c: Context) {
  try {
    const { workingDirectory } = await c.req.json();
    
    if (!workingDirectory) {
      return c.json({ error: "No working directory provided" }, 400);
    }

    const result = await executeGitCommand(
      [
        "branch",
        "-a",
        "--format=%(refname:short)|%(HEAD)|%(upstream)|%(upstream:track)",
      ],
      workingDirectory,
    );

    if (!result.success) {
      return c.json({ error: "Failed to get branches" }, 500);
    }

    const branches: GitBranch[] = [];
    const lines = result.stdout.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      const [name, isCurrent, upstream, tracking] = line.split("|");

      let ahead = 0;
      let behind = 0;

      if (tracking) {
        const aheadMatch = tracking.match(/ahead (\d+)/);
        const behindMatch = tracking.match(/behind (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1]);
        if (behindMatch) behind = parseInt(behindMatch[1]);
      }

      branches.push({
        name,
        current: isCurrent === "*",
        upstream: upstream || undefined,
        ahead: ahead || undefined,
        behind: behind || undefined,
      });
    }

    return c.json(branches);
  } catch (error) {
    console.error("Error getting branches:", error);
    return c.json({ error: "Failed to get branches" }, 500);
  }
}

/**
 * Handle GET /api/git/log
 */
export async function handleGitLog(c: Context) {
  try {
    const { workingDirectory, limit = 20 } = await c.req.json();
    
    if (!workingDirectory) {
      return c.json({ error: "No working directory provided" }, 400);
    }

    // Use zero byte separator for safe parsing
    const result = await executeGitCommand(
      [
        "log",
        `--max-count=${limit}`,
        "-z", // Use null character as delimiter between commits
        "--pretty=format:%H%x1f%h%x1f%s%x1f%b%x1f%an%x1f%ae%x1f%ad%x1f%cn%x1f%ce%x1f%cd%x1f%d",
        "--date=iso",
      ],
      workingDirectory,
    );

    if (!result.success) {
      console.error("Git log failed:", result.stderr);
      return c.json({ error: `Failed to get git log: ${result.stderr}` }, 500);
    }

    const commits: GitCommit[] = [];
    
    // Split by null character between commits (git adds null after each commit with -z)
    const commitRecords = result.stdout.split("\0").filter(record => record.trim());

    for (const record of commitRecords) {
      // Split each commit record by unit separator character (0x1f)
      const parts = record.split("\x1f");
      
      // Ensure we have at least the minimum required fields
      if (parts.length < 11) {
        console.warn("Skipping malformed commit record, parts:", parts.length);
        continue;
      }

      const [
        hash,
        abbreviatedHash,
        subject,
        body,
        authorName,
        authorEmail,
        authorDate,
        committerName,
        committerEmail,
        committerDate,
        refs,
      ] = parts.map(part => part?.trim() || "");

      // Skip if essential fields are missing
      if (!hash || !abbreviatedHash) {
        console.warn("Skipping commit with missing hash:", { hash, abbreviatedHash });
        continue;
      }

      // Parse and validate date
      const parseDate = (dateStr: string): string => {
        if (!dateStr) return new Date().toISOString();
        try {
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
        } catch {
          return new Date().toISOString();
        }
      };

      commits.push({
        hash,
        abbreviatedHash,
        subject: subject || "(no commit message)",
        body: body || undefined,
        author: {
          name: authorName || "Unknown Author",
          email: authorEmail || "unknown@example.com",
          date: parseDate(authorDate),
        },
        committer: committerName ? {
          name: committerName || "Unknown Committer",
          email: committerEmail || "unknown@example.com",
          date: parseDate(committerDate),
        } : undefined,
        refs: refs
          ? refs
            .replace(/^\(|\)$/g, "")
            .split(", ")
            .filter(Boolean)
          : undefined,
      });
    }

    console.log(`[Git] Found ${commits.length} commits`);
    return c.json(commits);
  } catch (error) {
    console.error("Error getting git log:", error);
    return c.json({ error: "Failed to get git log" }, 500);
  }
}

/**
 * Handle POST /api/git/diff
 */
export async function handleGitDiff(c: Context) {
  try {
    const { workingDirectory, path, staged = false } = await c.req.json();
    
    if (!workingDirectory) {
      return c.json({ error: "No working directory provided" }, 400);
    }
    
    if (!path) {
      return c.json({ error: "No file path provided" }, 400);
    }

    const args = ["diff", "--no-color", "--no-ext-diff"];
    if (staged) {
      args.push("--cached");
    }
    args.push("--", path);

    const result = await executeGitCommand(args, workingDirectory);

    if (!result.success) {
      return c.json({ error: "Failed to get diff" }, 500);
    }

    // Check if binary
    const binaryCheck = await executeGitCommand(
      ["diff", "--numstat", staged ? "--cached" : "HEAD", "--", path],
      workingDirectory,
    );

    let isBinary = false;
    if (binaryCheck.success && binaryCheck.stdout.includes("-\t-\t")) {
      isBinary = true;
    }

    const diff: GitDiff = {
      path,
      additions: 0,
      deletions: 0,
      changes: [],
      isBinary,
    };

    if (!isBinary) {
      const lines = result.stdout.split("\n");
      let oldLine = 0;
      let newLine = 0;

      for (const line of lines) {
        if (line.startsWith("@@")) {
          // Parse hunk header
          const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
          if (match) {
            oldLine = parseInt(match[1]);
            newLine = parseInt(match[2]);
          }
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          diff.changes.push({
            type: "add",
            newLineNumber: newLine++,
            content: line.substring(1),
          });
          diff.additions++;
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          diff.changes.push({
            type: "delete",
            oldLineNumber: oldLine++,
            content: line.substring(1),
          });
          diff.deletions++;
        } else if (!line.startsWith("\\") && line.length > 0) {
          diff.changes.push({
            type: "normal",
            oldLineNumber: oldLine++,
            newLineNumber: newLine++,
            content: line.substring(1),
          });
        }
      }
    }

    return c.json(diff);
  } catch (error) {
    console.error("Error getting diff:", error);
    return c.json({ error: "Failed to get diff" }, 500);
  }
}

/**
 * Handle POST /api/git/stage
 */
export async function handleGitStage(c: Context) {
  try {
    const { workingDirectory, paths }: GitStageRequest & {
      workingDirectory: string;
    } = await c.req.json();

    const result = await executeGitCommand(
      ["add", ...paths],
      workingDirectory,
    );

    if (!result.success) {
      return c.json({ error: `Failed to stage files: ${result.stderr}` }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error staging files:", error);
    return c.json({ error: "Failed to stage files" }, 500);
  }
}

/**
 * Handle POST /api/git/unstage
 */
export async function handleGitUnstage(c: Context) {
  try {
    const { workingDirectory, paths }: GitUnstageRequest & {
      workingDirectory: string;
    } = await c.req.json();

    const result = await executeGitCommand(
      ["reset", "HEAD", ...paths],
      workingDirectory,
    );

    if (!result.success) {
      return c.json(
        { error: `Failed to unstage files: ${result.stderr}` },
        500,
      );
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error unstaging files:", error);
    return c.json({ error: "Failed to unstage files" }, 500);
  }
}

/**
 * Handle POST /api/git/commit
 */
export async function handleGitCommit(c: Context) {
  try {
    const { workingDirectory, message, amend = false }: GitCommitRequest & {
      workingDirectory: string;
    } = await c.req.json();

    // Validate commit message
    if (!message || !message.trim()) {
      return c.json({ error: "Commit message is required" }, 400);
    }

    if (!workingDirectory) {
      return c.json({ error: "No working directory provided" }, 400);
    }

    // Use --file option with stdin to handle special characters and multiline messages properly
    const commitMessageFile = await Deno.makeTempFile();
    try {
      await Deno.writeTextFile(commitMessageFile, message);
      
      const args = ["commit", "-F", commitMessageFile];
      if (amend) {
        args.push("--amend");
      }

      console.log(`[Git] Committing with message: ${message.substring(0, 50)}...`);
      const result = await executeGitCommand(args, workingDirectory);

      if (!result.success) {
        console.error("Git commit failed:", result.stderr);
        return c.json({ error: `Failed to commit: ${result.stderr}` }, 500);
      }

      console.log("[Git] Commit successful");
      return c.json({ success: true, output: result.stdout });
    } finally {
      // Clean up temp file
      try {
        await Deno.remove(commitMessageFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.error("Error committing:", error);
    return c.json({ error: "Failed to commit" }, 500);
  }
}

/**
 * Handle POST /api/git/push
 */
export async function handleGitPush(c: Context) {
  try {
    const {
      workingDirectory,
      remote = "origin",
      branch,
      force = false,
      setUpstream = false,
    }: GitPushRequest & { workingDirectory: string } = await c.req.json();

    const args = ["push"];

    if (force) {
      args.push("--force-with-lease");
    }

    if (setUpstream) {
      args.push("--set-upstream");
    }

    args.push(remote);

    if (branch) {
      args.push(branch);
    }

    const result = await executeGitCommand(args, workingDirectory);

    if (!result.success) {
      return c.json({ error: `Failed to push: ${result.stderr}` }, 500);
    }

    return c.json({ success: true, output: result.stdout });
  } catch (error) {
    console.error("Error pushing:", error);
    return c.json({ error: "Failed to push" }, 500);
  }
}

/**
 * Handle POST /api/git/pull
 */
export async function handleGitPull(c: Context) {
  try {
    const {
      workingDirectory,
      remote = "origin",
      branch,
      rebase = false,
    }: GitPullRequest & { workingDirectory: string } = await c.req.json();

    const args = ["pull"];

    if (rebase) {
      args.push("--rebase");
    }

    args.push(remote);

    if (branch) {
      args.push(branch);
    }

    const result = await executeGitCommand(args, workingDirectory);

    if (!result.success) {
      return c.json({ error: `Failed to pull: ${result.stderr}` }, 500);
    }

    return c.json({ success: true, output: result.stdout });
  } catch (error) {
    console.error("Error pulling:", error);
    return c.json({ error: "Failed to pull" }, 500);
  }
}

/**
 * Handle POST /api/git/checkout
 */
export async function handleGitCheckout(c: Context) {
  try {
    const {
      workingDirectory,
      branch,
      createNew = false,
    }: GitCheckoutRequest & { workingDirectory: string } = await c.req.json();

    const args = ["checkout"];

    if (createNew) {
      args.push("-b");
    }

    args.push(branch);

    const result = await executeGitCommand(args, workingDirectory);

    if (!result.success) {
      return c.json({ error: `Failed to checkout: ${result.stderr}` }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error checking out branch:", error);
    return c.json({ error: "Failed to checkout branch" }, 500);
  }
}
