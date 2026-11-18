import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Fragment, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import matter from "gray-matter";
import rehypeReact from "rehype-react";
import rehypeSanitize from "rehype-sanitize";
import { remark } from "remark";
import remarkRehype from "remark-rehype";

export type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  content: ReactNode;
};

const postsDirectory = path.join(process.cwd(), "src", "content", "posts");

function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value : "";
}

export async function getAllPosts(): Promise<Post[]> {
  if (!existsSync(postsDirectory)) return [];

  const files = readdirSync(postsDirectory).filter((file) => file.endsWith(".md"));
  const posts = await Promise.all(
    files.map(async (file) => {
      const source = readFileSync(path.join(postsDirectory, file), "utf8");
      const { content, data } = matter(source);
      const rendered = await remark()
        .use(remarkRehype)
        .use(rehypeSanitize)
        .use(rehypeReact, { Fragment, jsx, jsxs })
        .process(content);

      return {
        slug: path.basename(file, ".md"),
        title: typeof data.title === "string" ? data.title : path.basename(file, ".md"),
        date: formatDate(data.date),
        summary: typeof data.summary === "string" ? data.summary : "",
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        content: rendered.result as ReactNode,
      };
    }),
  );

  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const posts = await getAllPosts();
  return posts.find((post) => post.slug === slug);
}
