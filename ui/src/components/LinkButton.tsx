import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type Style = VariantProps<typeof buttonVariants>;

// a link that looks like a button
export function LinkButton({
  to,
  href,
  download,
  external,
  variant = "outline",
  size = "sm",
  className,
  children,
}: {
  to?: string;
  href?: string;
  download?: string;
  external?: boolean;
} & Style & { className?: string; children: React.ReactNode }) {
  const cls = cn(buttonVariants({ variant, size }), className);
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      download={download}
      className={cls}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
