import type { Metadata } from "next";
import Link from "next/link";
import curriculum from "@/content/container-curriculum.json";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Docker 与 Kubernetes：从入门到深入",
  description: "从 Docker 命令、Nginx、MySQL、Redis 和 Java 实战，学到 Kubernetes 部署、排错与集群原理。",
};

export default async function ContainersPage() {
  const posts = await getAllPosts();
  const lessonCount = curriculum.reduce((total, stage) => total + stage.posts.length, 0);
  return (
    <main className="container page-main container-course">
      <header className="container-hero">
        <p className="section-kicker">DOCKER &amp; KUBERNETES</p>
        <h1>从 Docker 开始，<br />学会部署和排错。</h1>
        <p>Docker 解决“换台电脑就跑不起来”；Kubernetes 解决“服务多了、机器多了，谁来盯着它们”。每一课都从一个实际问题开始，命令跑完会告诉你该看到什么。</p>
        <div className="container-hero-meta"><span>{lessonCount} 课</span><span>一台电脑就能开始</span><span>命令讲解 · 软件安装 · 项目实战</span></div>
        <Link className="learn-start" href="/articles/docker-why/">从 Docker 第一课开始 <span aria-hidden="true">→</span></Link>
      </header>

      <section className="container-course-note">
        <h2>需要先会 Linux 吗？</h2>
        <p>不用先当 Linux 管理员。会打开终端、复制命令和看返回结果就能开始。整条路线使用 Bash：Windows 在 Docker Desktop + WSL 2 的 Ubuntu 终端练习，macOS/Linux 使用本机终端。Kubernetes 主线用 kind 在本机启动，不需要先租云服务器；kubeadm 章节另外准备两台实验虚拟机。</p>
        <p>Docker 从常用软件练到 Java 项目。Kubernetes 先让一个 Nginx 网页跑起来，再逐个加入副本、网络、存储和权限，最后部署 .NET + PostgreSQL 留言服务，练习故障恢复和备份。每课说明在哪个目录、哪个集群操作，以及完成后保留或清理哪些资源。</p>
        <a href="/downloads/docker-labs.zip">下载 Docker 实验源码 ↓</a><br /><a href="/downloads/k8s-labs.zip">下载 Kubernetes 分课实验 ↓</a><br /><a href="/downloads/container-course.zip">下载 Kubernetes 综合项目 ↓</a>
      </section>

      <section className="container-route" aria-labelledby="container-route-title">
        <h2 id="container-route-title">照着这个顺序学</h2>
        {curriculum.map((stage, index) => {
          const chapters = stage.posts.map((slug) => posts.find((post) => post.slug === slug)).filter((post) => post !== undefined);
          return (
            <section className="container-stage" id={stage.id} key={stage.id}>
              <span className="stage-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div className="container-stage-body">
                <p className="section-kicker">第 {index + 1} 段 · {chapters.length} 课</p>
                <h3>{stage.title}</h3>
                <p>{stage.summary}</p>
                <ol>{chapters.map((post) => (
                  <li key={post.slug}><Link href={`/articles/${post.slug}/`}>{post.title}</Link><span>约 {post.readingMinutes} 分钟</span></li>
                ))}</ol>
                {chapters[0] && <Link className="stage-entry" href={`/articles/${chapters[0].slug}/`}>从这段开始 →</Link>}
              </div>
            </section>
          );
        })}
      </section>

      <aside className="container-course-note"><h2>这条路线会讲到什么程度？</h2><p>学完主线，可以自己构建镜像、部署小服务、检查它为什么没起来。后半段继续拆解调度、网络、etcd 和备份，介绍生产维护要考虑的取舍。需要指标服务、入口控制器或其他插件的实验，会先说明准备条件。</p><Link href="/articles/">也可以按主题翻全部文章 →</Link></aside>
    </main>
  );
}
