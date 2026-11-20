---
title: "可恢复的人工输入：等人回复时，也能保存进度"
date: "2026-11-20"
summary: "运行 resume-human 练习并观察节点事件"
series: "工作流实践"
order: 19
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["workflow-human-input","durable-workflows"]
goals: ["运行 resume-human 练习并观察节点事件","等人回复时，也能保存进度"]
---

用户可能离开页面，审批人也可能第二天才回复。一个正在等待输入的工作流，应该能够保存待处理请求，再恢复继续。这一课把RequestPort与Checkpoint接起来，观察等待状态如何被带到新运行器。

## 先理解这一步的职责

示例第一次使用WatchStreamAsync的blockOnPendingRequest:false，在存在待处理请求时结束当前观察，而不是一直阻塞。保存检查点以后，构造新的相同Workflow并恢复，再对重新发出的RequestInfoEvent提交响应。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- resume-human
~~~

实现位于Workflows/WorkflowLessons.cs。Program.cs选择对应命令，TextStep等公共执行器放在同一文件中。下载包包含整个项目，下面重点展示本篇需要阅读的方法；不需要从其他文章猜缺失的类。

## 对照实现，跟踪输入与输出

```csharp
public static async Task Human(bool restore)
    {
        static Workflow Build()
        {
            var request = RequestPort.Create<string, string>("choose-topic");
            var answer = new TextStep("answer", topic => $"已选择：{topic}。现在只记录选择，没有调用模型。");
            return new WorkflowBuilder(request).AddEdge(request, answer).WithOutputFrom(answer).Build();
        }
        var workflow = Build();
        var manager = CheckpointManager.Default;
        await using var run = await InProcessExecution.RunStreamingAsync(workflow, "你想学哪个主题？", manager);
        CheckpointInfo? waiting = null;
        await foreach (var evt in run.WatchStreamAsync(blockOnPendingRequest: !restore))
        {
            if (evt is SuperStepCompletedEvent step && step.CompletionInfo?.Checkpoint is { } checkpoint) waiting = checkpoint;
            if (evt is RequestInfoEvent info)
            {
                Console.WriteLine("工作流正在等待你选择学习主题。");
                if (!restore)
                {
                    Console.Write("输入主题：");
                    await run.SendResponseAsync(info.Request.CreateResponse(Console.ReadLine() ?? "AI入门"));
                }
            }
            Print(evt);
        }
        if (restore && waiting is not null)
        {
            Console.WriteLine("恢复等待输入的检查点。这里只演示同一进程中的恢复。");
            await using var resumed = await InProcessExecution.ResumeStreamingAsync(Build(), waiting, manager);
            await foreach (var evt in resumed.WatchStreamAsync())
            {
                if (evt is RequestInfoEvent info) await resumed.SendResponseAsync(info.Request.CreateResponse("改为学习MCP"));
                Print(evt);
            }
        }
    }
```


先找到创建节点的位置，再看边的连接与WithOutputFrom。最后沿着输入走一遍，写下每个节点接收的类型和输出的类型。观察事件的方法会打印执行器完成与最终输出，出现WorkflowErrorEvent时会明确抛出错误。

## 预期结果怎样核对

运行后先看到等待主题的提示，随后提示恢复检查点，最后输出已选择改为学习MCP。这里的MCP是示例自动提供的演示响应，正式界面应读取有权限用户的输入。本实验没有关闭整个进程，也没有宣称检查点已经落到外部数据库。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

把恢复响应改成RAG，确认结果跟着变化。再记录恢复前后的requestId，检查响应如何关联到同一个待处理请求。不要随意生成新ID后把它当作原请求的回答。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

上线需要保存检查点与业务待办之间的对应关系，并考虑超时、取消、重复点击和撤回。只有待办状态与运行状态一致，用户才不会在页面上看到已批准而后台仍在等待。恢复代码也要有总时限，异常时保留排查所需的关联信息。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
