import { useState, useEffect } from "react";

interface SmitheryAuthComponentProps {
  onAuthSuccess: (token: string) => void;
  onAuthError: (error: string) => void;
  isLoading?: boolean;
}

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  token: string | null;
  error: string | null;
}

export function SmitheryAuthComponent({ 
  onAuthSuccess, 
  onAuthError, 
  isLoading = false 
}: SmitheryAuthComponentProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    error: null
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // 检查本地存储的认证状态
  useEffect(() => {
    const storedToken = localStorage.getItem('smithery_auth_token');
    const storedUser = localStorage.getItem('smithery_auth_user');
    
    if (storedToken && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setAuthState({
          isAuthenticated: true,
          user,
          token: storedToken,
          error: null
        });
        onAuthSuccess(storedToken);
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('smithery_auth_token');
        localStorage.removeItem('smithery_auth_user');
      }
    }
  }, [onAuthSuccess]);

  // 监听OAuth回调
  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const expectedState = sessionStorage.getItem('oauth_state');

      if (code && state === expectedState) {
        setIsAuthenticating(true);
        try {
          // 清理URL中的OAuth参数
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // 发送授权码到后端
          const response = await fetch('/api/auth/github/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code, state }),
          });

          if (!response.ok) {
            throw new Error(`Authentication failed: ${response.statusText}`);
          }

          const authResult = await response.json();
          
          // 存储认证信息
          localStorage.setItem('smithery_auth_token', authResult.smitheryToken);
          localStorage.setItem('smithery_auth_user', JSON.stringify(authResult.user));
          
          setAuthState({
            isAuthenticated: true,
            user: authResult.user,
            token: authResult.smitheryToken,
            error: null
          });
          
          onAuthSuccess(authResult.smitheryToken);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
          setAuthState(prev => ({ ...prev, error: errorMessage }));
          onAuthError(errorMessage);
        } finally {
          setIsAuthenticating(false);
          sessionStorage.removeItem('oauth_state');
        }
      }
    };

    handleAuthCallback();
  }, [onAuthSuccess, onAuthError]);

  const handleGitHubLogin = async () => {
    try {
      setIsAuthenticating(true);
      setAuthState(prev => ({ ...prev, error: null }));

      // 生成随机的state参数用于CSRF保护
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('oauth_state', state);

      // 获取GitHub OAuth URL
      const response = await fetch('/api/auth/github/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state }),
      });

      if (!response.ok) {
        throw new Error('Failed to get OAuth URL');
      }

      const { authUrl } = await response.json();
      
      // 重定向到GitHub授权页面
      window.location.href = authUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start authentication';
      setAuthState(prev => ({ ...prev, error: errorMessage }));
      onAuthError(errorMessage);
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('smithery_auth_token');
    localStorage.removeItem('smithery_auth_user');
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      error: null
    });
  };

  const handleManualTokenInput = () => {
    const token = prompt('请输入您的Smithery API Token:');
    if (token && token.trim()) {
      const trimmedToken = token.trim();
      localStorage.setItem('smithery_auth_token', trimmedToken);
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        token: trimmedToken,
        error: null
      }));
      onAuthSuccess(trimmedToken);
    }
  };

  if (authState.isAuthenticated && authState.user) {
    return (
      <div className="bg-gradient-subtle rounded-xl p-6 border border-accent">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img
              src={authState.user.avatar_url}
              alt={authState.user.name || authState.user.login}
              className="w-12 h-12 rounded-full border-2 border-accent"
            />
            <div>
              <h3 className="font-semibold text-primary">
                {authState.user.name || authState.user.login}
              </h3>
              <p className="text-sm text-secondary">已通过GitHub认证连接到Smithery</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="glass-button px-4 py-2 text-sm"
          >
            注销
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-subtle rounded-xl p-6 border border-accent">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-primary mb-2">
          连接到Smithery
        </h3>
        <p className="text-secondary mb-6">
          使用GitHub账户登录以安全地访问Smithery服务器注册表
        </p>

        {authState.error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{authState.error}</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGitHubLogin}
            disabled={isAuthenticating || isLoading}
            className="w-full glass-button flex items-center justify-center space-x-3 py-3"
          >
            {isAuthenticating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span>正在连接...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>使用GitHub登录</span>
              </>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-accent"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-black-secondary text-secondary">或者</span>
            </div>
          </div>

          <button
            onClick={handleManualTokenInput}
            disabled={isAuthenticating || isLoading}
            className="w-full glass-button py-3 text-sm text-secondary"
          >
            手动输入API Token
          </button>
        </div>

        <div className="mt-6 text-xs text-tertiary">
          <p>
            通过GitHub登录，您同意我们安全地存储您的Smithery访问令牌。
            <br />
            我们不会访问您的私有GitHub数据。
          </p>
        </div>
      </div>
    </div>
  );
} 