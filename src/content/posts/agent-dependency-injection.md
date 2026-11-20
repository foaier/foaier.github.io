---
title: "依赖注入：让 Agent 和模型客户端各就各位"
date: "2026-11-20"
summary: "通过 ServiceCollection 创建模型客户端和 Agent"
series: "Agent Framework 入门"
order: 9
tags: ["Agent Framework 入门","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-function-tools"]
goals: ["通过 ServiceCollection 创建模型客户端和 Agent","理解 Singleton、Scoped、Transient 的生命周期影响"]
---

示例只有几行时，在方法里直接创建客户端很方便。项目长大后，多个功能都要使用模型、日志和业务服务，创建逻辑就会重复。依赖注入解决的是对象如何构造、如何复用和如何释放，不是给模型增加一种神秘能力。

## 用一个容器管理对象

你先告诉容器“需要IChatClient时怎样创建它”“需要AIAgent时怎样构造它”。使用方只声明需要什么，不再到处读取配置或new客户端。测试时也更容易替换某个依赖。

本篇先用控制台里的ServiceCollection，不同时引入Web API。这样可以直接看见注册、构建、创建作用域、取得服务和释放资源的过程。理解以后再迁移到ASP.NET Core会容易很多。

## 准备并运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载并解压[课程示例](/downloads/ai-course.zip)。在解压后的 ai-course 目录打开终端。本篇使用 .NET 10，核心包 Microsoft.Agents.AI 1.28.0；依赖版本已写在项目文件中。

```powershell
dotnet run --project Core -- di
```

需要在线模型的练习，请先在当前终端设置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。不要把网页聊天产品的登录密码当作 API Key。模型调用会消耗所选服务的额度；本地模型则需要相应硬件和运行服务。

## 逐步读懂注册代码

```csharp
public static async Task DependencyInjection()
{
    var services = new ServiceCollection();
    services.AddSingleton<IChatClient>(_ => CourseClient.Create());
    services.AddTransient<AIAgent>(provider => provider.GetRequiredService<IChatClient>()
        .AsAIAgent(instructions: "用中文解释一个AI概念。", name: "StudyCoach"));
    using var container = services.BuildServiceProvider(validateScopes: true);
    using var scope = container.CreateScope();
    var agent = scope.ServiceProvider.GetRequiredService<AIAgent>();
    Console.WriteLine(await agent.RunAsync("什么是依赖注入？用奶茶店举例。"));
}
```


AddSingleton表示容器范围内共享一个客户端；AddTransient表示每次解析时创建一个Agent实例。这里共享的是不携带单个用户对话状态的客户端配置。Session仍然应按会话创建和管理，不应该因为Agent注册成服务，就把所有用户的Session变成一个全局对象。

using会在作用域结束时释放资源。BuildServiceProvider启用了作用域校验，便于在开发时发现生命周期错误。更复杂的项目通常使用Host统一管理启动、配置与关闭，本篇先保留最少结构。

## Scoped服务为什么要小心

一个请求中的数据库上下文、用户身份或事务通常有自己的作用域。如果把它们保存到长寿命单例对象中，请求结束之后依赖可能已经释放，或者下次请求读到了上一个用户的状态。

后台任务尤其容易踩这个坑：HTTP请求结束后，任务还在运行。应该由后台执行过程建立自己的作用域，并根据持久化任务数据恢复身份与业务上下文，不能继续使用已经离开请求的临时对象。

## 工具也可以使用业务服务

假设查询课程的函数需要CourseCatalog服务，可以在工具所属对象的构造函数中接收这个服务，再把该对象的方法包装为AIFunction。这样业务查询与模型集成分开，直接调用业务服务就能检查查询逻辑。

不要把整个IServiceProvider随意交给模型，期待它自行选择服务。模型能看见的仍应是明确、受控的工具描述。服务容器是程序内部的对象管理机制，不是自动授权的工具目录。

## 小练习与常见错误

在Agent工厂里打印一条“创建Agent”的日志，连续解析两次，观察Transient行为。再将注册方式改成Singleton，比较创建次数。实验结束后恢复代码，并想一想：如果这个对象里有用户状态，哪种复用会带来问题？

找不到服务时检查是否注册了正确接口。提示从根容器解析Scoped服务时，先修正作用域，不要为了消除报错把所有依赖改成Singleton。下一篇可以继续看插件：它只是把多个业务函数组织成一个对象，依赖管理原则仍然一样。

## 参考资料

- [.NET 依赖注入](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection)
- [函数工具](https://learn.microsoft.com/en-us/agent-framework/agents/tools/function-tools)
