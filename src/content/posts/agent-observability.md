---
title: "可观察性入门：亲眼看到一次 Agent 调用的耗时"
date: "2026-11-20"
summary: "启用真实追踪事件，理解 instrumentation 与 exporter 的分工。"
series: "Agent Framework 进阶"
order: 25
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-middleware"]
goals: ["启用真实追踪事件，理解 instrumentation 与 exporter 的分工。"]
---

模型回复慢，到底是网络慢、模型慢，还是工具一直重试？只在外层写一句“运行结束”，排查时几乎没有帮助。可观察性先从一个小目标开始：让一次运行产生可以关联的追踪事件，并明确事件是谁发出的、谁接收的。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- telemetry
~~~

## 代码是怎样工作的

示例用 UseOpenTelemetry 给 Agent 加入追踪，sourceName 固定为 Foaier.Course。ActivityListener 只监听这个来源，在 ActivityStopped 时打印名称、耗时和状态。这里没有安装完整监控平台，控制台监听器是为了看清 .NET Activity 的机制；接入后端时再配置 exporter。

```csharp
public static async Task Telemetry()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "Foaier.Course",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllData,
            ActivityStopped = activity => Console.WriteLine($"[trace] {activity.DisplayName} {activity.Duration.TotalMilliseconds:F0}ms {activity.Status}"),
        };
        ActivitySource.AddActivityListener(listener);
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(instructions: "用一句中文回答。")
            .AsBuilder().UseOpenTelemetry(sourceName: "Foaier.Course").Build();
        Console.WriteLine(await agent.RunAsync("什么是追踪信息？"));
    }
```



## 怎样判断成功

正常调用应在中文回答附近出现 trace 行。没有监听器时，Activity 可能根本不会被采样；因此“加了 UseOpenTelemetry 却没有日志”要先检查订阅与采样。这段示例不输出完整提示词和工具参数。

## 自己改一次

先用无效模型名制造一次失败，观察追踪与异常是否能对应。再把 ShouldListenTo 改成错误名称，理解为什么事件消失。恢复后，把一次问题的总耗时与模型调用耗时对比，思考缺少哪些子步骤信息。

## 遇到问题先看这里

不要把普通 Console.WriteLine 当成完整的分布式追踪。跨服务关联还需要传播上下文，指标和日志也有各自用途。真实业务开启内容采集前，应明确脱敏、保留和访问范围；初期只记录必要标识与耗时就已经很有价值。

## 参考资料

- [Agent 可观察性](https://learn.microsoft.com/en-us/agent-framework/agents/observability)
- [.NET 分布式追踪](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/distributed-tracing)
