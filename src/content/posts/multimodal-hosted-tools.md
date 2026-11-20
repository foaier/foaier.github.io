---
title: "让 Agent 看图、搜资料、跑代码，能力边界要先讲清"
date: "2026-11-20"
summary: "理解视觉输入、File Search、Web Search、Code Interpreter 和 Copilot SDK，各自负责什么，又不能保证什么。"
series: "Agent Framework 进阶"
order: 36
tags: ["多模态","托管工具","Copilot SDK"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-function-tools"]
goals: ["理解视觉输入、File Search、Web Search、Code Interpreter 和 Copilot SDK，各自负责什么，又不能保证什么。"]
---

Agent 接了更多工具以后，很容易出现一种错觉：能看到网页、文件和终端，就能可靠完成任何任务。

实际上，这些能力分别依赖不同的模型、运行环境与服务。把它们一个个拆开看，才知道请求失败时该查哪里。

## 视觉输入：看见不等于读准

视觉 Agent 可以把图片和文本一起交给支持该模态的模型。图片可能来自上传、截图或可访问的地址，但具体传输方式、格式和大小限制要看提供方。

例如让它分析后台页面截图，识别按钮和错误提示是一个任务；直接根据截图点击按钮，则多了一层操作风险。小字、遮挡、缩放和低清晰度都会影响判断。

涉及金额、账号、订单号时，可以把识别结果与结构化数据交叉验证。不要让模型凭模糊截图补全关键字段。

## 三种常见托管工具，各管一件事

| 工具 | 主要用途 | 常见误会 |
| --- | --- | --- |
| File Search | 在已接入的文件内容中检索 | 上传成功不等于索引已经就绪 |
| Web Search | 获取网络上的相关信息 | 找到网页不等于来源可靠、内容最新 |
| Code Interpreter | 在服务提供的执行环境里运行代码 | 不是自动获得开发者本机终端权限 |

这些功能常常由模型提供方托管。换成 Ollama 或另一个服务以后，不一定仍然存在同名能力，也不一定能通过同样的参数启用。

## File Search：先确认文件属于谁

需要确认文件上传位置、索引状态、会话或项目归属，以及删除后的行为。多个租户共享同一底层服务时，应用仍要限制可搜索的文件集合。

回答最好带可追溯的引用，但引用也要映射到用户有权访问的文档。文件检索是 RAG 的一种实现方式，仍然会遇到解析、切块和证据不足的问题。

## Web Search：把找到的内容当资料

搜索结果可能包含过期教程、广告、错误信息，或者诱导 Agent 改变行为的文字。它们应该是被分析的材料，不能成为新的执行指令。

对于接口名称、版本和计费等易变内容，优先回到官方文档核对。记录来源和查询时间，回答时区分文档明确说明的事实与应用自己的推断。

如果一个页面打不开，要说明依据缺失，不要凭标题补出整篇文章的结论。

## Code Interpreter：运行成功以后还要验结果

拿一份 CSV 做统计很适合演示。可以让模型生成代码，在受控环境中执行，再返回图表或数据。但首先要确定输入文件实际被挂载到哪里，支持哪些库，网络是否开放，输出文件能保存多久。

下面的检查顺序比“代码没有报错”更有意义：

```text
输入行数与列名是否符合预期
缺失值、单位和时区是否正确处理
计算结果是否与一小份手算样本一致
生成的文件是否确实存在且可下载
失败时是否保留足够的诊断信息
```

代码执行环境也需要资源限制。CPU、内存、运行时间和文件范围，不能完全交给模型自己约束。

## Copilot SDK 与电脑操作不是同一件事

GitHub Copilot SDK 提供把 Copilot 能力接入应用的途径，具体功能取决于 SDK、运行时和账户能力。接入了 SDK，并不等于自动获得可靠的桌面控制。

浏览器、终端或电脑操作还需要相应工具。截图理解决定“可能应该点哪里”，执行器负责“实际点了哪里”，验证环节负责“目标状态有没有改变”。少任何一环，演示都可能看起来成功、实际没完成。

尤其发送消息、发布内容和修改业务数据之前，应使用明确的确认机制，并展示具体动作。

## 用一个任务把链路验清楚

比如“分析上传的演示工单表，生成按类别统计的 CSV”。验收时检查输入文件、分析代码、实际输出文件和统计结果；不要只看 Agent 最后的解释。

工具数量不是目标。每个工具都能被可靠调用、结果能检查、错误有出口，组合起来才会稳。

## 按工具选择实操章节

发送一张图片从[视觉输入](/articles/agent-vision/)开始；计算看[代码解释器](/articles/agent-code-interpreter/)；私有文档看[File Search](/articles/agent-file-search/)；最新网页看[Web Search](/articles/agent-web-search/)；已有HTTP接口看[OpenAPI 工具](/articles/agent-openapi-tool/)。这些工具的准备条件不同，不需要一次全部启用。

## 参考资料

- [Agent Framework：模型与托管工具支持](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/model-providers/)
- [GitHub Copilot SDK 集成](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/agent-services/github-copilot)
- [Agent Framework：可观察性与调用记录](https://learn.microsoft.com/en-us/agent-framework/agents/observability)
