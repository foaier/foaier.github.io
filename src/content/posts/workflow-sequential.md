---
title: "顺序编排：先写解释，再请另一个 Agent 检查"
date: "2026-11-20"
summary: "运行顺序多 Agent 流程，检查后一位拿到了什么。"
series: "工作流实践"
order: 10
tags: ["工作流实践","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["workflows-nodes-streaming","agent-function-tools"]
goals: ["运行顺序多 Agent 流程，检查后一位拿到了什么。"]
---

让一个 Agent 写草稿，另一个检查新手是否看得懂，是一个容易观察的顺序任务。前一步的结果进入后一步，每个角色承担明确职责。它不自动提高正确率，但可以把写作和检查两个目标分开。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。先下载完整示例并配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。模型需要支持工具调用。公共运行器传入 ChatMessage，再发送 TurnToken，并以两分钟为上限观察事件；相关代码在 Workflows/WorkflowLessons.cs。

~~~powershell
dotnet run --project Workflows -- sequential
~~~

## 代码是怎样工作的

writer 负责三句话解释，reviewer 输出一条改进建议。BuildSequential 明确了顺序。读者应同时观察中间事件和最终输出：最后一位是评审员，所以最终结果可能是评审建议，而不是修订后的全文。要改稿还需第三步。

下面是完整程序中负责组装流程的关键表达式；相关角色创建和事件循环已包含在下载项目中。

~~~csharp
AgentWorkflowBuilder.BuildSequential([writer, reviewer]);
~~~



## 怎样判断成功

先看到解释，再看到检查意见。不要只凭两个名字就认为使用了两个不同模型；本例两者共享同一个模型客户端，区别主要来自指令和上下文。

## 自己改一次

把 reviewer 的要求改成“检查是否解释了检索和生成的区别”，用固定问题比较评审是否更具体。随后加入 reviser，进入改进循环专题。

## 遇到问题先看这里

如果后一步一直重复前一步，检查角色指令和输入内容。更多步骤会增加费用与延迟，先用两步明确收益。评审意见也可能错误，需要外部资料或固定标准核对。

## 参考资料

- [编排模式](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [工作流概览](https://learn.microsoft.com/en-us/agent-framework/workflows/overview)
