---
title: "中间件：在模型调用前后记录耗时和处理错误"
date: "2026-11-20"
summary: "使用 DelegatingChatClient 包装一次模型调用"
series: "Agent Framework 进阶"
order: 24
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-dependency-injection"]
goals: ["使用 DelegatingChatClient 包装一次模型调用","观察调用耗时，并理解模型层与Agent运行层的区别"]
---

当调用只剩一行RunAsync，排查问题反而可能变困难：到底是模型慢、工具慢，还是请求根本没发出去？中间件的思路是在处理前后放一层公共逻辑。本篇从最容易观察的耗时开始。

## 先选择包在哪一层

一次Agent运行可能包含多次模型请求和多次工具执行。在模型客户端外面包一层，观察到的是模型请求；在整个Agent运行外面计时，观察到的是总时长。它们回答不同的问题，不应该混在同一条没有说明的指标里。

本篇使用Microsoft.Extensions.AI的DelegatingChatClient。它提供一层可委托给内部客户端的包装，适合记录耗时、统一处理调用信息等。Agent本身仍然通过IChatClient使用模型，不需要知道这个外层装饰器的细节。

## 准备并运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载并解压[课程示例](/downloads/ai-course.zip)。在解压后的 ai-course 目录打开终端。本篇使用 .NET 10，核心包 Microsoft.Agents.AI 1.28.0；依赖版本已写在项目文件中。

```powershell
dotnet run --project Core -- middleware
```

需要在线模型的练习，请先在当前终端设置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。不要把网页聊天产品的登录密码当作 API Key。模型调用会消耗所选服务的额度；本地模型则需要相应硬件和运行服务。

## 包装器怎样接进来

```csharp
public static async Task Middleware()
{
    using var client = new TimingChatClient(CourseClient.Create());
    var agent = client.AsAIAgent(instructions: "简短回答。", name: "TimedAgent");
    Console.WriteLine(await agent.RunAsync("解释一次模型请求经过哪些步骤。"));
}
```


TimingChatClient类位于同一个Engineering.cs文件。它在调用前启动Stopwatch，在finally中打印耗时，然后把正常结果或异常继续交给上层。finally能保证失败时也留下耗时记录，不会只统计成功请求。

完整类覆盖GetResponseAsync，保留ChatOptions和CancellationToken，再调用base实现。这里没有覆盖流式方法，因此它只演示普通调用的计时。若要统计流式请求，应覆盖相应方法并定义“首个输出”和“全部完成”的不同时间点。

## 预期结果与一个失败实验

正常运行会出现一行模型调用耗时，以及模型回答。网络环境和模型负载会影响耗时，所以没有固定毫秒数作为正确答案。先确认它确实包住了那一次请求，再考虑收集多次运行的分布。

把AI_MODEL临时设置为不存在的演示名称，预期看到失败，同时仍有耗时信息。完成后恢复真实模型配置。不要故意高频请求线上接口来制造限流，也不需要为了这个实验反复发送长提示词。

## 记录什么，避免记录什么

通常可以记录模型标识、耗时、状态码、请求关联ID及用量。完整提示词和工具返回值可能包含个人信息或业务数据，默认不应全部打印。需要排查时应有明确的脱敏、采样和访问控制。

重试也不应该简单放进一个无限循环。判断错误是否可重试，设置上限与退避，并区分纯模型请求和已经产生业务副作用的工具操作。用户取消时，应继续传递取消信号，避免后台还在消耗额度。

## 小练习

在包装器里加入成功与失败的标记，但仍然重新抛出异常。对同一条短问题运行三次，比较耗时。然后思考为什么三次样本不足以判断系统性能：网络波动、首次连接、服务排队都可能影响结果。

接下来学习OpenTelemetry时，我们会把请求、Agent、模型和工具关联成一条链。日志先帮助你看见一次调用，追踪则帮助你理解多个调用之间的关系。

## 参考资料

- [Microsoft.Extensions.AI 中间件](https://learn.microsoft.com/en-us/dotnet/ai/microsoft-extensions-ai)
- [Agent 可观察性](https://learn.microsoft.com/en-us/agent-framework/agents/observability)
