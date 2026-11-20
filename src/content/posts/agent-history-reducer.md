---
title: "聊天历史太长怎么办？先做一次裁剪实验"
date: "2026-11-20"
summary: "使用 IChatReducer 的实现裁剪消息并观察信息丢失"
series: "Agent Framework 入门"
order: 8
tags: ["Agent Framework 入门","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["sessions-memory","agent-session-persistence"]
goals: ["使用 IChatReducer 的实现裁剪消息并观察信息丢失","理解按条数裁剪、Token限制和摘要之间的区别"]
---

会话保存下来以后，并不意味着每次都应该把全部历史发送给模型。对话越长，请求可能越贵、越慢，也可能超过上下文窗口。这一篇先用一个最小实验，亲自观察裁剪历史的代价。

## 为什么直接删除旧消息会影响答案

我们先在较早的一轮告诉模型练习编号，然后聊一个新主题。裁剪时保留较少的最近消息，旧编号可能离开当前上下文。再次询问编号时，模型就应该承认缺少信息。

这不是状态文件丢失，也不是模型参数变化。历史记录可以仍然存在于存储中，只是本次请求没有把全部记录带上。把“存了什么”和“本次用了什么”分开，排错时会清楚很多。

## 准备并运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载并解压[课程示例](/downloads/ai-course.zip)。在解压后的 ai-course 目录打开终端。本篇使用 .NET 10，核心包 Microsoft.Agents.AI 1.28.0；依赖版本已写在项目文件中。

```powershell
dotnet run --project Core -- reduce
```

需要在线模型的练习，请先在当前终端设置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。不要把网页聊天产品的登录密码当作 API Key。模型调用会消耗所选服务的额度；本地模型则需要相应硬件和运行服务。

## 跟着代码检查消息列表

Core/Lessons/Memory.cs中先建立几条演示消息，再用MessageCountingChatReducer裁剪。这个版本将相关API标记为实验接口，代码只在相应几行显式接受MEAI001标记，并固定依赖版本；升级时应重新检查。

```csharp
public static async Task Reduce()
{
    using var client = CourseClient.Create();
    var messages = new List<ChatMessage>
    {
        new(ChatRole.System, "只根据提供的对话回答，不知道时说不知道。"),
        new(ChatRole.User, "我的练习编号是 DEMO-001。"),
        new(ChatRole.Assistant, "记住了。"),
        new(ChatRole.User, "今天学习会话。"),
        new(ChatRole.Assistant, "可以先试两轮对话。"),
    };
    // 此版本的 reducer 标记为实验 API；练习固定包版本，并只在这里接受该标记。
#pragma warning disable MEAI001
    var reducer = new MessageCountingChatReducer(2);
    var reduced = (await reducer.ReduceAsync(messages, CancellationToken.None))?.ToList() ?? messages;
#pragma warning restore MEAI001
    reduced.Add(new(ChatRole.User, "我的练习编号是什么？"));
    Console.WriteLine($"裁剪前 {messages.Count} 条，提问前保留 {reduced.Count - 1} 条。");
    Console.WriteLine((await client.GetResponseAsync(reduced)).Text);
}
```


输出会显示裁剪前后条数，再显示模型的回答。注意，系统指令、工具请求与结果的配对等规则可能影响最终保留集合，因此不要只凭“设置2就一定留下任意2条”来写业务逻辑。可以在本地查看每条保留消息，确认实际行为。

## 按条数与按Token不是同一回事

一条消息可能只有几个字，也可能包含一整份报告。保留十条消息不代表它们一定放得进上下文窗口。模型实际限制的是Token等资源，应用需要结合分词、输入长度和输出预算来管理。

摘要可以把旧历史压缩成较短文本，但摘要也可能漏掉约束或写错细节。重要事实可以保存成明确字段，并记录来源；临时闲聊则可以更激进地裁剪。不要把用户授权、业务金额或待处理工具状态随意交给摘要覆盖。

## 工具消息为什么不能乱切

一次工具调用通常有请求和结果，两者通过标识关联。只留下结果没有请求，或只留下请求却没有结果，可能导致提供商拒绝请求，也可能让后续推理失去语境。

因此正式项目优先使用理解消息结构的裁剪器，并针对自己的模型协议测试。自己写messages.TakeLast时，至少要明确它会不会切断工具调用链。本篇使用纯文字对话，就是为了先把最基本的现象看清楚。

## 小练习

把练习编号放到最近一轮，再运行，比较模型是否能恢复回答。接着增加一条很长的说明，观察按条数统计为什么反映不出长度变化。最后列出你的应用中“必须保留”和“可以丢弃”的信息。

完成后再学习长期记忆提供器。长期记忆解决跨对话检索信息的问题，历史裁剪解决本次请求装多少内容的问题，两者需要一起设计。

## 参考资料

- [会话与历史](https://learn.microsoft.com/en-us/agent-framework/concepts/agents/conversations/session)
- [Microsoft.Extensions.AI](https://learn.microsoft.com/en-us/dotnet/ai/microsoft-extensions-ai)
