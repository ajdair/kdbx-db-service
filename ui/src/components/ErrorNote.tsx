import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";

export function ErrorNote({
  error,
  title = "Request failed",
}: {
  error: unknown;
  title?: string;
}) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const hint = error instanceof ApiError ? error.hint : undefined;
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <span className="font-mono text-xs whitespace-pre-wrap">{message}</span>
        {hint ? <span className="mt-1 block">{hint}</span> : null}
      </AlertDescription>
    </Alert>
  );
}
