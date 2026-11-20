---
title: "Todo 与模式：让 Agent 先列计划，再说明进度"
date: "2026-11-20"
summary: "组合 TodoProvider 和 AgentModeProvider，分清计划状态与执行结果。"
series: "Agent Framework 进阶"
order: 42
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-function-tools"]
goals: ["组合 TodoProvider 和 AgentModeProvider，分清计划状态与执行结果。"]
---

模型说“第一步完成了”，不代表真的做了第一步。TodoProvider 能帮助记录待办，AgentModeProvider 能表达规划与执行模式，但实际动作有没有成功，仍要看工具结果和业务状态。我们用学习计划做练习，不让它操作外部系统。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- plan
~~~

## 代码是怎样工作的

两个提供器放进 AIContextProviders，模型得到维护待办和模式的能力。提示词要求只规划学习步骤，用户请求明确停在计划阶段。待办由工具维护，所以它比纯文字列表更适合追踪，但工具标记完成也不自动成为事实证明。

```csharp
public static async Task Plan()
    {
        using var todos = new TodoProvider();
        using var modes = new AgentModeProvider();
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        {
            Name = "Planner",
            ChatOptions = new() { Instructions = "只规划学习步骤，不执行外部操作。用待办工具记录三步计划。" },
            AIContextProviders = [todos, modes],
        });
        Console.WriteLine(await agent.RunAsync("帮我规划半小时的RAG学习，停在计划阶段。"));
    }
```



## 怎样判断成功

应得到三步计划，且不会执行外部动作。检查工具轨迹可确认是否创建待办。模式指令能帮助交互，但重要权限必须由应用在工具入口校验；不能仅凭 plan 这个字符串阻止一切副作用。

## 自己改一次

先要求只规划，再明确让它完成“解释RAG”这项文字任务。比较任务状态如何变化。若它把“搭建数据库”也标为已完成，指出缺少执行证据，思考怎样由代码验收真实动作后再改变状态。

## 遇到问题先看这里

把同一个提供器中的用户状态全局共享，可能导致任务列表串线。要按会话和业务范围管理状态。不要为了让模型“更自主”删掉所有确认与预算；长任务尤其需要能解释暂停、失败和未完成项。

## 参考资料

- [规划与待办](https://learn.microsoft.com/en-us/agent-framework/agents/planning-and-todos)
- [Harness](https://learn.microsoft.com/en-us/agent-framework/concepts/harness)
