import {
  BookOpenIcon,
  DatabaseIcon,
  FileCogIcon,
  HouseIcon,
  MoonIcon,
  SearchCodeIcon,
  SunIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/lib/app-state";
import { useRecoverWhenReady } from "@/lib/recover";
import { useStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: HouseIcon },
  { to: "/tables", label: "Tables", icon: DatabaseIcon },
  { to: "/query", label: "Query", icon: SearchCodeIcon },
  { to: "/ingest", label: "Ingest", icon: UploadIcon },
  { to: "/delete", label: "Delete", icon: Trash2Icon },
  { to: "/config", label: "Config", icon: FileCogIcon },
  { to: "/resources", label: "Resources", icon: BookOpenIcon },
];

export function Layout() {
  const { assembly, setAssembly, theme, toggleTheme } = useAppState();
  const status = useStatus();
  useRecoverWhenReady(status);

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b bg-sidebar p-4 md:sticky md:top-0 md:h-svh md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-3 rotate-45 bg-primary" />
          <span className="text-sm font-bold tracking-widest uppercase">
            KDB-X DB Service
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="num mt-auto hidden px-3 text-xs text-muted-foreground md:block">
          v{__APP_VERSION__}
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2 sm:px-6">
          <Badge variant={status.variant}>{status.label}</Badge>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Assembly
            <Input
              id="assembly"
              className="h-7 w-36"
              placeholder="optional"
              value={assembly}
              onChange={(e) => setAssembly(e.target.value.trim())}
            />
          </label>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
