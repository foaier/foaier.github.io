---
title: Embedding 是什么？先把一段话变成“可比较的坐标”
date: 2026-11-20
summary: 用相似度小实验理解文本向量，再设计真正能更新、能过滤、能追溯的知识库数据结构。
series: 提示词与知识库
order: 4
tags: [Embedding, 向量数据库, 数据建模]
---

用户问“钱什么时候退回来”，文档写的是“退款到账时效”。两句话没有太多相同的字，意思却接近。纯关键词搜索可能漏掉它们，embedding 就是解决这类问题的一种工具。

它把一段内容映射成一组数字。在同一个模型定义的向量空间里，可以通过距离或相似度比较内容是否接近。

## 向量不是一份压缩后的原文

你可以把向量想成坐标，但不要以为每个维度都有一个容易解释的含义，比如“第一维代表退款，第二维代表发票”。模型学到的表示通常没有这么整齐。

向量也不是可靠的文本存储格式。搜索结果仍要返回原文片段和出处。只存数字，不存正文，检索到以后就没东西能交给语言模型阅读。

另外，向量不是匿名化方案。它仍然源自业务数据，需要跟原文一起考虑访问范围、保留时间和删除策略。

## 用三维数字感受一下相似度

真实文本向量通常远不止三维。下面用人造数字演示余弦相似度，只帮助理解计算，不代表某个实际 embedding 模型。

```python
from math import sqrt

def cosine(a, b):
    if len(a) != len(b):
        raise ValueError("向量维度必须一致")
    denominator = sqrt(sum(x*x for x in a)) * sqrt(sum(x*x for x in b))
    if denominator == 0:
        raise ValueError("零向量没有这里定义的余弦相似度")
    return sum(x*y for x, y in zip(a, b)) / denominator

query = [1.0, 0.1, 0.0]
print(round(cosine(query, [0.9, 0.2, 0.0]), 3))
print(round(cosine(query, [0.0, 0.0, 1.0]), 3))
```

第一个结果接近 1，第二个为 0。这里只说明方向更接近，不说明某个回答有多大概率正确。实际使用时，不同模型和距离函数的分数范围、意义也可能不同。

## 一条知识记录不能只放向量

建议把知识块当作正式业务数据设计，而不是临时拼一个数组：

| 字段 | 用途 |
| --- | --- |
| chunk_id、document_id | 稳定定位知识块和原文 |
| content、title | 提供给模型阅读，并用于关键词检索 |
| source_url、page、section | 回答时引用，排错时回看 |
| tenant_id、access_scope | 在检索前限制可见范围 |
| source_version、updated_at | 区分旧政策和新政策 |
| embedding_model、dimensions | 说明向量由哪个配置生成 |
| content_hash | 判断内容是否变化，减少重复计算 |

权限过滤字段应由服务端写入与校验，不能由用户问题决定。对原文做了访问控制，却忘记向量索引，也会造成信息泄露。

## 换模型时，为什么不能只改一个名称

即使两个模型输出维度一样，也不代表它们的向量空间兼容。文档用模型 A 编码，问题用模型 B 编码，距离计算可能完全失去意义。

更稳妥的升级方式是建立新版本索引，用同一模型重新编码文档与查询，跑一批检索评估，再切换流量。旧索引保留多久、何时删除，也应当有计划。

维度还会影响存储、内存和索引成本。不要把聊天模型名字填进 embedding 接口；先确认服务确实提供向量输出，以及数据库支持相应维度和索引方式。

## 向量数据库怎么选

已有 PostgreSQL，数据量和查询要求适合时，可以先评估 pgvector，减少引入新系统的成本。需要独立向量检索服务时，也可以比较 Qdrant、Milvus、Weaviate 等方案。

选型别只看“支持多少亿条”。拿自己的数据测过滤后的召回、更新删除、备份恢复、并发延迟和运维复杂度。开发机上跑得快，不代表租户过滤和真实流量下仍然合适。

SK 的向量存储抽象可以减少部分接入代码，但各后端的索引、过滤与混合检索能力并不完全一致。换连接器以后，仍要重新验证行为。

## 参考资料

- [Semantic Kernel：向量存储与数据抽象](https://learn.microsoft.com/en-us/semantic-kernel/concepts/vector-store-connectors/)
- [pgvector：类型、距离与索引](https://github.com/pgvector/pgvector)
- [Azure AI Search：RAG 中的检索与权限](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview)
