---
title: "会话保存与恢复：退出程序以后，接着上次聊"
date: "2026-11-20"
summary: "把 Session 序列化到文件并在第二次运行恢复"
series: "Agent Framework 入门"
order: 3
tags: ["Agent Framework 入门","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["sessions-memory"]
goals: ["把 Session 序列化到文件并在第二次运行恢复","区分本地状态文件和模型服务保存的远程数据"]
---

上一课的对话状态只存在于运行中的程序里。关掉终端之后，下一次运行会重新开始。这一篇把Session写进文件，真正做一次“关闭程序，再接着聊”的实验。

## 保存的究竟是什么

序列化是把运行时状态转换成可存储的格式，反序列化则把它恢复回来。AgentSession的具体实现由Agent决定，所以应该调用Agent提供的SerializeSessionAsync和DeserializeSessionAsync，不要自己猜内部字段再拼一个JSON。

本篇使用本地ChatClientAgent。换成服务托管Agent时，序列化结果可能包含远端会话标识，而不是所有聊天记录。保存文件不等于备份了整个云资源；远端数据被删除或权限失效后，单靠这个文件无法恢复服务端内容。

## 准备并运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载并解压[课程示例](/downloads/ai-course.zip)。在解压后的 ai-course 目录打开终端。本篇使用 .NET 10，核心包 Microsoft.Agents.AI 1.28.0；依赖版本已写在项目文件中。

```powershell
dotnet run --project Core -- save
```

需要在线模型的练习，请先在当前终端设置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。不要把网页聊天产品的登录密码当作 API Key。模型调用会消耗所选服务的额度；本地模型则需要相应硬件和运行服务。

## 运行两次，观察两个分支

代码位于 Core/Lessons/FirstSteps.cs。第一次没有文件时，它告诉助手“学习主题是向量搜索”；第二次发现文件后，则恢复会话并询问上次的主题。

```csharp
public static async Task SaveSession()
{
    var agent = CourseClient.Agent("根据会话回答问题，不知道的信息不要编造。");
    var file = CourseClient.StateFile("session.json");
    AgentSession session;
    if (File.Exists(file))
    {
        using var document = System.Text.Json.JsonDocument.Parse(await File.ReadAllTextAsync(file));
        session = await agent.DeserializeSessionAsync(document.RootElement);
        Console.WriteLine(await agent.RunAsync("我上次学习的主题是什么？", session));
    }
    else
    {
        session = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("我这次学习的主题是向量搜索。", session));
    }
    var state = await agent.SerializeSessionAsync(session);
    await File.WriteAllTextAsync(file, state.GetRawText());
    Console.WriteLine("会话已保存。退出后再运行同一命令，观察第二次回答。");
}
```


课程示例把状态写入运行目录下的.state/session.json。你应该能在第一次结束后看到这个文件。第二次使用同一目录、同一模型配置运行，预期回答会提到向量搜索。检查答案时关注事实，不要求措辞完全一致。

## 为什么工作目录很重要

相对路径从当前工作目录计算。若第一次在ai-course目录运行，第二次跑到另一个目录，程序可能读不到原来的文件，于是又创建了新会话。这是文件路径问题，不是模型突然失忆。排错时记录当前目录和文件实际位置。

完整示例是单用户实验。真正的应用应使用独立的用户和会话键，处理并发写入、访问权限、版本升级以及失败恢复。不能让两个请求同时覆盖同一个文件，也不能把未经验证的用户输入直接拼成任意文件路径。

## 保留与删除也属于功能

聊天状态可能包含用户输入和工具结果。保存之前应明确保存期限与访问者，删除会话时也应删除对应持久化数据。这个示例用虚构学习主题，便于观察结构；不要把真实业务对话文件随手上传到公开仓库。

如果需要重新开始实验，可以手动删除本练习生成的.state/session.json，再次运行。只删除明确属于本练习的文件。你也可以先复制一份到自己的临时位置，比较不同运行产生的内容。

## 小练习与排错

把学习主题改成函数工具，重新建立会话，退出后再询问。然后把状态文件临时改名，观察程序为什么走回首次运行分支。最后想一想：如果升级框架后旧文件无法读取，你准备怎样保留原文件并向用户说明？

解析JSON失败，先检查文件是否被截断。恢复成功但答案不对，检查是否用了同一个Agent配置及会话。下一篇学习 [聊天记录裁剪](/articles/agent-history-reducer/)，解决“历史越来越长”的另一个问题。

## 参考资料

- [Session 保存与恢复](https://learn.microsoft.com/en-us/agent-framework/concepts/agents/conversations/session)
- [System.Text.Json 文档](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/overview)
