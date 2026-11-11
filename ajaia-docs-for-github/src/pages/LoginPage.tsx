import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { Avatar, Logo, Spinner } from '../components/ui';

/** Seeded accounts (see server/db/seed.ts). Shown so reviewers can switch users in one click. */
const DEMO_ACCOUNTS = [
  { name: 'Alice Khan', email: 'alice@ajaia.test', note: 'Owns “Q3 Product Planning”' },
  { name: 'Bob Mirza', email: 'bob@ajaia.test', note: 'Owns “Team Onboarding Checklist”' },
  { name: 'Carol Ahmed', email: 'carol@ajaia.test', note: 'Owns a private doc' },
];
const DEMO_PASSWORD = 'demo1234';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = (location.state as { from?: string } | null)?.from ?? '/';
  if (user) return <Navigate to={destination} replace />;

  const signIn = async (credentials: { email: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(credentials.email.trim(), credentials.password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    void signIn({ email, password });
  };

  return (
    <main className="login">
      <section className="login__intro">
        <Logo size={36} />
        <h1>Write together, without the clutter.</h1>
        <p>
          A focused document editor for teams: rich-text docs, file import, and simple sharing with clear owner, editor
          and viewer roles.
        </p>
        <ul className="login__points">
          <li>Autosaves as you type, with conflict protection</li>
          <li>Import .docx, Markdown or plain text</li>
          <li>Share with teammates as viewer or editor</li>
        </ul>
      </section>

      <section className="login__panel">
        <form className="card login__form" onSubmit={onSubmit} noValidate>
          <h2>Sign in</h2>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ajaia.test"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button--primary button--block" type="submit" disabled={submitting}>
            {submitting ? <Spinner label="Signing in" /> : 'Sign in'}
          </button>
        </form>

        <div className="card demo-accounts">
          <div className="demo-accounts__header">
            <h3>Demo accounts</h3>
            <span className="muted">
              Password <code>{DEMO_PASSWORD}</code>
            </span>
          </div>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="demo-account"
              disabled={submitting}
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
                void signIn({ email: account.email, password: DEMO_PASSWORD });
              }}
            >
              <Avatar name={account.name} size={34} />
              <span className="demo-account__text">
                <strong>{account.name}</strong>
                <span>
                  {account.email} · {account.note}
                </span>
              </span>
              <ArrowRight size={16} className="demo-account__arrow" />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
