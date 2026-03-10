import { useState } from 'react';
import { LogOut, User, ChevronDown, UserCircle, X } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

/**
 * User Menu Component - Discord Authentication
 */
export default function UserMenu({ onProfileOpen }) {
  const { user, loading, setUser } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const handleLogin = () => {
    window.location.href = '/api/auth/discord';
  };

  const handleProfileOpen = () => {
    setMenuOpen(false);
    if (onProfileOpen) {
      onProfileOpen();
    }
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
      <>
        <button
          onClick={() => setLoginModalOpen(true)}
          aria-label="Open login window"
          className="rounded border border-yt-border/80 bg-[#151b25] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-white"
        >
          Login
        </button>

        {loginModalOpen && (
          <div className="fixed inset-0 z-[2000] grid place-items-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-[#05070bcc] backdrop-blur-sm"
              onClick={() => setLoginModalOpen(false)}
              aria-label="Close login modal"
            />
            <div className="relative w-[min(420px,92vw)] rounded-xl border border-yt-border bg-[#101722] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-yt-text-primary">Sign in</div>
                  <div className="text-[11px] text-yt-text-secondary">Authenticate to accept and manage missions</div>
                </div>
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(false)}
                  className="rounded border border-yt-border p-1 text-yt-text-secondary transition-colors hover:text-yt-text-primary"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={handleLogin}
                aria-label="Login with Discord"
                className="w-full rounded border border-[#5a68ea] bg-[#5865f2] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4a56d4]"
              >
                Continue with Discord
              </button>
            </div>
          </div>
        )}
      </>
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
              onClick={handleProfileOpen}
              className="w-full px-3 py-2 text-left text-sm text-yt-text-primary hover:bg-yt-bg-tertiary flex items-center gap-2 transition-all"
            >
              <UserCircle className="w-4 h-4" />
              Profilo
            </button>
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
