---
title: "向量历史记忆：从旧对话里找回相关片段"
date: "2026-11-20"
summary: "运行 ChatHistoryMemoryProvider，理解检索历史与保存全部历史的区别。"
series: "Agent Framework 进阶"
order: 13
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["embeddings-schema","sessions-memory"]
goals: ["运行 ChatHistoryMemoryProvider，理解检索历史与保存全部历史的区别。"]
---

如果聊了几百轮，把全部消息重新发送给模型既贵又容易超出上下文。另一种办法是先查“哪些历史与当前问题有关”，只带入相关内容。ChatHistoryMemoryProvider 负责把这条路径接进 Agent；它解决的是检索上下文，不会自动成为完整的业务审计日志。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。 另设 AI_EMBEDDING_MODEL 和 AI_EMBEDDING_DIMENSIONS，值必须与真实向量服务一致。

~~~powershell
dotnet run --project Integrations -- history-memory
~~~

## 代码是怎样工作的

示例用 embedding 客户端把历史转换为向量，用 InMemoryVectorStore 保存记录，再创建带用户和会话范围的 ChatHistoryMemoryProvider。第一次写入虚构学习偏好，第二次创建新会话检索。这里故意使用内存向量库，方便观察流程；进程结束后记录就消失，不具备跨重启持久化。

```csharp
public static async Task History()
    {
        var embeddingClient = new OpenAIClient(new ApiKeyCredential(CourseClient.Required("AI_API_KEY")),
            new OpenAIClientOptions { Endpoint = new Uri(CourseClient.Required("AI_ENDPOINT")) })
            .GetEmbeddingClient(CourseClient.Required("AI_EMBEDDING_MODEL")).AsIEmbeddingGenerator();
        int dimensions = int.Parse(CourseClient.Required("AI_EMBEDDING_DIMENSIONS"));
        using var store = new InMemoryVectorStore(new() { EmbeddingGenerator = embeddingClient });
        var memory = new ChatHistoryMemoryProvider(store, "course-history", dimensions,
            _ => new ChatHistoryMemoryProvider.State(
                storageScope: new() { UserId = "demo-learner", SessionId = Guid.NewGuid().ToString("N") },
                searchScope: new() { UserId = "demo-learner" }),
            options: new() { MaxResults = 3, EnableSensitiveTelemetryData = false });
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        { ChatOptions = new() { Instructions = "根据已知的学习偏好回答，不知道就说不知道。" }, AIContextProviders = [memory] });
        var first = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("我喜欢用C#做例子，每天学习20分钟。", first));
        var second = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("请按我的偏好推荐今天怎么学。", second));
        Console.WriteLine("这个实验使用内存向量存储；进程退出后，存储内容会消失。");
    }
```



## 怎样判断成功

程序应完成向量生成、保存以及新会话中的回答。检查检索内容与问题是否相关，并确认范围一致。模型说对偏好只是一个信号，最好同时观察向量存储中的记录。没有真实 embedding 服务时，只能编译这段代码，不能宣称完成了记忆验证。

## 自己改一次

把第二个问题换成无关内容，观察是否仍带入旧偏好。然后给另一个用户写入不同偏好，验证隔离。还可以比较原句和同义改写，体会语义检索与关键词检索的差异，但不能从一两个例子推断所有查询效果。

## 遇到问题先看这里

最常见问题是维度与模型不匹配，或把聊天模型名填进 embedding 接口。不同模型即使维度相同，也不应混用向量。更换向量模型后应重建记录；改成持久化向量库时，还要处理重复写入、删除和权限过滤。

## 参考资料

- [上下文提供器](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/context-providers)
- [会话管理](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/session)
