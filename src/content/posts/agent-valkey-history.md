---
title: "Valkey 会话历史：让消息跨进程保留下来"
date: "2026-11-20"
summary: "把会话消息交给 ValkeyChatHistoryProvider，并验证重新启动后的读取。"
series: "Agent Framework 进阶"
order: 14
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-session-persistence"]
goals: ["把会话消息交给 ValkeyChatHistoryProvider，并验证重新启动后的读取。"]
---

本地 JSON 适合个人实验，多个工作进程共同处理对话时，就需要共享消息存储。Valkey 可以承担这项工作。本篇保存的是会话消息序列，不是自动提炼的“用户画像”，也不是向量语义记忆。先分清这三个概念，配置才不会越改越乱。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。 本机需要 Valkey 服务，设置 VALKEY_CONNECTION（例如 localhost:6379）。可用 Docker 启动专用实验实例，持久化要求请单独配置。

~~~powershell
dotnet run --project Integrations -- valkey
~~~

## 代码是怎样工作的

示例连接 Valkey，使用 ValkeyChatHistoryProvider 管理历史，并给演示会话设置稳定标识和课程专用前缀。最大消息数量设为二十，防止练习无限增长。重新启动控制台程序仍用同一标识，就能访问原有消息；换标识等于换一段对话。

```csharp
public static async Task Valkey()
    {
        using var connection = await ConnectionMultiplexer.ConnectAsync(
            Environment.GetEnvironmentVariable("VALKEY_CONNECTION") ?? "localhost:6379");
        var provider = new ValkeyChatHistoryProvider(connection,
            _ => new ValkeyChatHistoryProvider.State("demo-learner:conversation-1"),
            new() { KeyPrefix = "foaier_course", MaxMessages = 20 });
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        { ChatOptions = new() { Instructions = "根据会话回答，不知道就说不知道。" }, ChatHistoryProvider = provider });
        var session = await agent.CreateSessionAsync();
        Console.Write("输入一句话（第二次运行可问上次学了什么）：");
        Console.WriteLine(await agent.RunAsync(Console.ReadLine() ?? "我上次学了什么？", session));
        Console.WriteLine("消息条数：" + await provider.GetMessageCountAsync(session));
    }
```



## 怎样判断成功

第一次输入“我想先学RAG”，结束程序后再次启动，询问“我刚才想学什么”。同时查看输出的消息数量是否增加。这个实验验证的是客户端重启；Valkey 自身重启后能否保留数据，取决于它的持久化和部署配置，不能由这个结果推断。

## 自己改一次

更换会话标识再问相同问题，预期无法读取上一段对话。随后连续发送多条消息，观察数量限制的行为。保留工具调用时要注意请求与结果成对，不能随意截断出一条没有对应调用的工具结果。

## 遇到问题先看这里

连接失败先确认端口和服务状态，再看认证与 TLS。本文的本机连接不适合直接用于公网。多租户前缀必须由后端身份生成，不使用问题文本作为键。生产系统还应定义过期时间、删除机制和可接受的数据丢失范围。

## 参考资料

- [Valkey 文档](https://valkey.io/topics/)
- [上下文提供器](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/context-providers)
