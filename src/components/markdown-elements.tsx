"use client";

import { Check, Copy, CopyX } from "lucide-react";
import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";

function getCodeText(children: ReactNode): string {
  return Children.toArray(children).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (isValidElement<{ children?: ReactNode }>(child)) return getCodeText(child.props.children);
    return "";
  }).join("");
}

export function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const code = Children.toArray(children).find((child) => isValidElement<{ className?: string }>(child));
  const language = isValidElement<{ className?: string }>(code)
    ? code.props.className?.match(/language-([\w-]+)/)?.[1] ?? "code" : "code";
  const lineCount = getCodeText(children).replace(/\n$/, "").split("\n").length;
  const copyLabel = status === "copied" ? "已复制" : status === "error" ? "复制失败，请选中代码后手动复制" : "复制代码";
  const CopyIcon = status === "copied" ? Check : status === "error" ? CopyX : Copy;

  useEffect(() => () => {
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
  }, []);

  async function copy() {
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(ref.current?.textContent ?? "");
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    resetTimer.current = setTimeout(() => setStatus("idle"), 2500);
  }
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span className="code-window-dots" aria-hidden="true"><span /><span /><span /></span>
        <span className="code-language">{language}</span>
        <span className="code-copy-status" role="status">{status === "copied" ? "已复制" : status === "error" ? "请选中代码后手动复制" : ""}</span>
        <button className="code-copy" type="button" onClick={copy} aria-label={copyLabel} title={copyLabel} data-status={status}>
          <CopyIcon size={16} aria-hidden="true" />
        </button>
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll long code lines. */}
      <section className="code-scroll" aria-label={`${language} 代码示例，可横向滚动`} tabIndex={0}>
        <div className="code-line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_,index) => index + 1).map((line) => <span key={line}>{line}</span>)}
        </div>
        <pre ref={ref}>{children}</pre>
      </section>
    </div>
  );
}

export function MarkdownTable({ children }: { children?: ReactNode }) {
  // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll wide tables.
  return <section className="table-scroll" aria-label="对照表，可横向滚动" tabIndex={0}><table>{children}</table></section>;
}
