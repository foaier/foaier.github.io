---
title: "文件式 Skill：把一套做事方法写进 SKILL.md"
date: "2026-11-20"
summary: "建立一个文件式技能，理解技能说明和可调用工具的区别。"
series: "Agent Framework 进阶"
order: 18
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-function-tools"]
goals: ["建立一个文件式技能，理解技能说明和可调用工具的区别。"]
---

你教一个新人写学习笔记，可能会给他一张纸：先用生活例子说明，再列关键术语，最后布置一个小实验。Skill 就像这张可重复使用的工作说明。模型先看到技能的名称和用途，需要时再读取详细内容。它不会因为目录里多了一个文件，就突然获得访问数据库的权限。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- skill-file
~~~

## 代码是怎样工作的

示例在 Core/skills/explain-concept/SKILL.md 放好说明，并由项目文件复制到输出目录。FileSkill 用 AppContext.BaseDirectory 找到运行目录中的 skills，然后交给 AgentSkillsProvider。RunWithSkills 把这个提供器挂到 AIContextProviders；这样每次运行时，技能信息才有机会进入模型上下文。下面先看公共运行方法，再看实际文件。

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


```markdown
---
name: explain-concept
description: 向第一次接触 AI 的读者解释一个技术概念，适合入门学习和复习。
---

先给一个日常例子，再介绍准确术语。
说明例子与真实系统不完全相同的地方。
最后给一个能在浏览器里完成的小练习，不假设读者会编程。
```


## 怎样判断成功

FileSkill 传入的问题是“请用生活例子解释RAG，再给一个小练习”。运行后应得到概念解释和练习。仅仅看到格式相似的答案，还不能证明技能被读取；验证时把技能中的“先举例”临时改成一个明显要求，例如“每步都附一个观察点”，再比较多次输出。需要严格确认时查看工具调用记录。

## 自己改一次

把文件里的主题改成“解释向量搜索”，保留名称、描述和正文三部分。再问一个完全无关的问题，观察模型是否仍机械套用技能。这个实验能帮助你改进 description：描述应说明适用任务，而不是声称“什么都能做”。

## 遇到问题先看这里

找不到技能时先检查输出目录里有没有文件，别只看源码目录。YAML 头部缩进或分隔符不正确，也可能导致加载失败。技能中的脚本不会因被提到就自动拥有执行器；需要执行代码时仍要显式提供工具。多人应用还应避免把所有用户的技能目录混在一起。

## 参考资料

- [Agent Skills](https://learn.microsoft.com/en-us/agent-framework/agents/skills)
- [Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
