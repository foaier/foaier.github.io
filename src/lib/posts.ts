import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { cache, Fragment, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import type { Root } from "hast";
import { toString as textContent } from "hast-util-to-string";
import matter from "gray-matter";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import powershell from "highlight.js/lib/languages/powershell";
import rehypeHighlight from "rehype-highlight";
import rehypeReact from "rehype-react";
import rehypeSanitize from "rehype-sanitize";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import { visit } from "unist-util-visit";
import { CodeBlock, MarkdownTable } from "@/components/markdown-elements";
import { series } from "@/lib/series";

export type PostSummary = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  series: string;
  order: number;
  readingMinutes: number;
  prerequisites: string[];
  goals: string[];
  level: string;
};

export type Heading = { id: string; text: string; level: number };
export type Post = PostSummary & { content: ReactNode; headings: Heading[] };
const postsDirectory = path.join(process.cwd(), "src", "content", "posts");

function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value : "";
}

const getSources = cache(() => {
  if (!existsSync(postsDirectory)) return [];

  const files = readdirSync(postsDirectory).filter((file) => file.endsWith(".md"));
  const posts = files.map((file) => {
      const source = readFileSync(path.join(postsDirectory, file), "utf8");
      const { content, data } = matter(source);
      const chinese = content.match(/[\u3400-\u9fff]/g)?.length ?? 0;
      const words = content.replace(/[\u3400-\u9fff]/g, " ").match(/[a-zA-Z0-9_]+/g)?.length ?? 0;
      const metadata: PostSummary = {
        slug: path.basename(file, ".md"),
        title: typeof data.title === "string" ? data.title : path.basename(file, ".md"),
        date: formatDate(data.date),
        summary: typeof data.summary === "string" ? data.summary : "",
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        series: typeof data.series === "string" ? data.series : "工程笔记",
        order: typeof data.order === "number" ? data.order : 0,
        readingMinutes: Math.max(1, Math.ceil(chinese / 300 + words / 180)),
        prerequisites: Array.isArray(data.prerequisites) ? data.prerequisites.map(String) : [],
        goals: Array.isArray(data.goals) ? data.goals.map(String) : [],
        level: typeof data.level === "string" ? data.level : "",
      };
      return { metadata, source: content };
    });

  const rank = (name: string) => {
    const index = series.findIndex((item) => item.name === name);
    return index < 0 ? series.length : index;
  };
  return posts.sort((a, b) => b.metadata.date.localeCompare(a.metadata.date)
    || rank(a.metadata.series) - rank(b.metadata.series)
    || a.metadata.order - b.metadata.order
    || a.metadata.slug.localeCompare(b.metadata.slug));
});

export async function getAllPosts(): Promise<PostSummary[]> {
  return getSources().map(({ metadata }) => metadata);
}

export const getPostBySlug = cache(async (slug: string): Promise<Post | undefined> => {
  const entry = getSources().find(({ metadata }) => metadata.slug === slug);
  if (!entry) return undefined;
  const headings: Heading[] = [];
  const ids = new Map<string, number>();
  const collectHeadings = () => (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      const text = textContent(node);
      const base = `section-${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "heading"}`;
      const count = ids.get(base) ?? 0;
      ids.set(base, count + 1);
      const id = count ? `${base}-${count + 1}` : base;
      node.properties.id = id;
      headings.push({ id, text, level: Number(node.tagName.slice(1)) });
    });
  };
  const rendered = await remark().use(remarkGfm).use(remarkRehype).use(rehypeSanitize)
    .use(collectHeadings).use(rehypeHighlight, { detect: false, ignoreMissing: true, languages: { dockerfile, powershell } })
    .use(rehypeReact, { Fragment, jsx, jsxs, components: { pre: CodeBlock, table: MarkdownTable } })
    .process(entry.source);
  return { ...entry.metadata, content: rendered.result as ReactNode, headings };
});
