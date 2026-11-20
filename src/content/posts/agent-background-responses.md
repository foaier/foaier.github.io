---
title: "后台响应：提交长任务，带着继续标识查询结果"
date: "2026-11-20"
summary: "理解 AllowBackgroundResponses 和 ContinuationToken，写一个有超时的轮询。"
series: "Agent Framework 进阶"
order: 27
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-responses-api","agent-session-persistence"]
goals: ["理解 AllowBackgroundResponses 和 ContinuationToken，写一个有超时的轮询。"]
---

把 await 去掉并不会让任务可靠地跑到完成。提供方的后台响应，是把一次模型请求交给支持该能力的服务处理，然后按标识查询进度。它和应用自己的后台队列、多个 Agent 的并行委派是不同的事情。本篇只验证第一种。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Integrations -- background
~~~

## 代码是怎样工作的

先创建 Session 和允许后台响应的 AgentRunOptions。首次运行后，如果返回 ContinuationToken，就等待两秒，把标识放回 options，再调用没有新用户消息的 RunAsync。没有继续标识时输出结果。循环有两分钟本地超时，防止实验无限等待；快速完成的请求可能根本不进入循环。

```csharp
public static async Task Background()
    {
        using var client = ResponsesClient();
        var agent = client.AsAIAgent(instructions: "用中文整理一份AI入门路线，说明每一步的练习。");
        var session = await agent.CreateSessionAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(2));
        var options = new AgentRunOptions { AllowBackgroundResponses = true };
        var response = await agent.RunAsync("写一份包含五个阶段的学习路线。", session, options, timeout.Token);
#pragma warning disable MEAI001
        while (response.ContinuationToken is { } continuation)
        {
            Console.WriteLine("服务仍在处理，稍后查询。");
            await Task.Delay(TimeSpan.FromSeconds(2), timeout.Token);
            options.ContinuationToken = continuation;
            response = await agent.RunAsync(session, options, timeout.Token);
        }
#pragma warning restore MEAI001
        Console.WriteLine(response);
    }
```



## 怎样判断成功

支持后台模式的服务可能先打印几次“仍在处理”，最后给出路线。某些模型直接完成，也属于正常情况。示例只在当前进程保留继续标识，没有宣称重启自动恢复。若要跨重启，应持久化标识、Session 和业务任务状态，再验证恢复与取消。

## 自己改一次

缩短本地超时，观察取消异常。然后思考：停止本地轮询是否等于取消云端任务？答案通常不能直接画等号，需要调用服务支持的取消接口并确认状态。把这个区别写进你自己的界面提示。

## 遇到问题先看这里

后台模式不支持时，不要用 Task.Run 包住调用来假装兼容。检查模型、接口与服务版本。恢复时继续同一任务，不能每轮重新发送原问题，否则可能重复付费创建任务。真实业务还需要幂等、失败状态和明确的费用预算。

## 参考资料

- [后台响应](https://learn.microsoft.com/en-us/agent-framework/agents/background-responses)
- [后台模式](https://platform.openai.com/docs/guides/background)
