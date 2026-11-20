---
title: "类式 Skill：把一项稳定能力封装成 C# 类型"
date: "2026-11-20"
summary: "用 AgentClassSkill 封装技能，并看懂元数据与正文的职责。"
series: "Agent Framework 进阶"
order: 20
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-function-tools"]
goals: ["用 AgentClassSkill 封装技能，并看懂元数据与正文的职责。"]
---

当技能开始被多个地方使用，散落在调用处的字符串会越来越难维护。类式 Skill 适合把这套说明封装为一个有名字的类型。这里先做最小版本：只有清晰的说明和步骤，不一开始就接数据库。等结构看明白，再在下一篇引入依赖注入。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- skill-class
~~~

## 代码是怎样工作的

StudyPlanSkill 继承 AgentClassSkill<StudyPlanSkill>。Frontmatter 提供名称和描述，Instructions 提供执行方法。ClassSkill 创建这个实例并加入 AgentSkillsProvider。类名面向程序员，技能名称和描述面向模型，两者不必长得一样，但都应该能让人判断职责。

```csharp
public sealed class StudyPlanSkill : AgentClassSkill<StudyPlanSkill>
{
    public override AgentSkillFrontmatter Frontmatter { get; } = new("study-plan", "为AI初学者安排短时学习计划");
    protected override string Instructions => "把学习拆成三个动作：阅读一个例子、修改一个输入、解释一个结果。每个动作10分钟。";
}
```



## 怎样判断成功

运行 skill-class 后，模型应给出阅读例子、修改输入、解释结果三个动作，并给每步安排时间。你可以对比文件式与代码式的结果：表达不同是正常的，真正要检查的是有没有遵守同一套方法。此示例没有注册真实业务操作。

## 自己改一次

在类中把“每步十分钟”改为“每步五分钟”，重新编译运行。然后尝试把技能描述改得过于宽泛，观察选择效果。这个小实验会让你意识到，封装成类提升的是工程组织能力，模型能否选对技能还依赖清楚的描述和任务上下文。

## 遇到问题先看这里

类型参数写错、覆盖属性名称沿用旧教程，都会导致编译错误。请使用下载项目固定的版本，不要把旧版构造函数直接搬过来。实例包含可变状态时还要考虑并发；不要把某个用户的聊天记录存进全局共享 Skill 的字段。

## 参考资料

- [Agent Skills](https://learn.microsoft.com/en-us/agent-framework/agents/skills)
- [Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
