---
title: "人工输入：工作流停下来，等你选好主题再继续"
date: "2026-11-20"
summary: "运行 human 练习并观察节点事件"
series: "工作流实践"
order: 16
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["workflow-loop"]
goals: ["运行 human 练习并观察节点事件","工作流停下来，等你选好主题再继续"]
---

有些问题无法由模型或代码代替人决定，例如想学习哪个主题。这一课通过RequestPort向外部请求一段文字，收到响应后再继续。它与工具审批相近，但这里请求的是一般业务输入。

## 先理解这一步的职责

RequestPort声明请求与响应的类型。运行时出现RequestInfoEvent，调用方展示问题，并用原请求的CreateResponse建立关联响应，然后SendResponseAsync交回运行器。自己创建一个不相关字符串，不能替代这个关联过程。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- human
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

终端会提示输入主题。输入MCP后应看到已选择MCP；输入RAG则输出RAG。程序没有调用模型，也不会偷偷把选择保存到外部系统。停下来等待是正常状态，不应该在界面上显示为失败。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

给输入加上白名单，只允许RAG和MCP。对空输入提示重试，并设置最多三次。将确认、取消和超时设计成不同结果，想想下一节点应该怎样处理它们。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

Web应用不能长期占住一个HTTP请求等人回来。通常应保存runId、requestId、用户身份和待处理状态，让另一个请求提交响应。校验响应属于同一个用户和任务，并防止重复回复；不能把任意客户端提交的requestId当作授权。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
