---
title: "Handoff：什么时候把当前任务交给另一个 Agent？"
date: "2026-11-20"
summary: "理解模型驱动的交接与固定顺序的区别。"
series: "工作流实践"
order: 12
tags: ["工作流实践","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["workflows-nodes-streaming","agent-function-tools"]
goals: ["理解模型驱动的交接与固定顺序的区别。"]
---

有些问题主助手可以直接回答，有些需要转给专家。Handoff 允许在运行中决定是否交接，适合职责和转交条件清楚的场景。它不是每次都必须经过的下一节点，所以测试时要确认到底有没有发生交接。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。先下载完整示例并配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。模型需要支持工具调用。公共运行器传入 ChatMessage，再发送 TurnToken，并以两分钟为上限观察事件；相关代码在 Workflows/WorkflowLessons.cs。

~~~powershell
dotnet run --project Workflows -- handoff
~~~

## 代码是怎样工作的

示例允许 writer 向 reviewer 交接。边定义的是允许路径，实际是否选择还受模型与指令影响。示例在 handoff 分支明确要求 writer 先解释，再把准确性审核交给 reviewer，便于观察交接；模型是否遵守仍需查看事件。

下面是完整程序中负责组装流程的关键表达式；相关角色创建和事件循环已包含在下载项目中。

~~~csharp
AgentWorkflowBuilder.CreateHandoffBuilderWith(writer).WithHandoffs(writer, [reviewer]).Build();
~~~



## 怎样判断成功

可能由 writer 直接回答，也可能出现转交事件。两者都要看输入是否符合设计。不能把“没有转交”一律视为框架失败；先确认模型是否收到明确的转交条件和工具定义。

## 自己改一次

准备一个普通解释问题和一个明确要求审核的问题，分别记录路径。把转交条件写成可测试的规则，再比较命中率。确实必须审核的业务，应由程序固定这一步。

## 遇到问题先看这里

双向交接如果没有终止条件，容易来回推任务。限制总轮数、时间和允许路径；本例运行器有超时，但正式业务还需要明确的轮次与成本预算。转交也不自动赋予专家更多权限。

## 参考资料

- [编排模式](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [工作流概览](https://learn.microsoft.com/en-us/agent-framework/workflows/overview)
