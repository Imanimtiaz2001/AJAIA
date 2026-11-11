import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';

export function NotFoundPage({ message = 'This page does not exist.' }: { message?: string }) {
  return (
    <main className="full-page-center not-found">
      <Logo size={36} />
      <h1>Nothing here</h1>
      <p className="muted">{message}</p>
      <Link to="/" className="button button--primary">
        Back to documents
      </Link>
    </main>
  );
}
