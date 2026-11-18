import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "首页" },
  { href: "/articles/", label: "文章" },
  { href: "/projects/", label: "项目" },
  { href: "/resume/", label: "简历" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="profile-block">
        <Link className="profile-link" href="/" aria-label="Foaier 的博客首页">
          <Image
            className="profile-avatar"
            src="https://avatars.githubusercontent.com/u/8818576?v=4"
            alt="Foaier 的 GitHub 头像"
            width={100}
            height={100}
            priority
            unoptimized
          />
          <span className="profile-name">Foaier</span>
        </Link>
        <p className="profile-description">后端工程师 · 企业系统 · 数据迁移</p>
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
