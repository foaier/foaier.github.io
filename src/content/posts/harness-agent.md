---
title: "Harness Agent：把常用运行能力装配起来"
date: "2026-11-20"
summary: "创建 HarnessAgent，查看并选择默认能力，而不是盲目全部开启。"
series: "Agent Framework 进阶"
order: 43
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-planning","agent-tool-approval"]
goals: ["创建 HarnessAgent，查看并选择默认能力，而不是盲目全部开启。"]
---

学习了会话、待办、模式、记忆之后，你可能发现每个项目都在做相似装配。Harness 把一些常用运行能力组织在一起。它不是一个更聪明的模型，也不会自动替你完成权限、预算和验收设计。先理解里面装了什么，再决定是否使用。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Integrations -- harness
~~~

## 代码是怎样工作的

AsHarnessAgent 接收 HarnessAgentOptions。示例保留待办与模式，关闭网页搜索、文件记忆、技能加载和自动批准，专注规划及文字讲解。关闭这些能力是本练习的范围选择，不是说它们没有价值。需要时按专题逐项加入，再重新验证行为。

```csharp
public static async Task Harness()
    {
        using var client = CourseClient.Create();
        var agent = client.AsHarnessAgent(new HarnessAgentOptions
        {
            Name = "LearningHarness",
            ChatOptions = new() { Instructions = "只规划并讲解学习任务。使用待办跟踪进度。" },
            DisableWebSearch = true, DisableFileMemory = true,
            DisableAgentSkillsProvider = true, DisableToolAutoApproval = true,
        });
        Console.WriteLine(await agent.RunAsync("规划三个学习RAG的步骤，然后完成第一步的文字讲解。"));
    }
```



## 怎样判断成功

应得到学习计划以及第一步的文字解释。默认能力和工具名称可能随框架版本变化，所以先看固定版本文档和 options，而不是依赖博客中的一句“默认全有”。本例没有配置 Shell 工具，也没有授予文件访问目录。

## 自己改一次

对照上一课手工装配的 Agent，列出 Harness 替你提供了哪些运行部件。再挑一项确实需要的能力，查清配置后开启，并设计一个成功和一个失败案例。不要一次加十项能力再猜哪里出了错。

## 遇到问题先看这里

出现额外工具请求时先查看默认配置，不要马上自动批准。上下文整理和循环都需要边界，长任务仍然可能中断。需要恢复时保存实际状态与继续标识；仅把同一句任务再次发给 Harness，并不等于从原位置恢复。

## 参考资料

- [Harness Agent](https://learn.microsoft.com/en-us/agent-framework/concepts/harness)
- [工具批准](https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval)
