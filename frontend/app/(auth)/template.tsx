/**
 * Route transition wrapper for auth pages. Opacity-only fade so switching
 * between sign in / register / reset feels continuous without layout jump.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-fade">{children}</div>;
}
