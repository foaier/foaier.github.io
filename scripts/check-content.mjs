import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

const directory = new URL("../src/content/posts/", import.meta.url);
const files = readdirSync(directory).filter((file) => file.endsWith(".md"));
const slugs = new Set(files.map((file) => file.slice(0, -3)));
const positions = new Map();
const expectedSeries = ["AI 基础", "提示词与知识库", "Agent 开发", "工作流实践"];
const errors = [];
let chineseCharacters = 0;

for (const file of files) {
  try {
    const { data, content } = matter(readFileSync(new URL(file, directory), "utf8"));
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
        } else if (/^https?:/.test(node.url)) {
          assert.equal(new URL(node.url).protocol, "https:", `Use HTTPS: ${node.url}`);
          sourceLinks++;
        } else {
          assert.ok(!/^(javascript|data|file):/i.test(node.url), `Unsafe link: ${node.url}`);
        }
      }
    });
    const count = content.match(/[\u3400-\u9fff]/g)?.length ?? 0;
    chineseCharacters += count;
    if (data.series) {
      assert.ok(count >= 800 && headings >= 4 && sourceLinks >= 2, "Series article is missing substantive content or references");
    }
    assert.equal((content.match(/^```/gm)?.length ?? 0) % 2, 0, "Unclosed fenced code block");
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
  }
}

try {
  for (const name of expectedSeries) {
    const count = [...positions.keys()].filter((key) => key.startsWith(`${name}/`)).length;
    for (let index = 1; index <= count; index++) assert.ok(positions.has(`${name}/${index}`), `Missing series position: ${name}/${index}`);
  }
} catch (error) {
  errors.push(error.message);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} articles, ${positions.size} series chapters, and ${chineseCharacters} Chinese characters.`);
}
