---
title: "第一个工作流：两个 Executor，跑通输入、事件和输出"
date: "2026-11-20"
summary: "运行一个不依赖模型的真实 Agent Framework 工作流"
series: "工作流实践"
order: 1
tags: ["工作流实践","循序渐进"]
level: "工作流入门 · 可离线运行"
prerequisites: ["agent-function-tools"]
goals: ["运行一个不依赖模型的真实 Agent Framework 工作流","分清 Executor、边、执行事件和最终结果"]
---

先把模型放到一边，我们用两个普通节点做一个小流程：把输入整理成大写，再给出RAG的解释。这样第一次学习工作流时，只需要关注数据怎样移动，不用同时排查模型额度和提示词。

## 为什么需要工作流

应用变复杂后，一个请求可能先校验、再检索、再生成、最后等待人确认。把所有await堆进一个大方法，很难看清每一步的责任。工作流把节点和连接关系显式表达出来，方便检查执行路径和观察中间结果。

Executor是接收输入并完成一项工作的执行器，边把输出送到下一个节点。我们的输入输出都是string，避免第一次就处理复杂消息类型。后面接Agent时会看到ChatMessage与TurnToken，那是额外的协议层，不需要现在一起背下来。

## 准备项目并运行

下载[课程示例](/downloads/ai-course.zip)，安装.NET 10 SDK，在ai-course目录执行：

~~~powershell
dotnet run --project Workflows -- " rag "
~~~

依赖Microsoft.Agents.AI.Workflows 1.28.0已经写进项目文件。第一次需要下载NuGet包，本篇不访问任何在线模型。项目也包含后续章节的命令分发，因此你可以连续在同一个目录完成整个系列。

## 阅读两个节点的实现

Program.cs底部定义NormalizeExecutor和ExplainExecutor。前者Trim去掉首尾空白并转成大写；后者判断是否为RAG，返回一段固定解释。它们都继承Executor<string,string>，重写HandleAsync。

这两个类型参数分别代表输入和输出。IWorkflowContext用于与运行上下文交互，CancellationToken用于响应取消。当前节点只返回值，不访问外部服务，所以实现很短；以后读数据库或调用模型时，也要保留这些边界。

## 把节点接起来

WorkflowBuilder以normalize为起点，AddEdge连接到explain，WithOutputFrom声明explain的结果是工作流输出。Build创建可运行的图。不要把“最后写在代码里的节点”与“已声明的最终输出”混为一谈。

RunStreamingAsync启动运行并返回StreamingRun。WatchStreamAsync逐个读取事件；ExecutorCompletedEvent说明某个节点完成，WorkflowOutputEvent表示对外输出。流式事件不一定是模型Token，它也可以是普通节点进度。

## 预期结果

~~~text
normalize: RAG
explain: 先检索资料，再结合资料生成答案。
最终结果: 先检索资料，再结合资料生成答案。
~~~

输入MCP时应该得到这个练习暂不认识的提示。它不会调用模型编造答案。这里的确定性结果非常适合作为第一条工作流验收：输入整理正确、节点顺序正确、最终输出明确。

## 动手修改与常见问题

给ExplainExecutor增加MCP解释，再分别输入rag、MCP和空字符串。若节点没有输出，先检查输入类型与边连接；若程序运行了却没有最终结果，检查WithOutputFrom是否指向正确节点。

本系列后面的条件分支、并行和检查点都会复用这些基本概念。先不要一次开启全部能力。你能画出“输入→normalize→explain→输出”，并解释每个箭头传的是什么，就已经具备继续学习的基础。

## 参考资料

- [工作流执行模型](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [工作流与检查点](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
