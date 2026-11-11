import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../auth/AuthProvider';
import { Avatar, Logo } from './ui';

export function AppHeader({ children }: { children?: ReactNode }) {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <Link to="/" className="app-header__brand">
        <Logo />
      </Link>
      <div className="app-header__center">{children}</div>
      <div className="app-header__user">
        <Avatar name={user.name} size={32} />
        <div className="app-header__identity">
          <span className="app-header__name">{user.name}</span>
          <span className="app-header__email">{user.email}</span>
        </div>
        <button
          className="icon-button"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
          aria-label="Sign out"
          title="Sign out / switch account"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
