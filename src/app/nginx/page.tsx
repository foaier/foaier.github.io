import type { Metadata } from "next";
import Link from "next/link";
import curriculum from "@/content/nginx-curriculum.json";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Nginx 从入门到实战",
  description: "12 篇 Nginx 教程：从第一个网页，到反向代理、负载均衡、HTTPS、缓存、限流、日志排错与高可用。附完整实验配置。",
};

export default async function NginxPage() {
  const posts = await getAllPosts();
  const count = curriculum.reduce((total, stage) => total + stage.posts.length, 0);
  return (
    <main className="container page-main container-course">
      <header className="container-hero">
        <p className="section-kicker">NGINX / 从请求到响应</p>
        <h1>网页为什么能打开，<br />打不开又该查哪里。</h1>
        <p>从一个本地网页开始，把反向代理、负载均衡和 HTTPS 一步步加上去。每次改配置，都用一条请求看看结果；最后亲手制造几次故障，再顺着日志找到原因。</p>
        <div className="container-hero-meta"><span>{count} 课 · 四个阶段</span><span>完整配置可下载</span><span>概念 · 命令 · 实验 · 排错</span></div>
        <Link className="learn-start" href="/articles/nginx-start/">从第一个网页开始 <span aria-hidden="true">→</span></Link>
        <Link className="learn-secondary" href="#nginx-route">先看看章节 ↓</Link>
      </header>
      <section className="container-course-note">
        <h2>一套环境，跟着十二篇慢慢练。</h2>
        <p>主线使用 Docker Compose 启动一个 Nginx 入口和两个演示后端。Windows 在 WSL 的 Ubuntu 终端操作，macOS/Linux 使用 Bash。示例会展示实际路径、节点名称和响应头，不需要先写一套业务系统。</p>
        <p>每课都有独立配置，切换前先检查，失败可以回到上一版。第 11 课的 Keepalived 主备需要另外准备两台同网段 Linux 虚拟机；暂时没有环境，也可以先完成第 12 课的综合项目。</p>
        <a href="/downloads/nginx-labs.zip">下载 Nginx 实验源码 ↓</a>
      </section>
      <section id="nginx-route" className="container-route" aria-labelledby="nginx-route-title">
        <h2 id="nginx-route-title">按这个顺序学</h2>
        {curriculum.map((stage, index) => {
          const lessons = stage.posts.map((slug) => posts.find((post) => post.slug === slug)).filter((post) => post !== undefined);
          return <section className="container-stage" id={stage.id} key={stage.id}>
            <span className="stage-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div className="container-stage-body">
              <p className="section-kicker">第 {index + 1} 段 · {lessons.length} 课</p>
              <h3>{stage.title}</h3><p>{stage.summary}</p>
              <ol>{lessons.map((post) => <li key={post.slug}><Link href={`/articles/${post.slug}/`}>{post.title}</Link><span>约 {post.readingMinutes} 分钟</span></li>)}</ol>
              {lessons[0] && <Link className="stage-entry" href={`/articles/${lessons[0].slug}/`}>从这段开始 →</Link>}
            </div>
          </section>;
        })}
      </section>
      <aside className="container-course-note"><h2>学会判断，比多背几个参数有用。</h2><p>看到 502，先分清是连接失败还是应用返回；看到缓存命中，先确认数据适不适合共享。每课都会留下一个能改、能验证的小实验，学完可以自己部署入口，也知道出问题时从哪里查。</p><Link href="/articles/">按主题查看全部文章 →</Link></aside>
    </main>
  );
}
