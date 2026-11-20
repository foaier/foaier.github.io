---
title: "条件分支：让工作流明确选择一条路"
date: "2026-11-20"
summary: "运行 branch 练习并观察节点事件"
series: "工作流实践"
order: 3
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["workflows-nodes-streaming"]
goals: ["运行 branch 练习并观察节点事件","让工作流明确选择一条路"]
---

这次要做一个小型课程分流器：输入RAG就给出解释，其他内容则要求补充信息。先不用模型做判断，方便把条件边的执行过程看清楚。等固定输入验证通过，再把上游替换成结构化分类结果。

## 先理解这一步的职责

AddEdge的condition接收上游输出，返回是否允许沿这条边继续。示例中两条条件互为补集，因此每个输入恰好进入一个分支。条件边本身并不强制互斥；如果两个条件都为真，两个目标都有可能被触发。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- branch
~~~

实现位于Workflows/WorkflowLessons.cs。Program.cs选择对应命令，TextStep等公共执行器放在同一文件中。下载包包含整个项目，下面重点展示本篇需要阅读的方法；不需要从其他文章猜缺失的类。

## 对照实现，跟踪输入与输出

```csharp
public static Workflow Branch()
    {
        var input = new TextStep("input", value => value.Trim().ToUpperInvariant());
        var known = new TextStep("known", _ => "RAG：先查资料再回答。");
        var unknown = new TextStep("unknown", _ => "请补充一个已收录主题。");
        return new WorkflowBuilder(input)
            .AddEdge<string>(input, known, condition: value => value is string text && text == "RAG")
            .AddEdge<string>(input, unknown, condition: value => value is not string text || text != "RAG")
            .WithOutputFrom(known, unknown).Build();
    }
```


先找到创建节点的位置，再看边的连接与WithOutputFrom。最后沿着输入走一遍，写下每个节点接收的类型和输出的类型。观察事件的方法会打印执行器完成与最终输出，出现WorkflowErrorEvent时会明确抛出错误。

## 预期结果怎样核对

运行命令会自动测试RAG和未知主题。前者应出现known节点，后者应出现unknown节点。查看最终输出之外，也要看节点名称，确认没有同时进入两个分支。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

把条件改成区分大小写之前，先观察normalize如何统一输入。如果你删除Trim，带空格的RAG会发生什么？把这类边界输入加入测试，比只跑一个正确样例更能说明路由是否可靠。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

当分类由模型完成时，不要让模型直接返回要执行的节点名。先解析为有限枚举或明确字段，再由代码决定允许走哪条边。输入格式不对时进入追问或错误分支，不能默默按成功处理。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
