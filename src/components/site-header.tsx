import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "首页" },
  { href: "/learn/", label: "从零学 AI" },
  { href: "/containers/", label: "Docker & K8s" },
  { href: "/articles/", label: "文章" },
  { href: "/resume/", label: "简历" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="profile-block">
        <Link className="profile-link" href="/" aria-label="Foaier 的博客首页">
          <Image
            className="profile-avatar"
            src="/images/avatar.png"
            alt="Foaier 的 GitHub 头像"
            width={100}
            height={100}
            priority
            unoptimized
          />
          <span className="profile-name">Foaier</span>
        </Link>
        <p className="profile-description">后端开发 · AI 实践 · 云原生</p>
        <nav aria-label="主导航" className="navbar">
          {links.map(({ href, label }) => (
            <Link className="nav-link" href={href} key={href}>{label}</Link>
          ))}
        </nav>
      </div>
      <ThemeToggle />
    </header>
  );
}
