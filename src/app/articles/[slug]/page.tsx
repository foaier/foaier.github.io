import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/posts";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "文章未找到" };

  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      publishedTime: post.date || undefined,
      tags: post.tags,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="container page-main article-main">
      <Link className="back-link" href="/articles/">
        <ArrowLeft aria-hidden="true" size={16} /> 返回文章列表
      </Link>
      <article>
        <header className="article-header">
          <p className="eyebrow"><span className="eyebrow-dot" />Field notes</p>
          <h1>{post.title}</h1>
          <div className="article-meta">
            <CalendarDays aria-hidden="true" size={15} />
            <time dateTime={post.date}>{post.date}</time>
            {post.tags.map((tag) => <span className="post-tag" key={tag}>{tag}</span>)}
          </div>
          {post.summary ? <p className="article-summary">{post.summary}</p> : null}
        </header>
        <div className="article-content">{post.content}</div>
      </article>
    </main>
  );
}
