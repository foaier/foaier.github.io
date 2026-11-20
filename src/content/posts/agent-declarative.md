---
title: "声明式 Agent：把行为说明放进 YAML"
date: "2026-11-20"
summary: "加载真实 YAML 定义，并区分配置和可执行能力。"
series: "Agent Framework 进阶"
order: 26
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-agent"]
goals: ["加载真实 YAML 定义，并区分配置和可执行能力。"]
---

如果只是调整一句教学风格就要修改一大片业务代码，维护会很累。声明式 Agent 可以把名称、说明和行为要求放进配置。配置让修改集中，但并没有免除版本管理、验证和测试；一行指令变化也可能改变模型行为。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Integrations -- declarative
~~~

## 代码是怎样工作的

示例使用 ChatClientPromptAgentFactory，传入已配置的 IChatClient，再调用 CreateFromYamlAsync。YAML 使用当前包支持的 kind: Prompt、name、description、instructions。模型连接由程序提供，这样凭证不会混入文章或配置。不要把自己设计的字段当作所有运行器都识别的标准。

```csharp
public static async Task Declarative()
    {
        using var client = CourseClient.Create();
        var yaml = """
            kind: Prompt
            name: StudyCoach
            description: 用具体例子帮助AI新手学习
            instructions: 请用中文回答。先举一个生活例子，再解释对应的技术名词。
            """;
        var factory = new ChatClientPromptAgentFactory(client);
        var agent = await factory.CreateFromYamlAsync(yaml)
            ?? throw new InvalidOperationException("没有创建出Agent，请检查YAML定义。");
        Console.WriteLine(await agent.RunAsync("什么是工具调用？"));
    }
```



## 怎样判断成功

应创建一个用生活例子讲工具调用的 Agent。接着修改 instructions 后再次运行，观察行为是否变化。解析成功只证明格式与工厂兼容，不等于模型一定遵守全部要求；因此配置发布也需要一组固定问题做回归。

## 自己改一次

把同一 YAML 提取到本地文件，用 File.ReadAllTextAsync 读取后交给工厂，再刻意写错 kind 看错误。记录什么错误发生在加载阶段、什么错误发生在模型调用阶段，这样将来排查配置问题会更快。

## 遇到问题先看这里

缩进、冒号和字段名称最容易出错。下载项目固定了 Declarative 的 rc 版本，不能随便套用另一框架的 YAML。配置文件应该来自可信的部署来源；不要允许终端用户上传配置并任意开启工具或覆盖系统权限。

## 参考资料

- [声明式 Agent](https://learn.microsoft.com/en-us/agent-framework/agents/declarative)
- [Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
