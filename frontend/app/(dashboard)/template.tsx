/**
 * Route transition wrapper for dashboard pages.
 * `template.tsx` remounts on every navigation, so the fade replays on each
 * route change while the SideNav/TabBar in the layout stay static.
 * Opacity-only — never transforms — so browser scroll restoration on
 * back/forward is preserved exactly.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-fade flex flex-1 flex-col">{children}</div>;
}
