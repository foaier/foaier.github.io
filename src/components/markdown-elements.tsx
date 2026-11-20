"use client";

import { useRef, useState, type ReactNode } from "react";

export function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState("复制");
  async function copy() {
    try {
      await navigator.clipboard.writeText(ref.current?.textContent ?? "");
      setStatus("已复制");
    } catch {
      setStatus("请选中代码复制");
    }
  }
  return (
    <div className="code-block">
      <div className="code-toolbar"><span aria-hidden="true">CODE</span><button type="button" onClick={copy} aria-live="polite" aria-label={`代码：${status}`}>{status}</button></div>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll long code lines. */}
      <section className="code-scroll" aria-label="代码示例，可横向滚动" tabIndex={0}><pre ref={ref}>{children}</pre></section>
    </div>
  );
}

export function MarkdownTable({ children }: { children?: ReactNode }) {
  // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll wide tables.
  return <section className="table-scroll" aria-label="对照表，可横向滚动" tabIndex={0}><table>{children}</table></section>;
}
