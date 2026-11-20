---
title: "Fan-out 并行：同一个问题，同时生成解释和练习"
date: "2026-11-20"
summary: "运行 fanout 练习并观察节点事件"
series: "工作流实践"
order: 5
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["workflow-switch"]
goals: ["运行 fanout 练习并观察节点事件","同一个问题，同时生成解释和练习"]
---

有些步骤不依赖彼此。学习助手收到RAG主题后，可以同时准备概念解释和练习题。这里先用普通节点返回固定文字，让你看见一份输入如何送到两个目标。

## 先理解这一步的职责

AddFanOutEdge把输入分发给多个执行器。WithOutputFrom在这个示例里允许两个分支分别产生工作流输出，它没有自动把结果拼成一个字符串。需要一个统一答案时，还要设计汇总节点和成功条件。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- fanout
~~~

实现位于Workflows/WorkflowLessons.cs。Program.cs选择对应命令，TextStep等公共执行器放在同一文件中。下载包包含整个项目，下面重点展示本篇需要阅读的方法；不需要从其他文章猜缺失的类。

## 对照实现，跟踪输入与输出

```csharp
public static Workflow FanOut()
    {
        var input = new TextStep("input", value => value);
        var explain = new TextStep("explain", topic => $"解释{topic}：先找资料，再回答。");
        var exercise = new TextStep("exercise", topic => $"练习{topic}：删除相关资料，观察是否拒答。");
        return new WorkflowBuilder(input).AddFanOutEdge(input, [explain, exercise])
            .WithOutputFrom(explain, exercise).Build();
    }
```


先找到创建节点的位置，再看边的连接与WithOutputFrom。最后沿着输入走一遍，写下每个节点接收的类型和输出的类型。观察事件的方法会打印执行器完成与最终输出，出现WorkflowErrorEvent时会明确抛出错误。

## 预期结果怎样核对

运行后应该得到解释RAG和练习RAG两份结果。两者到达的先后不应作为业务契约。如果在某个节点加入延迟，另一个节点不应该因此被误认为失败。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

给exercise节点故意抛出一个带说明的异常，观察事件和最终状态，再恢复代码。思考你的产品应该要求全部成功，还是允许只返回解释并注明练习生成失败。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

并行不是免费加速。真实模型请求会增加同时使用的连接、配额和成本，批量任务应设置并发上限。还有副作用的问题：两个分支都更新同一条学习记录时，要防止覆盖或重复写入，不能只靠图上的两根线保证一致性。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
