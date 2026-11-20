---
title: "群聊编排：轮流讨论，但要有停止条件"
date: "2026-11-20"
summary: "运行有轮数上限的群聊，认识管理器的职责。"
series: "工作流实践"
order: 13
tags: ["工作流实践","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["workflows-nodes-streaming","agent-function-tools"]
goals: ["运行有轮数上限的群聊，认识管理器的职责。"]
---

多个 Agent 围绕同一问题讨论，很像一个小会议。会议可以发现遗漏，也可以浪费时间。群聊管理器负责轮到谁、何时结束；如果没有上限，模型可能不断补充没有实际价值的新说法。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。先下载完整示例并配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。模型需要支持工具调用。公共运行器传入 ChatMessage，再发送 TurnToken，并以两分钟为上限观察事件；相关代码在 Workflows/WorkflowLessons.cs。

~~~powershell
dotnet run --project Workflows -- group
~~~

## 代码是怎样工作的

示例使用 RoundRobinGroupChatManager 轮流选择参与者，MaximumIterationCount 为三。writer 和 reviewer 共享对话主题，但各有角色指令。三轮是实验边界，不是质量保证，也不意味着每人完整发言三次。

下面是完整程序中负责组装流程的关键表达式；相关角色创建和事件循环已包含在下载项目中。

~~~csharp
AgentWorkflowBuilder.CreateGroupChatBuilderWith(agents => new RoundRobinGroupChatManager(agents) { MaximumIterationCount = 3 }).AddParticipants([writer, reviewer]).Build();
~~~



## 怎样判断成功

应在有限轮次内结束，并能看出发言的角色与内容。最后发言不一定是最好答案，若需要正式总结，应增加明确的汇总角色和验收标准。不要把热闹的对话长度当成效果指标。

## 自己改一次

把轮次上限改为二和四，记录新增内容是否有帮助。再设置“必须指出一个具体术语解释不清的地方”，观察讨论是否更聚焦。

## 遇到问题先看这里

角色互相夸奖却不提供证据时，应调整评审标准，而不是继续增加轮次。共享内容太长会消耗上下文。涉及外部工具的群聊还需要限制重复调用与副作用。

## 参考资料

- [编排模式](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [工作流概览](https://learn.microsoft.com/en-us/agent-framework/workflows/overview)
