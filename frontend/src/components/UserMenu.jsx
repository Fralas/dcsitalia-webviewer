import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Shield, User, UserCircle2, ChevronDown, X } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { t } from '../utils/locale';

function DiscordIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037 12.3 12.3 0 0 0-.608 1.25 18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
      />
    </svg>
  );
}

/**
 * User Menu Component - Discord Authentication
 */
export default function UserMenu({ onOpenProfile, onOpenPrivacy, variant = 'default' }) {
  const { user, loading, setUser } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const isBrand = variant === 'brand';

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

  const handleOpenPrivacy = () => {
    if (typeof onOpenPrivacy === 'function') {
      onOpenPrivacy();
    }
    setMenuOpen(false);
    setLoginModalOpen(false);
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${isBrand ? 'app-header__user-wrap' : 'px-3 py-1.5'}`}>
        <div className={`rounded-full bg-yt-bg-tertiary animate-pulse ${isBrand ? 'app-header__user-avatar' : 'w-6 h-6'}`} />
      </div>
    );
  }

  if (!user) {
    const loginModal = loginModalOpen ? (
      <div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
        <button
          type="button"
          className="login-modal__backdrop"
          onClick={() => setLoginModalOpen(false)}
          aria-label={t('general.auth.close')}
        />
        <div className="login-modal__panel">
          <div className="login-modal__header">
            <div>
              <h2 id="login-modal-title" className="login-modal__title">
                {t('general.auth.signInTitle')}
              </h2>
              <p className="login-modal__subtitle">
                {t('general.auth.signInHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLoginModalOpen(false)}
              className="login-modal__close"
              aria-label={t('general.auth.close')}
            >
              <X size={16} />
            </button>
          </div>

          <div className="login-modal__body">
            <button
              type="button"
              onClick={handleLogin}
              aria-label={t('general.auth.discordButton')}
              className="login-modal__discord"
            >
              <DiscordIcon className="login-modal__discord-icon" />
              {t('general.auth.discordButton')}
            </button>
            <p className="login-modal__legal">
              {t('general.auth.privacyBeforeLogin')}{' '}
              <button
                type="button"
                className="login-modal__legal-link"
                onClick={handleOpenPrivacy}
              >
                {t('general.auth.privacyLink')}
              </button>
            </p>
          </div>
        </div>
      </div>
    ) : null;

    return (
      <>
        <button
          onClick={() => setLoginModalOpen(true)}
          aria-label={t('general.auth.signInTitle')}
          className={isBrand
            ? 'app-header__login-btn'
            : 'rounded border border-yt-border/80 bg-[#151b25] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-white'}
        >
          {isBrand && <DiscordIcon className="app-header__login-discord" />}
          <span>{t('general.buttons.login')}</span>
        </button>

        {typeof document !== 'undefined' && createPortal(loginModal, document.body)}
      </>
    );
  }

  return (
    <div className={isBrand ? 'app-header__user-wrap' : 'relative'}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={isBrand
          ? 'app-header__user-btn'
          : 'flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary transition-all'}
      >
        {getAvatarUrl() ? (
          <img
            src={getAvatarUrl()}
            alt={user.globalName || user.username}
            className={isBrand ? 'app-header__user-avatar' : 'w-6 h-6 rounded-full'}
          />
        ) : (
          <User className={isBrand ? 'app-header__user-avatar' : 'w-4 h-4'} />
        )}
        <span className={isBrand ? 'app-header__user-name hidden sm:inline' : 'hidden sm:inline'}>
          {user.globalName || user.username}
        </span>
        <ChevronDown className={isBrand
          ? `app-header__user-chevron transition-transform ${menuOpen ? 'rotate-180' : ''}`
          : `w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-[5550]"
            onClick={() => setMenuOpen(false)}
          />

          <div className={isBrand
            ? 'app-header__menu'
            : 'absolute right-0 mt-2 w-48 bg-yt-bg-secondary border border-yt-border rounded-lg shadow-lg z-[5600]'}>
            <button
              type="button"
              onClick={handleOpenProfile}
              className={isBrand ? 'app-header__menu-head' : 'w-full p-3 border-b border-yt-border text-left hover:bg-yt-bg-tertiary transition-colors'}
            >
              <div className={isBrand ? 'app-header__menu-name' : 'text-sm font-semibold text-yt-text-primary'}>
                {user.globalName || user.username}
              </div>
              {user.discriminator && user.discriminator !== '0' && (
                <div className={isBrand ? 'app-header__menu-disc' : 'text-xs text-yt-text-secondary'}>
                  #{user.discriminator}
                </div>
              )}
            </button>
            <button
              onClick={handleOpenProfile}
              className={isBrand
                ? 'app-header__menu-item'
                : 'w-full px-3 py-2 text-left text-sm text-yt-text-primary hover:bg-yt-bg-tertiary flex items-center gap-2 transition-all'}
            >
              <UserCircle2 className="w-4 h-4" />
              Profilo
            </button>
            <button
              type="button"
              onClick={handleOpenPrivacy}
              className={isBrand
                ? 'app-header__menu-item'
                : 'w-full px-3 py-2 text-left text-sm text-yt-text-primary hover:bg-yt-bg-tertiary flex items-center gap-2 transition-all'}
            >
              <Shield className="w-4 h-4" />
              {t('privacy.nav')}
            </button>
            <button
              onClick={handleLogout}
              className={isBrand
                ? 'app-header__menu-item app-header__menu-item--danger'
                : 'w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-yt-bg-tertiary flex items-center gap-2 transition-all rounded-b-lg'}
            >
              <LogOut className="w-4 h-4" />
              {t('general.buttons.logout')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
