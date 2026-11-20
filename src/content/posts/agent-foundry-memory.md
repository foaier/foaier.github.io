---
title: "Foundry Memory：在云端管理跨会话记忆"
date: "2026-11-20"
summary: "接入 FoundryMemoryProvider，验证异步写入和用户范围。"
series: "Agent Framework 进阶"
order: 15
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["foundry-models","agent-file-memory"]
goals: ["接入 FoundryMemoryProvider，验证异步写入和用户范围。"]
---

文件记忆由你的程序管理目录，Foundry Memory 把存储和检索交给云端服务。你仍然要决定哪些信息值得留下、属于哪个用户、什么时候删除。托管服务替你运行基础能力，不会替应用做出正确的数据边界判断。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。需要可用的 Foundry 项目、已部署模型和专用 Memory Store。设置 FOUNDRY_PROJECT_ENDPOINT、FOUNDRY_MODEL_DEPLOYMENT、FOUNDRY_MEMORY_STORE，并用 az login 登录有权限的账号。

~~~powershell
dotnet run --project Integrations -- foundry-memory
~~~

## 代码是怎样工作的

FoundryMemoryProvider 接收项目客户端、已有 Memory Store 名称以及范围工厂。演示使用 course-demo-learner 作为虚构用户，再把提供器加入 ChatClientAgentOptions。程序不自动创建或删除云资源；先在控制台准备好资源，才容易分清权限、配置和代码问题。此功能在固定版本中仍为实验能力。

```csharp
public static async Task Memory()
    {
        var project = Project();
        // Foundry记忆在本版本中仍为实验能力；仅在这一段接受该标记。
#pragma warning disable MAAI001
        var memory = new FoundryMemoryProvider(project, CourseClient.Required("FOUNDRY_MEMORY_STORE"),
            _ => new FoundryMemoryProvider.State(new FoundryMemoryProviderScope("course-demo-learner")));
#pragma warning restore MAAI001
        // 先在Foundry控制台创建专用实验Memory Store；本例不自动新建或删除云资源。
        var agent = project.AsAIAgent(new ChatClientAgentOptions
        {
            ChatOptions = new() { ModelId = CourseClient.Required("FOUNDRY_MODEL_DEPLOYMENT"), Instructions = "使用已知学习偏好回答，不猜测。" },
            AIContextProviders = [memory],
        });
        var session = await agent.CreateSessionAsync();
        Console.Write("输入要记住的虚构偏好，或询问已有偏好：");
        Console.WriteLine(await agent.RunAsync(Console.ReadLine() ?? "你知道我的学习偏好吗？", session));
        Console.WriteLine("记忆更新是异步的。请在控制台确认完成，再用同一Scope重新运行查询。");
    }
```



## 怎样判断成功

第一次输入一条虚构偏好，等控制台显示记忆更新完成后，再运行程序询问偏好。写入是异步的，刚回复成功不等于记忆立刻可查。这里的代码通过编译，云端验收需要你自己的资源、权限和额度。

## 自己改一次

更换 Scope 做隔离实验，再回到原 Scope 查询。记录首次写入到可查询的时间，给未来界面设计留出“处理中”的状态。最后在测试资源中检查记忆是否能按预期删除，避免只有写入路径而没有生命周期管理。

## 遇到问题先看这里

找不到 Memory Store 时检查项目、区域和名称是否一致。认证成功但调用被拒绝，通常还要核对资源角色。不要因为返回空结果就连续重复写入同一条偏好；先查异步任务和服务状态。

## 参考资料

- [Foundry 集成](https://learn.microsoft.com/en-us/agent-framework/integrations/by-provider/microsoft-foundry)
- [上下文提供器](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/context-providers)
