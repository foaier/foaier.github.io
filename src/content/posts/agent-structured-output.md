---
title: "结构化输出：把一段回答变成程序能读取的字段"
date: "2026-11-20"
summary: "定义 C# 结果类型并读取结构化响应"
series: "Agent Framework 入门"
order: 6
tags: ["Agent Framework 入门","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-agent"]
goals: ["定义 C# 结果类型并读取结构化响应","区分格式正确与业务事实正确，处理缺失字段"]
---

聊天窗口里看一段文字很方便，程序处理它却不方便。如果你要提取学习主题、已经掌握的技能和缺少的信息，最好让模型返回明确字段，而不是靠字符串切割去猜哪一句代表什么。

## 先定义业务真正需要什么

本篇的StudyRequest包含Topic、KnownSkills和MissingInformation三个字段。它们分别表示学习主题、已经知道的能力和仍需追问的信息。我们故意不让模型替用户补上每天学习多久，因为输入没有提供。

一个清楚的结果类型，能同时帮助模型、调用代码和读者理解任务。不要把几十个可能用到的字段一次都塞进去。先提取当前功能真正需要的数据，其他需求以后再增加。

## 准备并运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载并解压[课程示例](/downloads/ai-course.zip)。在解压后的 ai-course 目录打开终端。本篇使用 .NET 10，核心包 Microsoft.Agents.AI 1.28.0；依赖版本已写在项目文件中。

```powershell
dotnet run --project Core -- structured
```

需要在线模型的练习，请先在当前终端设置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。不要把网页聊天产品的登录密码当作 API Key。模型调用会消耗所选服务的额度；本地模型则需要相应硬件和运行服务。

## 读取一个类型化结果

代码位于Core/Lessons/Tools.cs。StudyRequest类型也在同一个文件中。RunAsync的泛型参数告诉框架希望得到什么结构，Result则是反序列化之后的对象。

```csharp
public static async Task Structured()
{
    var agent = CourseClient.Agent("提取学习需求，缺少的信息写进 MissingInformation，不要自行补充。 ");
    var response = await agent.RunAsync<StudyRequest>("我想学AI，会一点C#，但还没决定每天学多久。");
    var request = response.Result;
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(request));
    if (string.IsNullOrWhiteSpace(request.Topic)) throw new InvalidOperationException("缺少学习主题。");
}
```


你会在终端看到JSON形式的字段。已知技能应该包含C#，缺失信息应该提到学习时间，而不是擅自设定每天两小时。措辞可以不同，但不应改变已知事实。输出格式由当前模型及提供商的结构化能力共同决定。

## 格式正确，内容也可能不对

一个字段能成功反序列化成数字，只证明它符合类型要求，不证明数字来自可靠事实。模型仍可能误解需求、漏掉信息或给出业务不允许的值。因此例子在读取之后继续检查Topic是否为空。

正式应用通常还要检查枚举是否允许、日期是否合理、金额是否在范围内，以及引用是否来自本次检索结果。对于关键字段，可以要求用户确认。不要把结构化输出当作数据库约束或鉴权系统的替代品。

## 缺少信息时怎样设计

如果输入里没有预算，程序应该能表达“不知道”。可以使用可空字段、明确的状态值，或者像本篇一样单独列出MissingInformation。不要为了满足非空字段而强迫模型编造一个默认事实。

如果结果不符合要求，可以提示用户补充信息，或者有限次数地重试并带上校验反馈。重试次数应有上限，每次调用都可能产生费用。不应该在一个无限循环中不断要求模型“再试一次”。

## 常见错误与练习

若服务返回不支持response_format或JSON Schema，先查当前模型的能力说明。兼容Chat Completions不代表完整支持所有结构化参数。若某个字段总是错，简化Schema、改进字段说明，并使用几组真实但无敏感信息的样例验证。

小练习：把输入分别换成“完全不会编程，每天20分钟”和“想学向量数据库，但没有确定开发语言”。在运行前自己列出预期的已知信息和未知信息，再比较模型结果。

接下来在综合项目里，我们会返回答案和引用编号，并用程序检查引用是否属于这次检索到的资料。这样格式检查就能和业务验收结合起来。

## 参考资料

- [结构化输出](https://learn.microsoft.com/en-us/agent-framework/agents/structured-outputs)
- [JSON 序列化与反序列化](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/overview)
