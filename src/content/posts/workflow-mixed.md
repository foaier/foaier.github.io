---
title: "混合节点：确定的规则交给代码，解释交给模型"
date: "2026-11-20"
summary: "在同一工作流里组合普通执行器与 Agent。"
series: "工作流实践"
order: 9
tags: ["工作流实践","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["workflows-nodes-streaming","agent-function-tools"]
goals: ["在同一工作流里组合普通执行器与 Agent。"]
---

清理空格、校验格式、查找固定记录，这些事情普通代码做得又快又稳定。解释概念、总结资料才适合让模型参与。工作流可以把两者放在同一条链路里，不必为了叫“AI应用”把每一步都变成模型请求。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。先下载完整示例并配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。模型需要支持工具调用。公共运行器传入 ChatMessage，再发送 TurnToken，并以两分钟为上限观察事件；相关代码在 Workflows/WorkflowLessons.cs。

~~~powershell
dotnet run --project Workflows -- mixed
~~~

## 代码是怎样工作的

normalize 清理输入；AgentTextStep 接受字符串，在 HandleAsync 内调用 writer；label 给回答加学习笔记标签。这个适配执行器把模型调用结果转回字符串，便于与普通节点连接。取消令牌也继续传给 Agent。

下面是完整程序中负责组装流程的关键表达式；相关角色创建和事件循环已包含在下载项目中。

~~~csharp
new WorkflowBuilder(normalize).AddEdge(normalize, model).AddEdge(model, label).WithOutputFrom(label).Build();
~~~



## 怎样判断成功

应看到带标签的中文解释，前后处理规则保持确定，只有中间文字有随机性。普通输入输出类型要一致；如果节点返回一个对象，下游就不应仍假定收到字符串。

## 自己改一次

在 normalize 增加空输入检查，确认不必要的模型请求被提前阻止。再让 label 输出结构化结果，思考下游接口如何同步变化。

## 遇到问题先看这里

不要吞掉模型异常然后把空字符串当成功输出。记录哪个节点失败，并决定是否重试。重试确定性节点与重试付费模型请求的代价不同，应分别考虑。

## 参考资料

- [编排模式](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [工作流概览](https://learn.microsoft.com/en-us/agent-framework/workflows/overview)
