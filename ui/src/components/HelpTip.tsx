import { CircleHelpIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// A question mark that explains a field on hover or keyboard focus.
// With an href it is a link to a reference page that opens in a new tab.
export function HelpTip({
  children,
  href,
}: {
  children: string;
  href?: string;
}) {
  const cls = "text-muted-foreground hover:text-foreground";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={children}
              className={cls}
            />
          ) : (
            <button type="button" aria-label={children} className={cls} />
          )
        }
      >
        <CircleHelpIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{children}</TooltipContent>
    </Tooltip>
  );
}
