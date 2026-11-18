import type { Metadata } from "next";
import { PostList } from "@/components/post-list";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "文章",
  description: "关于企业系统、后端工程、数据迁移与平台建设的技术文章。",
};

export default async function ArticlesPage() {
  const posts = await getAllPosts();

  return (
    <main className="container page-main">
      <h2 className="page-title">文章归档</h2>
      <PostList posts={posts} />
    </main>
  );
}
