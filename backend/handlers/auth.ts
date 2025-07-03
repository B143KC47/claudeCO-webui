import { Context } from "../types.ts";

interface GitHubAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface OAuthState {
  state: string;
  timestamp: number;
}

// OAuth状态存储 (在生产环境中应该使用Redis或数据库)
const oauthStates = new Map<string, OAuthState>();

// 清理过期的OAuth状态
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthStates.entries()) {
    if (now - value.timestamp > 600000) { // 10分钟过期
      oauthStates.delete(key);
    }
  }
}, 60000); // 每分钟清理一次

function getGitHubConfig(): GitHubAuthConfig {
  const clientId = Deno.env.get("GITHUB_CLIENT_ID");
  const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GITHUB_REDIRECT_URI") || `${Deno.env.get("BASE_URL") || "http://localhost:8080"}/settings`;

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const config = getGitHubConfig();
  
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.statusText}`);
  }

  const tokenData: GitHubTokenResponse = await response.json();
  return tokenData.access_token;
}

async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user: ${response.statusText}`);
  }

  return await response.json();
}

async function fetchUserEmails(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/vnd.github.v3+json",
      },
    });

    if (response.ok) {
      const emails = await response.json();
      const primaryEmail = emails.find((email: any) => email.primary && email.verified);
      return primaryEmail?.email || null;
    }
  } catch (error) {
    console.warn("Failed to fetch user emails:", error);
  }
  return null;
}

// 模拟的Smithery token生成 (在实际应用中，这里应该调用Smithery的API)
function generateSmitheryToken(githubUser: GitHubUser): string {
  // 这里应该是调用Smithery API来获取或创建token的逻辑
  // 目前返回一个模拟的token，基于GitHub用户信息
  const mockToken = `smithery_${githubUser.id}_${Date.now().toString(36)}`;
  console.log(`Generated mock Smithery token for user ${githubUser.login}: ${mockToken}`);
  return mockToken;
}

/**
 * 处理GitHub OAuth URL生成请求
 * POST /api/auth/github/url
 */
export async function handleGitHubAuthUrl(ctx: Context): Promise<Response> {
  try {
    const body = await ctx.request.json();
    const { state } = body;

    if (!state) {
      return new Response(
        JSON.stringify({ error: "State parameter is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const config = getGitHubConfig();
    
    // 存储OAuth状态
    oauthStates.set(state, {
      state,
      timestamp: Date.now(),
    });

    // 构建GitHub OAuth授权URL
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("redirect_uri", config.redirectUri);
    authUrl.searchParams.set("scope", "user:email");
    authUrl.searchParams.set("state", state);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating GitHub auth URL:", error);
    
    if (error instanceof Error && error.message.includes("not configured")) {
      return new Response(
        JSON.stringify({ error: "GitHub OAuth is not configured on this server" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Failed to generate authentication URL" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * 处理GitHub OAuth回调
 * POST /api/auth/github/callback
 */
export async function handleGitHubAuthCallback(ctx: Context): Promise<Response> {
  try {
    const body = await ctx.request.json();
    const { code, state } = body;

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: "Code and state parameters are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 验证OAuth状态
    const storedState = oauthStates.get(state);
    if (!storedState) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired state parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 清理已使用的状态
    oauthStates.delete(state);

    // 交换授权码获取访问令牌
    const accessToken = await exchangeCodeForToken(code);

    // 获取GitHub用户信息
    const githubUser = await fetchGitHubUser(accessToken);
    
    // 尝试获取用户邮箱
    const email = await fetchUserEmails(accessToken);
    if (email) {
      githubUser.email = email;
    }

    // 生成或获取Smithery token
    const smitheryToken = generateSmitheryToken(githubUser);

    return new Response(
      JSON.stringify({
        user: {
          login: githubUser.login,
          name: githubUser.name,
          email: githubUser.email,
          avatar_url: githubUser.avatar_url,
        },
        smitheryToken,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in GitHub auth callback:", error);

    let errorMessage = "Authentication failed";
    if (error instanceof Error) {
      if (error.message.includes("not configured")) {
        errorMessage = "GitHub OAuth is not configured on this server";
      } else if (error.message.includes("token exchange failed")) {
        errorMessage = "Failed to exchange code for token";
      } else if (error.message.includes("fetch GitHub user")) {
        errorMessage = "Failed to fetch user information";
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * 验证Smithery token (可选的端点用于token验证)
 * POST /api/auth/smithery/verify
 */
export async function handleSmitheryTokenVerify(ctx: Context): Promise<Response> {
  try {
    const body = await ctx.request.json();
    const { token } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 这里应该实际验证Smithery token
    // 目前只是一个模拟的验证逻辑
    const isValid = token.startsWith("smithery_") || token.startsWith("sk-");

    return new Response(
      JSON.stringify({ 
        valid: isValid,
        message: isValid ? "Token is valid" : "Invalid token format"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying Smithery token:", error);
    return new Response(
      JSON.stringify({ error: "Token verification failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
} 