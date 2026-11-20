---
title: "Foundry 入门：认清项目端点、部署名和登录身份"
date: "2026-11-20"
summary: "使用 AIProjectClient 完成最小调用，区分项目、模型和 Agent 资源。"
series: "Agent Framework 进阶"
order: 7
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-agent"]
goals: ["使用 AIProjectClient 完成最小调用，区分项目、模型和 Agent 资源。"]
---

Foundry 页面上有项目、部署、Agent 和模型，第一次看很容易把几个名称填反。先把它想成工作空间：项目是空间，模型部署是空间里可调用的能力，Agent 定义是你保存的一套行为配置。它们的地址和名称不能互相替代。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。准备 Foundry 项目与模型部署，执行 az login，设置 FOUNDRY_PROJECT_ENDPOINT、FOUNDRY_MODEL_DEPLOYMENT。操作需要相应资源角色并可能产生费用；请使用专用实验项目。

~~~powershell
dotnet run --project Integrations -- foundry
~~~

## 代码是怎样工作的

Project 方法通过项目端点和 AzureCliCredential 创建 AIProjectClient。本篇直接 AsAIAgent(model: 部署名)，没有先创建一个长期保存的 Agent 版本。登录身份说明“你是谁”，资源角色说明“允许做什么”；登录成功后仍可能没有项目权限。

```csharp
public static async Task Chat()
    {
        var agent = Project().AsAIAgent(model: CourseClient.Required("FOUNDRY_MODEL_DEPLOYMENT"),
            name: "StudyCoach", instructions: "向初学者解释AI，每次一个例子。");
        Console.WriteLine(await agent.RunAsync("什么是向量搜索？"));
    }
```



## 怎样判断成功

输入“什么是向量搜索”应得到解释。这个结果只证明本次模型调用成功。下一篇会创建具名 Agent 版本，再用名字读取已有资源，两种生命周期不要混淆。课程使用 Foundry 预览包，项目文件记录了完整版本号。

## 自己改一次

在控制台找到自己的项目端点和部署名，逐个对照环境变量。再用一个不存在的部署名运行，观察模型配置错误；恢复正确值后验证。理解错误来源比记住某个截图中的默认名称更可靠。

## 遇到问题先看这里

不要把资源管理页面 URL 或普通 OpenAI /v1 地址填进项目端点。四零三检查角色、租户和登录账号。包升级后命名空间和管理 API 可能变化，请先看版本变化再改代码，不能只在旧示例上不断补 using。

## 参考资料

- [Foundry 提供方](https://learn.microsoft.com/en-us/agent-framework/integrations/by-provider/microsoft-foundry)
- [Foundry 文档](https://learn.microsoft.com/en-us/azure/foundry/)
