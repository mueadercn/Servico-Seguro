import { Outlet } from 'react-router';
import { FloatingChat } from './FloatingChat';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      <FloatingChat />
    </div>
  );
}
