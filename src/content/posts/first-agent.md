---
title: "第一个 Agent：给模型一个明确的工作说明"
date: "2026-11-20"
summary: "运行一个真正使用 Agent Framework 的学习助手"
series: "Agent Framework 入门"
order: 1
tags: ["Agent Framework 入门","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-model-call"]
goals: ["运行一个真正使用 Agent Framework 的学习助手","分清模型客户端、Agent、指令和一次运行"]
---

上一课我们向模型发了一条问题。这一课把重复使用的工作说明交给 Agent：回答用中文、先举例子、信息不足时承认不知道。先做一件很小但完整的事，后面再逐步加工具和记忆。

## 这一次增加了什么

模型客户端负责把请求送到模型服务。Agent把指令、工具以及运行过程组织起来。AIAgent是框架里的统一抽象，我们的例子由通用聊天客户端创建一个 ChatClientAgent。它仍然需要底层模型提供推理能力。

不要因为名字里有Agent，就认为程序一定会自动规划、循环或操作电脑。没有配置的工具，它不会凭空拥有；没有传入的资料，它也不一定知道。先看这个对象实际接了什么，再判断它能做什么。

## 准备并运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载并解压[课程示例](/downloads/ai-course.zip)。在解压后的 ai-course 目录打开终端。本篇使用 .NET 10，核心包 Microsoft.Agents.AI 1.28.0；依赖版本已写在项目文件中。

```powershell
dotnet run --project Core -- agent
```

需要在线模型的练习，请先在当前终端设置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。不要把网页聊天产品的登录密码当作 API Key。模型调用会消耗所选服务的额度；本地模型则需要相应硬件和运行服务。

## 看完整项目，再看核心调用

Program.cs根据命令选择练习，CourseClient.cs读取模型配置。本篇的代码位于 Core/Lessons/FirstSteps.cs。下面这个方法就是 agent 命令执行的内容：

```csharp
public static async Task Agent()
{
    var agent = CourseClient.Agent("你是学习助手。用中文解释概念，每次给一个生活中的例子。不知道时明确说不知道。");
    Console.WriteLine(await agent.RunAsync("什么是机器学习？"));
}
```


CourseClient.Agent内部调用AsAIAgent，把中文指令、名称以及可选工具传给框架。name用于识别这个Agent，不会让模型自动知道你的项目。instructions定义长期使用的工作要求，RunAsync里的字符串则是这一次的具体问题。

这里没有给它任何查资料的工具，因此预期结果只是解释“机器学习”并举例。它没有真正创建课程、保存计划或读取你的文件。判断一个Agent的能力，应当同时看输出和真实的工具执行记录。

## 改一次指令，观察行为

先保留问题，把指令改成“面向小学生解释，避免专业术语”，运行一次。然后改成“面向后端开发者解释，给出一个业务分类例子”，再运行一次。比较解释角度如何变化，而不只是字数变化。

你可能发现模型没有完全遵守要求。这说明指令会影响输出，但不是一个硬性程序约束。对于必须满足的规则，比如金额不得超过上限，应用仍然需要自己校验。后面学结构化输出和工具调用时会继续处理。

## 让文字逐步出现

同一个项目还有 stream 命令，使用RunStreamingAsync逐个读取输出更新。把运行命令最后的agent换成stream即可。它让你更早看到内容，适合聊天界面，但不意味着整个任务能在进程关闭后继续执行。

网络中断时，已经显示的半句话不能当作完整成功结果。正式应用应该区分正在生成、完成和失败。本阶段先观察普通输出与流式输出的区别，不需要同时引入Web页面。

## 小练习与验收

把助手改成“只解释一个概念，每次最多三个要点”，分别问机器学习、向量和一个没有提供背景的内部项目名。检查前两次是否给出例子，最后一次是否说明信息不足。

如果只是更换问题就报错，先回到模型调用章节检查服务状态。如果编译报找不到类型，确认使用课程项目的依赖版本。完成后继续 [多轮会话](/articles/sessions-memory/)，亲自观察Agent如何使用上一轮的信息。

## 参考资料

- [创建第一个 Agent](https://learn.microsoft.com/en-us/agent-framework/get-started/your-first-agent)
- [Agent 运行与接口](https://learn.microsoft.com/en-us/agent-framework/concepts/agents/running-agents)
