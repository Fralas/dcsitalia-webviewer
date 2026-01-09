import { useState, useEffect } from 'react';
import { LogIn, LogOut, User, ChevronDown } from 'lucide-react';

/**
 * User Menu Component - Discord Authentication
 */
export default function UserMenu() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    window.location.href = '/api/auth/discord';
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        setUser(null);
        setMenuOpen(false);
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getAvatarUrl = () => {
    if (!user || !user.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="w-6 h-6 rounded-full bg-yt-bg-tertiary animate-pulse"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={handleLogin}
        className="px-3 py-1.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-all"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">Login con Discord</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary transition-all"
      >
        {getAvatarUrl() ? (
          <img
            src={getAvatarUrl()}
            alt={user.globalName || user.username}
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <User className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">{user.globalName || user.username}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
          ></div>

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-yt-bg-secondary border border-yt-border rounded-lg shadow-lg z-20">
            <div className="p-3 border-b border-yt-border">
              <div className="text-sm font-semibold text-yt-text-primary">
                {user.globalName || user.username}
              </div>
              {user.discriminator && user.discriminator !== '0' && (
                <div className="text-xs text-yt-text-secondary">
                  #{user.discriminator}
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-yt-bg-tertiary flex items-center gap-2 transition-all rounded-b-lg"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
