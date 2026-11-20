import Link from "next/link";
import type { PostSummary } from "@/lib/posts";

export function PostList({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) {
    return <p className="empty-posts">文章整理中。</p>;
  }

  return (
    <div className="post-list">
      {posts.map((post) => (
        <article className="post-item" key={post.slug}>
          <time className="post-date" dateTime={post.date}>{post.date || "待定"}</time>
          <Link className="post-title" href={`/articles/${post.slug}/`}>{post.title}</Link>
        </article>
      ))}
    </div>
  );
}
