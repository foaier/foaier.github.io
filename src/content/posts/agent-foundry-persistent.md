---
title: "持久化 Foundry Agent：创建一个具名版本"
date: "2026-11-20"
summary: "创建云端 Agent 版本，理解定义持久化与会话持久化的差别。"
series: "Agent Framework 进阶"
order: 8
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["foundry-models"]
goals: ["创建云端 Agent 版本，理解定义持久化与会话持久化的差别。"]
---

本地每次 new 一个 Agent，程序退出后这个对象就没了。如果希望团队用同一个具名定义，可以在 Foundry 保存 Agent 版本。保存的重点是名称、模型和指令等定义，不能因此推断所有聊天记录和业务状态都会自动恢复。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。准备 Foundry 项目与模型部署，执行 az login，设置 FOUNDRY_PROJECT_ENDPOINT、FOUNDRY_MODEL_DEPLOYMENT。操作需要相应资源角色并可能产生费用；请使用专用实验项目。 另设 FOUNDRY_AGENT_NAME，例如 foaier-study-demo。

~~~powershell
dotnet run --project Integrations -- foundry-create
~~~

## 代码是怎样工作的

示例先要求输入 create，再用 AgentAdministrationClient 创建 ProjectsAgentVersionCreationOptions。definition 中指定模型和教学指令，CreateAgentVersionAsync 返回版本信息，然后 project.AsAIAgent(created.Value) 调用它。管理客户端和运行客户端职责不同，这是当前 SDK 与部分旧示例的明显差别。

```csharp
public static async Task Create()
    {
        var name = CourseClient.Required("FOUNDRY_AGENT_NAME");
        Console.Write($"将在Foundry创建 {name} 的一个新版本，输入 create 继续：");
        if (Console.ReadLine() != "create") return;
        var project = Project();
        var definition = ProjectsAgentDefinition.CreatePromptAgentDefinition(CourseClient.Required("FOUNDRY_MODEL_DEPLOYMENT"));
        definition.Instructions = "你是中文AI学习助手。每次给一个例子。";
        var created = await Administration().CreateAgentVersionAsync(name, new ProjectsAgentVersionCreationOptions(definition));
        var agent = project.AsAIAgent(created.Value);
        Console.WriteLine($"已创建版本：{created.Value.Name}:{created.Value.Version}");
        Console.WriteLine(await agent.RunAsync("解释训练和推理的区别。"));
    }
```



## 怎样判断成功

控制台应打印创建的名字和版本，并完成一次问答。到 Foundry 检查是否真的存在对应版本。重复运行可能创建新版本，因此不要把创建动作放进每次 HTTP 请求里。部署时创建、运行时读取，往往更容易管理。

## 自己改一次

修改一条教学指令，再创建新版本，记录两个版本的差异。接着进入下一篇学习读取已有 Agent。测试结束后，在控制台确认并清理实验资源；清理之前检查没有其他应用仍然依赖它。

## 遇到问题先看这里

同名资源规则、权限和区域支持要按当前服务核对。云端返回成功后本地输出失败，并不代表创建没有发生；重试前先查询资源，避免不断生成版本。不要把管理权限和普通调用权限混用在所有服务账号上。

## 参考资料

- [Foundry Agent](https://learn.microsoft.com/en-us/agent-framework/integrations/by-provider/microsoft-foundry)
- [Agent Service](https://learn.microsoft.com/en-us/azure/foundry/agents/overview)
