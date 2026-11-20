---
title: "读取已有 Foundry Agent：把创建和使用分开"
date: "2026-11-20"
summary: "通过管理 API 获取已有 Agent，再转换成统一调用接口。"
series: "Agent Framework 进阶"
order: 9
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-foundry-persistent"]
goals: ["通过管理 API 获取已有 Agent，再转换成统一调用接口。"]
---

应用启动一次就创建一个新 Agent，会让版本和资源越来越难追踪。完成创建实验后，更常见的运行路径是：知道自己要用哪个定义，读取它，然后开始一次会话。本篇保留这条最小路径，让创建与使用的职责分开。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。准备 Foundry 项目与模型部署，执行 az login，设置 FOUNDRY_PROJECT_ENDPOINT、FOUNDRY_MODEL_DEPLOYMENT。操作需要相应资源角色并可能产生费用；请使用专用实验项目。 设置上一课创建的 FOUNDRY_AGENT_NAME。

~~~powershell
dotnet run --project Integrations -- foundry-existing
~~~

## 代码是怎样工作的

Administration().GetAgentAsync 按名称读取资源，Project().AsAIAgent(existing.Value) 形成可调用对象。这里取的是该资源当前定义；如果业务要求固定某个版本，应使用服务支持的版本查询并保存准确标识。不要把“按名字读取”写成“永远锁定同一个版本”。

```csharp
public static async Task Existing()
    {
        var project = Project();
        var existing = await Administration().GetAgentAsync(CourseClient.Required("FOUNDRY_AGENT_NAME"));
        var agent = project.AsAIAgent(existing.Value);
        Console.WriteLine(await agent.RunAsync("用一个例子解释RAG。"));
    }
```



## 怎样判断成功

已有名称应直接进入问答，控制台不再要求 create。去服务端比较运行前后的版本列表，确认这条代码没有创建版本。模型的措辞仍可变化；定义可复用不等于输出逐字一致。

## 自己改一次

用两个终端分别运行同一名称，思考两次调用是否应该共享聊天上下文。答案取决于你传入的会话状态，而不是 Agent 名称相同。继续学习 Session 章节，把 Agent 定义、会话和业务任务 ID 画成三栏对照。

## 遇到问题先看这里

找不到 Agent 时先确认项目和名称，不要自动转成创建。没有权限时区分读取定义与调用模型的权限。正式发布记录定义版本、模型部署和提示词版本，出现回归后才知道应回滚哪一项。

## 参考资料

- [Foundry Agent](https://learn.microsoft.com/en-us/agent-framework/integrations/by-provider/microsoft-foundry)
- [会话管理](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/session)
