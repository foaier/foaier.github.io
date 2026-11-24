import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

const directory = new URL("../src/content/posts/", import.meta.url);
const files = readdirSync(directory).filter((file) => file.endsWith(".md"));
const slugs = new Set(files.map((file) => file.slice(0, -3)));
const positions = new Map();
const curriculum = JSON.parse(readFileSync(new URL("../src/content/curriculum.json", import.meta.url), "utf8"));
const containerCurriculum = JSON.parse(readFileSync(new URL("../src/content/container-curriculum.json", import.meta.url), "utf8"));
const expectedSeries = curriculum.map((stage) => stage.name);
const metadata = new Map();
const errors = [];
let chineseCharacters = 0;

for (const file of files) {
  try {
    const { data, content } = matter(readFileSync(new URL(file, directory), "utf8"));
    metadata.set(file.slice(0, -3), data);
    for (const field of ["title", "summary"]) assert.equal(typeof data[field], "string", `${field} must be a string`);
    const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : data.date;
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10), date);
    assert.ok(Array.isArray(data.tags) && data.tags.every((tag) => typeof tag === "string"), "tags must be strings");
    if (data.series) {
      assert.ok(expectedSeries.includes(data.series), `Unknown series: ${data.series}`);
      assert.ok(Number.isInteger(data.order) && data.order > 0, "series order must be a positive integer");
      const key = `${data.series}/${data.order}`;
      assert.ok(!positions.has(key), `Duplicate series position: ${key}`);
      positions.set(key, file);
      assert.ok(typeof data.level === "string" && data.level.length > 0, "Missing learner level");
      assert.ok(Array.isArray(data.goals) && data.goals.length > 0 && data.goals.every((goal) => typeof goal === "string" && goal.trim()), "Missing learning goals");
      assert.ok(Array.isArray(data.prerequisites), "Missing prerequisites");
      for (const prerequisite of data.prerequisites) {
        assert.ok(slugs.has(prerequisite) && prerequisite !== file.slice(0, -3), `Invalid prerequisite: ${prerequisite}`);
      }
      assert.ok(content.includes("## 参考资料") || content.includes("## 延伸阅读") || content.includes("## 继续阅读"), "Missing references");
    }
    const tree = remark().use(remarkGfm).parse(content);
    let headings = 0;
    let sourceLinks = 0;
    visit(tree, (node) => {
      if (node.type === "heading") {
        assert.ok(node.depth > 1, "The page already supplies h1; use h2 in Markdown");
        headings++;
      }
      if (node.type === "link") {
        if (node.url.startsWith("/articles/")) {
          const slug = node.url.split("/")[2];
          assert.ok(!slug || slugs.has(slug), `Broken article link: ${node.url}`);
        } else if (node.url.startsWith("/downloads/")) {
          assert.ok(existsSync(new URL(`../public${node.url}`, import.meta.url)), `Missing download: ${node.url}`);
        } else if (/^https?:/.test(node.url)) {
          const url = new URL(node.url);
          assert.ok(url.protocol === "https:" || (data.series === "Docker 与 Kubernetes" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)), `Use HTTPS for non-local links: ${node.url}`);
          sourceLinks++;
        } else {
          assert.ok(!/^(javascript|data|file):/i.test(node.url), `Unsafe link: ${node.url}`);
        }
      }
    });
    const count = content.match(/[\u3400-\u9fff]/g)?.length ?? 0;
    chineseCharacters += count;
    if (data.series) {
      assert.ok(count >= 450 && headings >= 4 && sourceLinks >= 2, "Series article is missing explanation, lesson sections or references");
    }
    if (data.series === "Docker 与 Kubernetes") {
      for (const section of ["## 概念讲透：", "## 运行过程拆解：", "## 案例推演", "## 生产里怎么用、怎么排障"]) {
        assert.ok(content.includes(section), `Docker/Kubernetes article is missing ${section}`);
      }
      assert.ok(count >= 850, `Docker/Kubernetes lesson is too short to teach the topic: ${count} Chinese characters`);
    }
    assert.equal((content.match(/^```/gm)?.length ?? 0) % 2, 0, "Unclosed fenced code block");
    assert.equal((content.match(/^~~~/gm)?.length ?? 0) % 2, 0, "Unclosed tilde code block");
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
  }
}

try {
  for (const name of expectedSeries) {
    const count = [...positions.keys()].filter((key) => key.startsWith(`${name}/`)).length;
    for (let index = 1; index <= count; index++) assert.ok(positions.has(`${name}/${index}`), `Missing series position: ${name}/${index}`);
  }
  const visiting = new Set(), visited = new Set();
  function checkPrerequisites(slug) {
    assert.ok(!visiting.has(slug), `Prerequisite cycle at ${slug}`);
    if (visited.has(slug)) return;
    visiting.add(slug);
    for (const prerequisite of metadata.get(slug)?.prerequisites ?? []) checkPrerequisites(prerequisite);
    visiting.delete(slug); visited.add(slug);
  }
  for (const slug of slugs) checkPrerequisites(slug);
  for (const stage of curriculum) {
    assert.equal(metadata.get(stage.start)?.series, stage.name, `Invalid stage start: ${stage.start}`);
    for (const slug of stage.recommended) assert.equal(metadata.get(slug)?.series, stage.name, `Invalid recommended chapter: ${slug}`);
  }
  const containerPosts = containerCurriculum.flatMap((stage) => stage.posts);
  assert.equal(containerPosts.length, 42, "Docker and Kubernetes route must contain 42 lessons");
  assert.equal(new Set(containerPosts).size, 42, "Docker and Kubernetes route contains duplicate slugs");
  for (const [index, slug] of containerPosts.entries()) {
    const post = metadata.get(slug);
    assert.ok(post, `Missing Docker/Kubernetes lesson: ${slug}`);
    assert.equal(post.series, "Docker 与 Kubernetes", `Wrong series for ${slug}`);
    assert.equal(post.order, index + 1, `Wrong course order for ${slug}`);
    if (index > 0) assert.ok(post.prerequisites.includes(containerPosts[index - 1]), `Missing previous lesson prerequisite: ${slug}`);
  }
  assert.equal([...positions.keys()].filter((key) => key.startsWith("Docker 与 Kubernetes/")).length, 42, "Unexpected number of Docker and Kubernetes course articles");
} catch (error) {
  errors.push(error.message);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} articles, ${positions.size} series chapters, and ${chineseCharacters} Chinese characters.`);
}
