import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>杨乘峰 <span>·</span> 个人技术博客</p>
      <div className="footer-links">
        <Link href="/resume/">简历</Link>
        <a href="https://github.com/foaier" target="_blank" rel="noreferrer">GitHub</a>
        <a href="mailto:lt.008@outlook.com">Email</a>
      </div>
    </footer>
  );
}
