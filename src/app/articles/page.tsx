import type { Metadata } from "next";
import Link from "next/link";
import { ArticleIndex } from "@/components/article-index";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "文章",
  description: "用人话聊 AI、知识库、Agent 与工程实践，从概念到动手，按系列慢慢读。",
};

export default async function ArticlesPage() {
  const posts = await getAllPosts();

  return (
    <main className="container page-main archive-main">
      <header className="archive-header"><p className="section-kicker">NOTES & TUTORIALS</p><h1>把技术讲明白。</h1><p>从一个问题出发，把概念、代码和容易踩的坑串起来。</p></header>
      <p className="archive-learning-link">刚开始接触 AI？<Link href="/learn/">先看学习路线 →</Link></p>
      <ArticleIndex posts={posts} />
    </main>
  );
}
