import { useState } from "react";
import {
  BookOpenIcon,
  BotIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileJsonIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LinkButton } from "@/components/LinkButton";

const SPEC_URL =
  "https://code.kx.com/kdb-x/services/db-service/api/dbservice.html";
const SPEC_YAML_URL =
  "https://github.com/KxSystems/kdbx-db-service/blob/main/openapi/dbservice.yaml";
const SKILL_URL =
  "https://github.com/KxSystems/kx-skills/tree/main/plugins/kdbx-knowledge/skills/kdbx-db-service";
const DOCS_URL =
  "https://code.kx.com/kdb-x/services/db-service/introduction.html";

function External({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <LinkButton href={href} external>
      {children}
      <ExternalLinkIcon />
    </LinkButton>
  );
}

function Command({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the command is still selectable text */
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-1.5">
      <code className="min-w-0 flex-1 font-mono text-xs break-all">{text}</code>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Copy ${text}`}
        onClick={copy}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="num flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-sm">{title}</span>
        {children}
      </div>
    </li>
  );
}

export function ResourcesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl">Resources</h1>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJsonIcon className="size-4" /> Open API Spec
              </CardTitle>
              <CardDescription>
                The OpenAPI spec for the DB Service REST API, as browsable
                documentation on code.kx.com. The raw YAML is the file that
                ships in the DB Service repository.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <LinkButton href={SPEC_URL} external variant="default">
                View spec <ExternalLinkIcon />
              </LinkButton>
              <External href={SPEC_YAML_URL}>dbservice.yaml</External>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenIcon className="size-4" /> DB Service documentation
              </CardTitle>
              <CardDescription>
                Guides for architecture, importing, querying, managing tables,
                and deleting data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <External href={DOCS_URL}>code.kx.com</External>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BotIcon className="size-4" /> Official Claude skill
            </CardTitle>
            <CardDescription>
              The KX kdbx-db-service skill teaches Claude Code how to work with
              this service: tables, imports, queries, deletes, and
              troubleshooting. It ships in the kdbx-knowledge plugin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3">
              <Step n={1} title="In Claude Code, add the KX marketplace:">
                <Command text="/plugin marketplace add KxSystems/kx-skills" />
              </Step>
              <Step n={2} title="Install the plugin:">
                <Command text="/plugin install kdbx-knowledge@kx-skills" />
              </Step>
              <Step n={3} title="Activate it without restarting the session:">
                <Command text="/reload-plugins" />
              </Step>
              <Step
                n={4}
                title="Ask Claude about the DB Service, for example how to ingest a CSV. The skill loads automatically."
              />
            </ol>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground select-none">
                Using Codex instead
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <Command text="codex plugin marketplace add https://github.com/KxSystems/kx-skills.git" />
                <Command text="codex plugin add kdbx-knowledge@kx-skills" />
              </div>
            </details>
            <p className="text-xs text-muted-foreground">
              To update later, run /plugin marketplace update kx-skills. The
              plugin also bundles an MCP server, which /reload-plugins starts.
            </p>
            <div>
              <External href={SKILL_URL}>View on GitHub</External>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
