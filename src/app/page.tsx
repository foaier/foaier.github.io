import Link from "next/link";
import { PostList } from "@/components/post-list";
import { PixelRunner } from "@/components/pixel-runner";
import { getAllPosts } from "@/lib/posts";
import { series } from "@/lib/series";

export default async function HomePage() {
  const posts = await getAllPosts();

  return (
    <main className="container index">
      <PixelRunner />
      <p className="index-intro">写代码，也把技术讲明白。记录 AI 应用与后端工程的学习和实践。</p>
      <Link className="home-learning-entry" href="/learn/"><span className="section-kicker">第一次来，从这里开始</span><strong>从零学习 AI，一步步做出自己的小应用。</strong><span>认识概念 · 跟着动手 · 完成一个项目 <span aria-hidden="true">→</span></span></Link>
      <nav className="reading-paths" aria-label="系列阅读">{series.map((item, index) => {
        const first = posts.find((post) => post.series === item.name && post.order === 1);
        return first ? <Link key={item.id} href={`/articles/${first.slug}/`}><span>0{index + 1}</span>{item.name}<span aria-hidden="true">↗</span></Link> : null;
      })}</nav>
      <div className="list-heading">
        <h2>最近文章</h2>
        <Link href="/articles/">全部文章</Link>
      </div>
      <PostList posts={posts.slice(0, 10)} />
    </main>
  );
}
