---
title: "组合 Skills：让多个技能各司其职"
date: "2026-11-20"
summary: "同时加载文件式与类式技能，避免名称冲突和重复职责。"
series: "Agent Framework 进阶"
order: 21
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-skill-file","agent-skill-class"]
goals: ["同时加载文件式与类式技能，避免名称冲突和重复职责。"]
---

一个学习助手既要解释概念，也要安排计划，没必要把两套流程写成一大段提示词。可以让 explain-concept 专门讲概念，让 study-plan 专门安排练习，再由同一个 Agent 根据问题选择。组合的关键在于职责清楚，而不是技能越多越好。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- skill-combine
~~~

## 代码是怎样工作的

CombinedSkills 使用 AgentSkillsProviderBuilder。UseFileSkill 加载 skills 目录，UseSkill 加入 StudyPlanSkill，Build 得到同一个提供器。它们共享模型的上下文预算，也共享名字空间，因此重名和相近描述会给选择带来麻烦。下面的运行方法保持不变，变化只在提供器的构建。

```csharp
public static async Task RunWithSkills(AgentSkillsProvider provider, string question = "帮我安排30分钟的AI入门练习。")
    {
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        {
            Name = "StudyCoach", ChatOptions = new() { Instructions = "使用适合任务的技能，给出简短中文答案。" },
            AIContextProviders = [provider],
        });
        Console.WriteLine(await agent.RunAsync(question));
    }
```

~~~csharp
var provider = new AgentSkillsProviderBuilder()
    .UseFileSkill(Path.Combine(AppContext.BaseDirectory, "skills"))
    .UseSkill(new StudyPlanSkill())
    .Build();
await Lessons.RunWithSkills(provider);
~~~

## 怎样判断成功

分别提问“用生活例子解释RAG”和“安排三十分钟的学习计划”，检查是否遵守对应规则。第三次再提出组合请求，观察步骤顺序。模型可能没有按预期选技能，因此验收应保留输入、调用轨迹和输出，而不只是截一张成功回答。

## 自己改一次

故意给两个技能相同的描述，再改成明确职责，比较差异。最后删掉一个技能，确认程序能正常加载剩下的技能。这能暴露命名、目录扫描和隐藏依赖问题，也能帮助你决定哪项技能值得长期保留。

## 遇到问题先看这里

同名技能要在加载前修正，不能靠模型猜。技能过多时先缩小范围，再优化描述。需要严格保证“先查资料再生成”的业务流程，应使用普通程序或工作流约束执行次序，不能只依靠技能之间的文字约定。

## 参考资料

- [Agent Skills](https://learn.microsoft.com/en-us/agent-framework/agents/skills)
- [Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
