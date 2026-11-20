---
title: "Rollback：回到旧检查点，不等于撤销已经发生的事"
date: "2026-11-20"
summary: "运行 rollback 练习并观察节点事件"
series: "工作流实践"
order: 18
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["durable-workflows"]
goals: ["运行 rollback 练习并观察节点事件","回到旧检查点，不等于撤销已经发生的事"]
---

恢复执行与回到旧状态是相关但不同的操作。上一课创建新运行器继续执行，这一课在原运行对象上调用RestoreCheckpointAsync，观察回退后哪些步骤再次发生。实验仍然只处理文本。

## 先理解这一步的职责

代码中的rollback分支使用first.RestoreCheckpointAsync，其他分支使用ResumeStreamingAsync。它们都依赖已有检查点，但运行对象的处理方式不同。读代码时看清楚调用目标，不要只记住方法名里都有Checkpoint。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- rollback
~~~

实现位于Workflows/WorkflowLessons.cs。Program.cs选择对应命令，TextStep等公共执行器放在同一文件中。下载包包含整个项目，下面重点展示本篇需要阅读的方法；不需要从其他文章猜缺失的类。

## 对照实现，跟踪输入与输出

```csharp
public static async Task Checkpoints(bool rollback)
    {
        var manager = CheckpointManager.Default;
        var saved = new List<CheckpointInfo>();
        await using var first = await InProcessExecution.RunStreamingAsync(Basic(), " rag ", manager);
        await foreach (var evt in first.WatchStreamAsync())
        {
            if (evt is SuperStepCompletedEvent step && step.CompletionInfo?.Checkpoint is { } checkpoint) saved.Add(checkpoint);
            Print(evt);
        }
        if (saved.Count == 0) throw new InvalidOperationException("没有产生检查点。");
        Console.WriteLine($"保存 {saved.Count} 个检查点，恢复第一个。");
        if (rollback)
        {
            await first.RestoreCheckpointAsync(saved[0], CancellationToken.None);
            await foreach (var evt in first.WatchStreamAsync()) Print(evt);
        }
        else
        {
            await using var resumed = await InProcessExecution.ResumeStreamingAsync(Basic(), saved[0], manager);
            await foreach (var evt in resumed.WatchStreamAsync()) Print(evt);
        }
    }
```


先找到创建节点的位置，再看边的连接与WithOutputFrom。最后沿着输入走一遍，写下每个节点接收的类型和输出的类型。观察事件的方法会打印执行器完成与最终输出，出现WorkflowErrorEvent时会明确抛出错误。

## 预期结果怎样核对

预期先输出一次完整结果，再提示恢复第一个检查点，随后answer再次执行。这个重复输出很重要：它提醒你旧边界之后的动作可能再次发生。如果那一步是发通知，就可能出现重复通知。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

给answer加一个内存计数并打印，看看恢复后它是否符合你对状态的预期。普通对象字段不一定自动进入检查点；需要持久化的状态应按框架机制写入上下文，并在恢复时读取。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

业务上的撤销需要业务本身支持。例如取消一条尚未执行的任务可以更新状态，已经转账则可能需要独立退款流程。工作流回退只是改变执行状态，不会让外部系统的时间倒流。设计前先列出每个节点的副作用和重复执行结果。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
