---
title: "Chat Completions 与 Responses：同样是聊天，接口为什么不同？"
date: "2026-11-20"
summary: "运行 Responses 客户端，并判断模型端点是否支持所需能力。"
series: "Agent Framework 进阶"
order: 6
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-agent"]
goals: ["运行 Responses 客户端，并判断模型端点是否支持所需能力。"]
---

模型名称相同，也不代表所有接口都能互换。Chat Completions 常见于基础聊天和兼容服务；Responses 提供另一套请求、响应与工具能力。对初学者来说，先记住一句：选择接口要看服务实际支持什么，不能只把网址末尾换一下。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Integrations -- responses
~~~

## 代码是怎样工作的

基础课程的 CourseClient 通过 GetChatClient 创建客户端。本篇用 GetResponsesClient，再通过 AsIChatClient(model) 接到相同的 Agent 抽象。外层 RunAsync 看起来一样，底层请求格式、状态管理和工具支持却不同。AI_ENDPOINT 应填基础 API 地址，不要手动追加 /responses。

```csharp
public static async Task Responses()
    {
        using var client = ResponsesClient();
        Console.WriteLine(await client.AsAIAgent(instructions: "用中文举例说明。")
            .RunAsync("什么是上下文？"));
    }
```


```csharp
public static IChatClient ResponsesClient() => new OpenAIClient(
        new ApiKeyCredential(CourseClient.Required("AI_API_KEY")),
        new OpenAIClientOptions { Endpoint = new Uri(Environment.GetEnvironmentVariable("AI_ENDPOINT") ?? "https://api.openai.com/v1") })
        .GetResponsesClient().AsIChatClient(CourseClient.Required("AI_MODEL"));
```


## 怎样判断成功

普通问答成功说明这个端点、模型和账号可以完成本次 Responses 调用；它不证明后台响应、文件搜索等所有能力都能用。课程核心走 Chat Completions，只有专题按需要切到 Responses，避免新手在两个 API 之间来回猜。

## 自己改一次

用同一问题分别运行 Core 的 chat 和 Integrations 的 responses。比较可观察到的延迟、返回结构和服务错误，再查服务商能力表。不要拿一次随机回答的文采决定哪套 API 更好；关注你需要的能力是否存在。

## 遇到问题先看这里

四零四常见于兼容服务没有实现 Responses，四百可能是模型或参数不支持。Responses 适配器在当前 SDK 中有实验标记，下载代码局部处理 OPENAI001；这不代表可以忽略其他编译诊断。会话标识和工具结果都要按选定接口管理。

## 参考资料

- [Responses 与 Chat Completions](https://platform.openai.com/docs/guides/migrate-to-responses)
- [Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
