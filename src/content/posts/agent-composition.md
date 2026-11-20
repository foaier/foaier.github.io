---
title: "Agent 也能成为工具：组合一个讲解员和学习教练"
date: "2026-11-20"
summary: "用 AsAIFunction 把子 Agent 作为工具，理解嵌套调用成本。"
series: "Agent Framework 进阶"
order: 31
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-function-tools"]
goals: ["用 AsAIFunction 把子 Agent 作为工具，理解嵌套调用成本。"]
---

学习教练负责理解你的目标，RAG 讲解员专门把检索过程说清楚。你可以让教练在需要时请讲解员帮忙，再把结果整理成练习。这是同一程序里的 Agent 组合，不需要先引入网络协议，也不等于每个任务都该拆很多角色。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- nested-agent
~~~

## 代码是怎样工作的

specialist 有独立名称、描述和指令。AsAIFunction 把它包装成父 Agent 可以调用的工具；父 Agent 通过工具机制把问题传进去，再接收子 Agent 的文字结果。父子仍会分别调用模型，不能把它当成免费的普通函数。

```csharp
public static async Task NestedAgent()
    {
        using var client = CourseClient.Create();
        var specialist = client.AsAIAgent(name: "explain_rag", description: "解释RAG的工作步骤",
            instructions: "只解释RAG，用检索、证据、生成三个步骤说明。");
        var parent = client.AsAIAgent(name: "study_coach", instructions: "涉及RAG时调用专家工具，再给初学者一个练习。",
            tools: [specialist.AsAIFunction()]);
        Console.WriteLine(await parent.RunAsync("我想学RAG，给我一个解释和练习。"));
    }
```



## 怎样判断成功

应看到包含 RAG 解释和练习的回答。要确认子 Agent 被使用，需要观察工具调用或追踪，不能只读最终文字。两个角色使用同一个底层模型客户端，也不意味着它们共享所有 Session 状态。

## 自己改一次

先把子 Agent 的描述改得明确，再故意改得含糊，比较父 Agent 是否选对工具。然后给子 Agent 添加一个“资料不足就说明”的要求，观察父 Agent 有没有保留不确定性，而不是把它改写成确定事实。

## 遇到问题先看这里

嵌套调用容易造成成本和延迟增长，先限制角色数量与调用深度。父子互相把对方作为工具还可能形成循环；不要建立这种无停止条件的结构。需要固定执行顺序时，后面的工作流比自由工具选择更合适。

## 参考资料

- [Agent 工具](https://learn.microsoft.com/en-us/agent-framework/agents/tools/function-tools)
- [工作流](https://learn.microsoft.com/en-us/agent-framework/workflows/overview)
