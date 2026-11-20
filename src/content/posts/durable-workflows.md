---
title: "Checkpoint 入门：保存检查点，从中间继续执行"
date: "2026-11-20"
summary: "运行 checkpoint 练习并观察节点事件"
series: "工作流实践"
order: 17
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["workflows-nodes-streaming"]
goals: ["运行 checkpoint 练习并观察节点事件","保存检查点，从中间继续执行"]
---

流程执行到一半失败，如果每次都从头重跑，既浪费时间，也可能重复调用外部系统。检查点记录某个执行边界的状态，允许从那里继续。本篇先在一个无副作用的小流程里观察恢复过程。

## 先理解这一步的职责

运行时传入CheckpointManager，在SuperStepCompletedEvent中读取CheckpointInfo。恢复时重新构造相同结构的Workflow，再调用ResumeStreamingAsync。这里使用Default管理器，演示同一进程中保存并恢复，不把内存检查点当作跨进程持久化。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- checkpoint
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

命令先完成一次RAG解释，保存检查点，再从第一个检查点恢复。预期后续answer节点再次输出相同结果。日志能够说明哪些节点重跑，而不是只在最后打印“恢复成功”。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

在中间节点加入一条明显日志，比较从不同检查点恢复时它是否出现。保留执行器ID不变，再尝试改变业务输出，观察恢复状态与新代码之间的关系。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

跨进程恢复还需要持久化检查点存储、稳定的类型序列化和版本兼容方案。检查点不会自动回滚数据库、退款或外部邮件。凡是会产生副作用的步骤，都应有幂等键、执行记录或补偿策略，不能因为恢复点存在就放心重复执行。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
