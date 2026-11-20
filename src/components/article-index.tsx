"use client";

import Link from "next/link";
import { useState } from "react";
import type { PostSummary } from "@/lib/posts";
import { series, seriesId } from "@/lib/series";

export function ArticleIndex({ posts }: { posts: PostSummary[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("全部");
  const categories = [...series.map((item) => item.name), "工程笔记"];
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = posts.filter((post) => {
    const text = `${post.title} ${post.summary} ${post.tags.join(" ")} ${post.series}`.toLocaleLowerCase();
    return (selected === "全部" || post.series === selected) && terms.every((term) => text.includes(term));
  });
  return (
    <>
      <div className="archive-tools">
        <label className="search-label" htmlFor="article-search">找一篇文章</label>
        <input id="article-search" className="article-search" type="search" placeholder="搜索标题、简介或标签，比如 RAG、MCP…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <fieldset className="series-filters"><legend className="visually-hidden">按系列筛选</legend>
          {["全部", ...categories].map((name) => <button type="button" key={name} aria-pressed={selected === name} onClick={() => setSelected(name)}>{name}<span>{posts.filter((post) => name === "全部" || post.series === name).length}</span></button>)}
        </fieldset>
        <p className="search-status" role="status">{query || selected !== "全部" ? `找到 ${filtered.length} 篇文章` : "按系列慢慢读，也可以直接找你正在解决的问题。"}</p>
      </div>
      {categories.map((name) => {
        const items = filtered.filter((post) => post.series === name).sort((a, b) => a.order - b.order);
        if (!items.length) return null;
        return (
          <section className="archive-series" id={`series-${seriesId(name)}`} key={name}>
            <header className="series-heading"><h2>{name}<span>{String(items.length).padStart(2, "0")}</span></h2><p>{series.find((item) => item.name === name)?.description ?? "从实际问题里积累下来的经验。"}</p></header>
            <ol className="archive-list">
              {items.map((post) => <li key={post.slug}>
                <span className="article-number" aria-hidden="true">{String(post.order || 1).padStart(2, "0")}</span>
                <article><h3><Link href={`/articles/${post.slug}/`}>{post.title}</Link></h3><p>{post.summary}</p><div className="archive-meta"><time dateTime={post.date}>{post.date}</time><span>约 {post.readingMinutes} 分钟</span><span>{post.tags.slice(0, 2).join(" / ")}</span></div></article>
                <span className="article-arrow" aria-hidden="true">↗</span>
              </li>)}
            </ol>
          </section>
        );
      })}
      {!filtered.length && <div className="search-empty"><p>暂时没有匹配的文章，试试更短的关键词。</p><button type="button" onClick={() => { setQuery(""); setSelected("全部"); }}>查看全部文章</button></div>}
    </>
  );
}
