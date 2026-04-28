import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, User, UserCircle2, ChevronDown, X } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

/**
 * User Menu Component - Discord Authentication
 */
export default function UserMenu({ onOpenProfile }) {
  const { user, loading, setUser } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

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

  const handleOpenProfile = () => {
    if (typeof onOpenProfile === 'function') {
      onOpenProfile();
    }
    setMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="w-6 h-6 rounded-full bg-yt-bg-tertiary animate-pulse"></div>
      </div>
    );
  }

  if (!user) {
    const loginModal = loginModalOpen ? (
      <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-[#05070bcc] backdrop-blur-md"
          onClick={() => setLoginModalOpen(false)}
          aria-label="Close login modal"
        />
        <div className="relative w-[min(560px,94vw)] rounded-2xl border border-yt-border/90 bg-[#101722f2] p-6 shadow-[0_24px_72px_rgba(0,0,0,0.6)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-yt-text-primary">Sign in</div>
              <div className="text-sm text-yt-text-secondary">Authenticate to accept and manage missions</div>
            </div>
            <button
              type="button"
              onClick={() => setLoginModalOpen(false)}
              className="rounded border border-yt-border p-1.5 text-yt-text-secondary transition-colors hover:text-yt-text-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleLogin}
            aria-label="Login with Discord"
            className="w-full rounded-lg border border-[#5a68ea] bg-[#5865f2] px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-[#4a56d4]"
          >
            Continue with Discord
          </button>
        </div>
      </div>
    ) : null;

    return (
      <>
        <button
          onClick={() => setLoginModalOpen(true)}
          aria-label="Open login window"
          className="rounded border border-yt-border/80 bg-[#151b25] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-white"
        >
          Login
        </button>

        {typeof document !== 'undefined' && createPortal(loginModal, document.body)}
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
            <button
              type="button"
              onClick={handleOpenProfile}
              className="w-full p-3 border-b border-yt-border text-left hover:bg-yt-bg-tertiary transition-colors"
            >
              <div className="text-sm font-semibold text-yt-text-primary">
                {user.globalName || user.username}
              </div>
              {user.discriminator && user.discriminator !== '0' && (
                <div className="text-xs text-yt-text-secondary">
                  #{user.discriminator}
                </div>
              )}
            </button>
            <button
              onClick={handleOpenProfile}
              className="w-full px-3 py-2 text-left text-sm text-yt-text-primary hover:bg-yt-bg-tertiary flex items-center gap-2 transition-all"
            >
              <UserCircle2 className="w-4 h-4" />
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
