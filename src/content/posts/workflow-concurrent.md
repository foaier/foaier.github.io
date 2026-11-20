---
title: "并发编排：让多个 Agent 从不同角度回答同一个问题"
date: "2026-11-20"
summary: "区分并发独立处理与顺序传递。"
series: "工作流实践"
order: 11
tags: ["工作流实践","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["workflows-nodes-streaming","agent-function-tools"]
goals: ["区分并发独立处理与顺序传递。"]
---

有些任务可以同时做：一个人解释概念，另一个人列注意点，二者都从同一问题出发。这适合并发执行。它与“先写后审”不同，因为第二个角色开始时不保证已经拿到第一个角色的答案。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。先下载完整示例并配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。模型需要支持工具调用。公共运行器传入 ChatMessage，再发送 TurnToken，并以两分钟为上限观察事件；相关代码在 Workflows/WorkflowLessons.cs。

~~~powershell
dotnet run --project Workflows -- concurrent
~~~

## 代码是怎样工作的

BuildConcurrent 把同一输入送到参与者。本例在 concurrent 分支把第二个角色改为 misconception_guide，独立列出常见误区。它不审阅尚未完成的草稿，而是从同一个问题出发。输出顺序可能变化。

下面是完整程序中负责组装流程的关键表达式；相关角色创建和事件循环已包含在下载项目中。

~~~csharp
AgentWorkflowBuilder.BuildConcurrent([writer, reviewer]);
~~~



## 怎样判断成功

观察两个分支都产生结果，且结果先后不固定。总耗时可能减少，但调用数量与费用没有因此自动减少。系统也没有自动得出一个“多数意见一定正确”的结论。

## 自己改一次

先把第二个角色改为“独立给出一个练习”，运行三次记录延迟。随后故意让一个分支失败，思考汇总应等待全部、返回部分结果还是整体失败。

## 遇到问题先看这里

并发限额与服务限流要配合。不要把同一份可变 Session 同时交给多个并发任务随意修改。要审阅已有草稿，请使用顺序编排；不要靠角色名称让数据依赖凭空出现。

## 参考资料

- [编排模式](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [工作流概览](https://learn.microsoft.com/en-us/agent-framework/workflows/overview)
