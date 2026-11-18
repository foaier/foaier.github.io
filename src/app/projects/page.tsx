import type { Metadata } from "next";
import { projects } from "@/lib/site";

export const metadata: Metadata = {
  title: "项目",
  description: "杨乘峰参与的企业系统、数据迁移与产品升级平台项目。",
};

export default function ProjectsPage() {
  return (
    <main className="container page-main project-page">
      <h2 className="page-title">项目</h2>
      <div className="project-list">
        {projects.map((project) => (
          <article className="project-row" key={project.title}>
            <span className="project-type">{project.label}</span>
            <div>
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <ul className="project-stack">
                {project.stack.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
