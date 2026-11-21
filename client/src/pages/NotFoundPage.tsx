import { ArrowLeft, MapPinOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../components/Layout';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="container empty" style={{ paddingTop: '3rem' }}>
      <span className="icon-tile lg slate" aria-hidden="true">
        <MapPinOff size={24} />
      </span>
      <h1>Page not found</h1>
      <p style={{ margin: '0.5rem 0 1.75rem' }}>The page you’re looking for doesn’t exist.</p>
      <Link className="btn btn-primary" to="/">
        <ArrowLeft size={16} aria-hidden="true" /> Back to home
      </Link>
    </div>
  );
}
