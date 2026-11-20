---
title: "把 Agent 放进工作流：先让一个节点说话"
date: "2026-11-20"
summary: "认识 Agent 节点的输入消息和 TurnToken。"
series: "工作流实践"
order: 8
tags: ["工作流实践","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["workflows-nodes-streaming","agent-function-tools"]
goals: ["认识 Agent 节点的输入消息和 TurnToken。"]
---

普通执行器收到字符串就能运行，Agent 节点还涉及消息与轮次。先把一个 Agent 放进图里，看清什么时候收消息、什么时候开始回答，再增加第二个角色。否则多 Agent 出问题时，很难分清是输入没有到达，还是模型没有执行。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。先下载完整示例并配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。模型需要支持工具调用。公共运行器传入 ChatMessage，再发送 TurnToken，并以两分钟为上限观察事件；相关代码在 Workflows/WorkflowLessons.cs。

~~~powershell
dotnet run --project Workflows -- agent-node
~~~

## 代码是怎样工作的

示例先定义 writer，再用它作为 WorkflowBuilder 起点，并声明输出。RunAgents 发送 ChatMessage 后再发 TurnToken，通知 Agent 开始本轮处理。事件流中的 AgentResponseUpdateEvent 用于观察逐步输出。这个顺序与普通字符串执行器不同。

下面是完整程序中负责组装流程的关键表达式；相关角色创建和事件循环已包含在下载项目中。

~~~csharp
new WorkflowBuilder(writer).WithOutputFrom(writer).Build();
~~~



## 怎样判断成功

应得到面向新手的 RAG 解释，并看到输出事件。若只排入消息却没有开始轮次，可能看不到预期回答。流式更新是过程片段，不要把每段都误认为一份完整答案。

## 自己改一次

把问题换成 MCP，再给 writer 增加“先举例”的说明，比较输出。然后阅读普通节点示例，写出两种节点的输入类型有什么不同。

## 遇到问题先看这里

静默不动时先检查 TurnToken 与消息类型，再查模型连接。不要把 WatchStream 的等待误判成模型正在思考。取消和异常也应作为流程结果处理。

## 参考资料

- [编排模式](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [工作流概览](https://learn.microsoft.com/en-us/agent-framework/workflows/overview)
