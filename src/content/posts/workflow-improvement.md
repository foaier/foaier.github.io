---
title: "改进循环：草稿、评审、修订，先做一轮就够"
date: "2026-11-20"
summary: "建立有界的改进流程，并用外部标准判断效果。"
series: "工作流实践"
order: 15
tags: ["工作流实践","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["workflows-nodes-streaming","agent-function-tools"]
goals: ["建立有界的改进流程，并用外部标准判断效果。"]
---

让模型反复问自己“写得好不好”，很容易得到越来越长却未必更准确的答案。先做一轮明确的草稿、评审、修订，把变化看清楚。真正的改进需要依据和验收，不是模型自己给自己打高分。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。先下载完整示例并配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。模型需要支持工具调用。公共运行器传入 ChatMessage，再发送 TurnToken，并以两分钟为上限观察事件；相关代码在 Workflows/WorkflowLessons.cs。

~~~powershell
dotnet run --project Workflows -- improve
~~~

## 代码是怎样工作的

本例用三段顺序链表示一次有界改进：writer 写三句，reviewer 给一个具体建议，reviser 根据建议修订一次。它没有自动重复到满意，因此不会把一次流程误称为无限自我优化。多轮版本应增加质量判定和最大轮数。

下面是完整程序中负责组装流程的关键表达式；相关角色创建和事件循环已包含在下载项目中。

~~~csharp
AgentWorkflowBuilder.BuildSequential([writer, reviewer, reviser]);
~~~



## 怎样判断成功

比较原稿、意见和修订稿，检查建议是否被落实、事实是否被改错。若修订只是增加修饰词，不应算实质改善。用“是否解释检索与生成”“是否给例子”等标准比主观顺眼更清楚。

## 自己改一次

准备五道题，人工给初稿和修订稿评分。加入一个评审意见本身错误的例子，观察修订员是否照单全收。这个实验可以揭示多 Agent 并不自动纠错。

## 遇到问题先看这里

上下文要带齐原问题、草稿和评审，否则修订员可能只看到一句意见。下一步加入自动评估时，区分开发题与验收题，避免只对几道熟题反复调参。

## 参考资料

- [编排模式](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [工作流概览](https://learn.microsoft.com/en-us/agent-framework/workflows/overview)
