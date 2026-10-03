import { initialAuthState } from "@projectx/contracts/foundation";
import {
  homeRoute,
  navigationRoutes,
  routes,
} from "@projectx/contracts/routes";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useMemo,
} from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { AccountsPage } from "./people/accounts/page";
import { AddUserPage } from "./people/add-user/page";

type ErrorState = { failed: boolean };
export class ShellErrorBoundary extends Component<
  { children: ReactNode },
  ErrorState
> {
  override state: ErrorState = { failed: false };
  static getDerivedStateFromError(): ErrorState {
    return { failed: true };
  }
  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    /* Future telemetry seam; no sensitive data logged. */
  }
  override render(): ReactNode {
    return this.state.failed ? (
      <main>
        <h1>Page unavailable</h1>
        <p>Try reloading this page.</p>
      </main>
    ) : (
      this.props.children
    );
  }
}
const modules = [...new Set(navigationRoutes.map((route) => route.moduleId))];
function routeFor(path: string) {
  if (path === "/") return homeRoute;
  return routes.find(
    (route) =>
      route.routePattern &&
      !route.surfaceOnly &&
      matchPath({ path: route.routePattern, end: true }, path),
  );
}
export function Shell() {
  const location = useLocation();
  const current = routeFor(location.pathname);
  useEffect(() => {
    document.title = `${current?.name ?? "Not found"} | ProjectX foundation`;
  }, [current]);
  const grouped = useMemo(
    () =>
      modules.map((id) => ({
        id,
        entries: navigationRoutes.filter((route) => route.moduleId === id),
      })),
    [],
  );
  return (
    <ShellErrorBoundary>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="layout">
        <header>
          <strong>ProjectX foundation</strong>
          <span>
            {initialAuthState.status === "UNAVAILABLE"
              ? "Authentication and venue context are not connected"
              : "Authorized context"}
          </span>
        </header>
        <nav aria-label="Application navigation">
          <ul>
            {grouped.map(({ id, entries }) => (
              <li key={id}>
                <details>
                  <summary>{id}</summary>
                  <ul>
                    {entries.map((entry) => (
                      <li key={entry.screenId}>
                        <Link
                          to={entry.routePattern ?? "/"}
                          aria-current={
                            current?.screenId === entry.screenId
                              ? "page"
                              : undefined
                          }
                        >
                          {entry.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </nav>
        <main
          id="main"
          tabIndex={-1}
          className={
            current?.screenId === "SCR-025" ? "accounts-main" : undefined
          }
        >
          {current?.screenId === "SCR-025" ? (
            <AccountsPage />
          ) : current?.screenId === "SCR-026" ? (
            <AddUserPage />
          ) : current ? (
            <>
              <h1>{current.name}</h1>
              <p>Feature not implemented yet.</p>
              <p>
                Screen {current.screenId} · Module {current.moduleId}
              </p>
            </>
          ) : (
            <>
              <h1>Page not found</h1>
              <p>This route is not in the mapped shell.</p>
            </>
          )}
        </main>
      </div>
    </ShellErrorBoundary>
  );
}
