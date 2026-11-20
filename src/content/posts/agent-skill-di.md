---
title: "给 Skill 接入 DI：规则由服务提供，生命周期由容器管理"
date: "2026-11-20"
summary: "把业务规则服务注入类式技能，理解共享配置与用户状态的边界。"
series: "Agent Framework 进阶"
order: 22
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-skill-class","agent-dependency-injection"]
goals: ["把业务规则服务注入类式技能，理解共享配置与用户状态的边界。"]
---

如果每个技能都自己 new 一个规则服务，测试时不好替换，配置变更也容易漏改。依赖注入可以把“技能如何讲解”和“规则从哪里来”分开。我们用一个很小的 StudyRules 服务演示，不需要数据库，也不需要提前理解大型架构。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- skill-di
~~~

## 代码是怎样工作的

容器注册 StudyRules 和 ConfiguredStudySkill。解析技能时，容器把规则服务传给构造函数；Instructions 再从服务读取说明。这里服务只有固定规则，所以用 Singleton。技能用 Transient，每次解析获得新实例。若以后读取租户配置或数据库，应该重新考虑作用域，不能照抄单例。

```csharp
public static async Task SkillDi()
    {
        var services = new ServiceCollection();
        services.AddSingleton<StudyRules>();
        services.AddTransient<ConfiguredStudySkill>();
        using var container = services.BuildServiceProvider(validateScopes: true);
        using var scope = container.CreateScope();
        var skill = scope.ServiceProvider.GetRequiredService<ConfiguredStudySkill>();
        await RunWithSkills(new AgentSkillsProvider(skill));
    }
```


```csharp
public sealed class ConfiguredStudySkill(StudyRules rules) : AgentClassSkill<ConfiguredStudySkill>
{
    public override AgentSkillFrontmatter Frontmatter { get; } = new("configured-plan", "根据课程规则安排学习计划");
    protected override string Instructions => rules.Instructions;
}
```


## 怎样判断成功

运行后得到根据 StudyRules 编排的学习计划。检查代码时应能明确指出：Agent 负责模型交互，Skill 负责方法说明，StudyRules 负责课程规则，容器负责构造和释放。四者职责不再混在一个长方法里。

## 自己改一次

把 StudyRules 的规则改成适合 Java 学习者的版本，技能类和 Agent 调用部分保持不变。再思考如何用一个测试实现提供固定规则。你不必立刻写接口，但应能解释替换点在哪里，避免为了 DI 增加一堆没有实际用途的抽象。

## 遇到问题先看这里

作用域已释放通常意味着把请求中的对象带到了后台。此示例在同一个 scope 内完成调用。真实后台任务应建立自己的 scope。不要在 Instructions getter 中同步等待慢速网络请求；先异步读取配置，再把已准备好的规则交给技能。

## 参考资料

- [Agent Skills](https://learn.microsoft.com/en-us/agent-framework/agents/skills)
- [Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
