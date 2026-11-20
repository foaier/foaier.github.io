import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/posts";
import { seriesId } from "@/lib/series";

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
    alternates: { canonical: `/articles/${post.slug}/` },
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
  const siblings = (await getAllPosts()).filter((item) => item.series === post.series).sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((item) => item.slug === slug);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];
  const toc = <ol>{post.headings.filter((heading) => heading.level === 2).map((heading) => <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ol>;

  return (
    <main className="container page-main article-main" id="article-top">
      <Link className="back-link" href="/articles/">
        <ArrowLeft aria-hidden="true" size={16} /> 返回文章列表
      </Link>
      <div className="reading-layout"><article>
        <header className="article-header">
          <p className="section-kicker"><Link href={`/articles/#series-${seriesId(post.series)}`}>{post.series}</Link>{post.order > 0 ? ` / ${String(post.order).padStart(2, "0")}` : ""}</p>
          <h1>{post.title}</h1>
          <div className="article-meta">
            <time dateTime={post.date}>{post.date}</time>
            <span>约 {post.readingMinutes} 分钟</span>
            {post.tags.map((tag) => <span className="post-tag" key={tag}>{tag}</span>)}
          </div>
          {post.summary ? <p className="article-summary">{post.summary}</p> : null}
        </header>
        {!!post.headings.length && <details className="mobile-toc"><summary>这篇聊什么<span>展开目录</span></summary><nav aria-label="本文目录">{toc}</nav></details>}
        <div className="article-content">{post.content}</div>
        {(previous || next) && <nav className="series-pagination" aria-label="系列阅读">
          <div>{previous && <Link href={`/articles/${previous.slug}/`}><span>← 上一篇</span>{previous.title}</Link>}</div>
          <div>{next && <Link href={`/articles/${next.slug}/`}><span>下一篇 →</span>{next.title}</Link>}</div>
        </nav>}
      </article>
      <aside className="article-sidebar"><nav className="desktop-toc" aria-label="本文目录"><p className="section-kicker">这篇聊什么</p>{toc}<a className="back-to-top" href="#article-top">↑ 回到开头</a></nav></aside>
      </div>
    </main>
  );
}
