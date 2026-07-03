"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type AdminDownloadLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  refreshDelayMs?: number;
};

export function AdminDownloadLink({
  href,
  children,
  className = "button",
  refreshDelayMs = 1500
}: AdminDownloadLinkProps) {
  const router = useRouter();
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <a
      className={className}
      href={href}
      rel="noreferrer"
      target="_blank"
      onClick={() => {
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = window.setTimeout(() => {
          router.refresh();
        }, refreshDelayMs);
      }}
    >
      {children}
    </a>
  );
}

type AdminRefreshButtonProps = {
  children?: ReactNode;
  className?: string;
};

export function AdminRefreshButton({
  children = "로그 새로고침",
  className = "button secondary"
}: AdminRefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={className}
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      {isPending ? "새로고침 중..." : children}
    </button>
  );
}
