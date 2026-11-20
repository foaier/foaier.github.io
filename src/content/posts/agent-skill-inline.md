---
title: "代码式 Skill：在 C# 里定义指令和参考资料"
date: "2026-11-20"
summary: "用 AgentInlineSkill 定义一个可复用的学习计划技能。"
series: "Agent Framework 进阶"
order: 19
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-function-tools"]
goals: ["用 AgentInlineSkill 定义一个可复用的学习计划技能。"]
---

有些技能不是编辑一个固定文件，而是由程序配置产生。例如不同课程有不同课时限制，你希望发布程序时一起维护这些规则。代码式 Skill 让名称、说明、正文和附带资源留在 C# 里。它仍然是一份给模型使用的方法说明，不等于直接执行的业务函数。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- skill-inline
~~~

## 代码是怎样工作的

CreateInlineSkill 创建 study-plan 技能，再通过 AddResource 加入 plan-rule。正文要求先读取规则，再安排练习。InlineSkill 把它装进 AgentSkillsProvider，后续运行方法与文件式相同。把“如何做”放在 Instructions，把较长的补充知识放在资源中，可以避免每次都把全部资料塞进开场提示词。

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
var skill = new AgentInlineSkill("study-plan", "安排短时AI学习计划",
    "先读取 plan-rule，再安排三步练习。")
    .AddResource("plan-rule", "总时长不超过30分钟，每步写出可观察的结果。");
~~~

## 怎样判断成功

输出应包含可执行的学习动作和时间安排。资源是否真正被读取，应通过调用记录或改变规则后的对照实验确认。不要把“用了三段列表”当作唯一依据；普通模型没有 Skill 时也会写列表。

## 自己改一次

把规则改成十五分钟，比较方案是否同步缩短。再把问题换成“解释 token”，观察技能选择是否合理。若一个技能涵盖所有问题，就拆小描述，让它只负责学习计划，其余讲解交给另一个技能。

## 遇到问题先看这里

模型忽略资源时，先检查正文是否明确说明什么时候需要它，再检查模型是否支持工具调用。不要在资源字符串里拼接 API Key。由用户输入生成的资源属于资料，不应覆盖系统规则；配置值也需要长度限制和审查。

## 参考资料

- [Agent Skills](https://learn.microsoft.com/en-us/agent-framework/agents/skills)
- [Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
