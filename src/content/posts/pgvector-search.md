---
title: "用 PostgreSQL 做向量搜索，先跑通再谈调优"
date: "2026-11-20"
summary: "从 pgvector 安装、建表和查询开始，分清精确搜索、HNSW、过滤与混合检索，给知识库一个可检查的底座。"
series: "提示词与知识库"
order: 3
tags: ["PostgreSQL","pgvector","混合检索"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["embeddings-schema"]
goals: ["从 pgvector 安装、建表和查询开始，分清精确搜索、HNSW、过滤与混合检索，给知识库一个可检查的底座。"]
---

如果项目已经使用 PostgreSQL，想试一试向量搜索，可以先看 pgvector。它是数据库扩展，不是另开一个聊天模型服务。

这篇用三维人工向量跑通存储和查询。这样不用先接外部模型，就能检查数据库这一层是否正常。

## 第一步：确认扩展真的装在服务端

`CREATE EXTENSION vector` 只是在某个数据库里启用已经安装的扩展。它不会从网上替你下载和编译 pgvector。

本地实验可以使用官方项目提供的容器镜像。下面绑定到回环地址，数据写入专用 volume；先设置一个自己的 `PGVECTOR_DEMO_PASSWORD` 环境变量。

```bash
docker run --name pgvector-demo \
  -e POSTGRES_PASSWORD="$PGVECTOR_DEMO_PASSWORD" \
  -p 127.0.0.1:55432:5432 \
  -v pgvector-demo-data:/var/lib/postgresql/data \
  -d pgvector/pgvector:pg16
```

这是 Bash 命令；PowerShell 的环境变量写法是 `$env:PGVECTOR_DEMO_PASSWORD`，换行续写也不同。镜像标签会更新，团队需要严格复现时应记录镜像 digest。

如果在现有 PostgreSQL 16 上安装，优先检查平台的软件包；源码编译要使用匹配的服务器开发文件和 `pg_config`。托管数据库则先查允许的扩展清单，不要在生产服务器上照搬实验安装命令。

## 第二步：建一张最小的表

进入容器的数据库命令行：`docker exec -it pgvector-demo psql -U postgres`，然后执行下面的 SQL：

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE kb_demo (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL,
  content text NOT NULL,
  embedding vector(3) NOT NULL
);

INSERT INTO kb_demo (tenant_id, content, embedding) VALUES
  ('demo', '退款到账时间说明', '[1,0.1,0]'),
  ('demo', '如何修改账号密码', '[0,0,1]'),
  ('other', '另一租户的退款规则', '[1,0,0]');

SELECT id, content,
       embedding <=> '[1,0,0]'::vector AS distance
FROM kb_demo
WHERE tenant_id = 'demo'
ORDER BY embedding <=> '[1,0,0]'::vector
LIMIT 2;
```

`<=>` 表示余弦距离，越小越接近。这里应该先返回退款说明，再返回密码说明；另一租户的记录不会出现。实际应用把向量和租户作为绑定参数传入，不要拼接用户输入生成 SQL。

## 第三步：数据多了，再考虑索引

没有近似索引时，可以进行精确最近邻搜索。它适合建立正确性基线。数据与查询规模上来后，可以评估 HNSW 或 IVFFlat 等近似方法。

```sql
CREATE INDEX kb_demo_embedding_hnsw
ON kb_demo USING hnsw (embedding vector_cosine_ops);
```

距离函数与索引操作符类要匹配。只有三条数据时，查询规划器选择顺序扫描很正常，不能据此判断索引坏了。

近似搜索是在性能和召回之间做权衡。加上过滤后，可能出现返回结果少于预期的情况，因为近似候选集与过滤条件会相互影响。根据安装版本评估更大的搜索范围、迭代扫描、分区或部分索引，同时测延迟，不要只盯一个参数。

## 向量搜索不擅长所有问题

“退款到账要几天”适合语义检索；“错误码 PAY-1042”通常很需要精确关键词匹配。实际知识库常常两种都要。

混合检索可以分别取得关键词与向量候选，再合并排序。不要直接把两个不同量纲的分数相加。常见的 RRF 根据名次融合，每个列表中某条记录的贡献类似 `1 / (k + rank)`，再将贡献相加。

PostgreSQL 的全文搜索也要考虑中文分词；默认分词配置不一定适合中文语料。先用自己的关键词和句子验收，再决定采用扩展、外部检索服务或其他方案。

## 怎么知道它真的检索对了

准备一批问题和预期命中的文档，先用精确搜索作为对照，再测试近似索引。记录 top-k 召回、过滤正确性、查询耗时和更新延迟。

也要测试“没有答案”的问题。永远返回最接近的两条记录，并不表示这两条真的足以回答用户。

## 参考资料

- [pgvector 官方说明：安装、索引、过滤与混合搜索](https://github.com/pgvector/pgvector)
- [Semantic Kernel：向量存储连接器](https://learn.microsoft.com/en-us/semantic-kernel/concepts/vector-store-connectors/)
