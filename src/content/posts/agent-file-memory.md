---
title: "文件记忆：让 Agent 在新会话里读到学习偏好"
date: "2026-11-20"
summary: "使用 FileMemoryProvider，区分保存消息与长期记忆。"
series: "Agent Framework 进阶"
order: 12
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["sessions-memory"]
goals: ["使用 FileMemoryProvider，区分保存消息与长期记忆。"]
---

聊天窗口关掉，再打开一个新会话，学习助手还记得你喜欢 C# 例子吗？如果只把消息放在旧 Session 里，新会话当然不知道。文件记忆把值得保留的信息放到单独的文件存储，再按使用者范围提供给后续会话。这跟“永远记住每句话”是两回事。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- file-memory
~~~

## 代码是怎样工作的

示例在 .state 下创建 FileSystemAgentFileStore，使用固定的演示用户范围，把 FileMemoryProvider 加入 Agent 的 AIContextProviders。第一轮让模型记住一条虚构偏好，随后列出文件，再创建新 Session 查询。文件存储接口在这个版本仍有实验标记，源码只在相关代码段屏蔽 MAAI001。

```csharp
public static async Task FileMemory()
    {
        var root = CourseClient.StateFile("memory");
        Directory.CreateDirectory(root);
        // 文件系统存储在此固定版本中仍标为实验 API。
#pragma warning disable MAAI001
        var store = new FileSystemAgentFileStore(root);
#pragma warning restore MAAI001
        using var provider = new FileMemoryProvider(store, _ => new FileMemoryState { WorkingFolder = "users/demo-learner" });
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        {
            ChatOptions = new() { Instructions = "你是学习助手。使用记忆工具保存用户明确要求记住的偏好；回答前读取已有偏好。" },
            AIContextProviders = [provider],
        });
        var first = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("请记住：我的学习语言是C#，喜欢先看例子再看术语。", first));
        Console.WriteLine("当前记忆文件：");
        foreach (var filename in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
            Console.WriteLine(Path.GetRelativePath(root, filename));
        var second = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("我喜欢怎样学习？请先读取记忆再回答。", second));
    }
```



## 怎样判断成功

先观察有没有实际生成记忆文件，再观察新会话能否读到偏好。模型也可能没有写入，因此要把文件内容和答案一起检查。这里写入真实本地文件，清理实验可删除自己这个示例的 .state 目录；不要误删其他项目的数据。

## 自己改一次

使用另一个演示用户范围重新运行，确认不应读到第一个用户的偏好。再修改一条偏好，检查是否出现相互矛盾的旧信息。长期记忆需要更新和删除策略，不是不断追加就完成了。

## 遇到问题先看这里

文件目录无写权限、范围不一致、模型不支持所需工具，都可能让记忆失效。不要仅靠回答是否流畅判断。真实应用由登录身份决定范围，不让用户在问题里指定别人的目录；敏感数据也不适合默认写入长期记忆。

## 参考资料

- [上下文提供器](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/context-providers)
- [会话管理](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/session)
