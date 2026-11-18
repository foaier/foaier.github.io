import Link from "next/link";
import { PostList } from "@/components/post-list";
import { PixelRunner } from "@/components/pixel-runner";
import { getAllPosts } from "@/lib/posts";

export default async function HomePage() {
  const posts = await getAllPosts();

  return (
    <main className="container index">
      <PixelRunner />
      <p className="index-intro">记录企业系统、数据迁移与平台建设的实践。</p>
      <div className="list-heading">
        <h2>最近文章</h2>
        <Link href="/articles/">全部文章</Link>
      </div>
      <PostList posts={posts.slice(0, 10)} />
    </main>
  );
}
