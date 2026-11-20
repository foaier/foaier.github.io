import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { series } from "@/lib/series";

export const metadata: Metadata = {
  title: "从零学习 AI",
  description: "一条面向新手的 AI 学习路线：从认识大模型，到用 C# 完成自己的知识助手。",
};

export default async function LearnPage() {
  const posts = await getAllPosts();
  return (
    <main className="container page-main learn-main">
      <header className="learn-hero">
        <p className="section-kicker">一步一步，把 AI 学明白</p>
        <h1>从第一次提问，<br />到自己的 AI 小应用。</h1>
        <p>不需要一开始就懂算法、向量数据库或 Agent。先从熟悉的问题出发，每一篇弄明白一件事，再动手试一试。</p>
        <Link className="learn-start" href="/articles/ai-map/">从第一课开始 <span aria-hidden="true">→</span></Link>
        <Link className="learn-secondary" href="#learning-route">看看学习路线 ↓</Link>
      </header>
      <section className="learn-orientation" aria-labelledby="orientation-title">
        <h2 id="orientation-title">找到适合自己的起点</h2>
        <div><p><strong>还不会编程</strong><br />先读 AI 基础，用浏览器完成提问和判断练习。想动手开发时，再进入环境准备与 C# 小练习。</p>
          <p><strong>已经会写一点代码</strong><br />从 AI 编程起步开始。熟悉的内容可以跳过，遇到陌生概念就沿着文章里的“先读这几篇”补上。</p></div>
        <p className="learn-note">先走完标有“学习主线”的部分。记忆服务、Skills 和复杂工作流都是进阶选读，不用为了入门一次学完。</p>
      </section>
      <section id="learning-route" className="learning-route" aria-labelledby="route-title">
        <h2 id="route-title">你的学习路线</h2>
        {series.map((stage, index) => {
          const chapters = posts.filter((post) => post.series === stage.name).sort((a, b) => a.order - b.order);
          return <section className="learning-stage" id={`stage-${stage.id}`} key={stage.id}>
            <span className="stage-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div><div className="stage-label"><span>{stage.core ? "学习主线" : "进阶选读"}</span><span>{chapters.length} 篇 · {stage.audience}</span></div>
              <h3>{stage.name}</h3><p>{stage.description}</p>
              <p className="stage-outcome"><strong>学完能做什么：</strong>{stage.outcome}</p>
              {stage.recommended.length > 0 && <div className="stage-recommended"><p>第一次学习，先读这几篇</p><ol>{stage.recommended.map((slug) => { const post = posts.find((item) => item.slug === slug); return post ? <li key={slug}><Link href={`/articles/${slug}/`}>{post.title}</Link></li> : null; })}</ol></div>}
              <details className="stage-chapters"><summary>展开章节目录<span>{chapters.length} 篇</span></summary><ol>{chapters.map((post) => <li key={post.slug}><Link href={`/articles/${post.slug}/`}>{post.title}</Link><span>约 {post.readingMinutes} 分钟</span></li>)}</ol></details>
              <Link className="stage-entry" href={`/articles/${stage.start}/`}>进入这一阶段 →</Link>
            </div>
          </section>;
        })}
      </section>
      <aside className="learn-closing"><h2>读完之后，记得亲手改一次。</h2><p>先运行文章中的例子，再换一个输入，最后完成小练习。遇到错误先看预期结果和排错说明；能解释“为什么这样写”，比记住一个 API 名称更有用。</p><Link href="/articles/">按主题查找全部文章 →</Link></aside>
    </main>
  );
}
