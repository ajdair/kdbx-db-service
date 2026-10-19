import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Small persisted preferences: selected assembly, theme, and the job ids this browser created
// (the API has no job-list endpoint, so the UI remembers its own).

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: preferences just will not persist */
  }
}

export type Theme = "dark" | "light";

export interface TrackedJob {
  id: string;
  kind: "import" | "delete";
  table: string;
  createdAt: string;
  assembly?: string;
}

interface AppState {
  assembly: string;
  setAssembly: (a: string) => void;
  theme: Theme;
  toggleTheme: () => void;
  jobs: TrackedJob[];
  trackJob: (job: TrackedJob) => void;
  forgetJob: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

function initialTheme(): Theme {
  const saved = read("kx-ui-theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function initialJobs(): TrackedJob[] {
  try {
    const parsed = JSON.parse(read("kx-ui-jobs") ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [assembly, setAssemblyState] = useState(
    () => read("kx-ui-assembly") ?? "",
  );
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [jobs, setJobs] = useState<TrackedJob[]>(initialJobs);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Persist only an explicit choice - an unset theme keeps following the OS setting.
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      write("kx-ui-theme", next);
      return next;
    });
  }, []);

  const setAssembly = useCallback((a: string) => {
    setAssemblyState(a);
    write("kx-ui-assembly", a);
  }, []);

  const trackJob = useCallback((job: TrackedJob) => {
    setJobs((prev) => {
      const next = [job, ...prev.filter((j) => j.id !== job.id)].slice(0, 50);
      write("kx-ui-jobs", JSON.stringify(next));
      return next;
    });
  }, []);

  const forgetJob = useCallback((id: string) => {
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);
      write("kx-ui-jobs", JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      assembly,
      setAssembly,
      theme,
      toggleTheme,
      jobs,
      trackJob,
      forgetJob,
    }),
    [assembly, setAssembly, theme, toggleTheme, jobs, trackJob, forgetJob],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used inside AppStateProvider");
  return v;
}
