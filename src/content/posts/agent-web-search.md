---
title: "Web Search：让答案带来源，再自己核对"
date: "2026-11-20"
summary: "使用托管网页搜索，区分搜索结果、发布时间和可靠结论。"
series: "Agent Framework 进阶"
order: 40
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["foundry-models","agent-function-tools"]
goals: ["使用托管网页搜索，区分搜索结果、发布时间和可靠结论。"]
---

模型的知识可能过时，网页搜索能补充当前资料。但“网上搜到”不等于“已经证实”。本篇让 Agent 查官方说明，要求来源和日期，然后由我们打开来源核对。先练会验证，再让它总结更多网页。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。需要 Foundry 项目、支持相应工具的模型部署及权限，配置 FOUNDRY_PROJECT_ENDPOINT、FOUNDRY_MODEL_DEPLOYMENT，并 az login。工具可能产生独立服务费用。

~~~powershell
dotnet run --project Integrations -- web-search
~~~

## 代码是怎样工作的

web-search 分支创建 CreateWebSearchTool，并传给 Foundry Agent。工具由服务端执行，应用不需要自己抓网页。提示词要求列出来源与发布日期，不过网页未标日期时应说明未知，不能让模型为了填满字段编造时间。

```csharp
public static async Task HostedTool(string kind)
    {
#pragma warning disable OPENAI001
        AITool tool = kind switch
        {
            "web-search" => FoundryAITool.CreateWebSearchTool(),
            "file-search" => FoundryAITool.CreateFileSearchTool([CourseClient.Required("FOUNDRY_VECTOR_STORE_ID")]),
            "code-interpreter" => FoundryAITool.CreateCodeInterpreterTool(
                new CodeInterpreterToolContainer(CodeInterpreterToolContainerConfiguration.CreateAutomaticContainerConfiguration())),
            "openapi" => FoundryAITool.CreateOpenApiTool(new OpenApiFunctionDefinition("course_catalog",
                BinaryData.FromString(await File.ReadAllTextAsync(CourseClient.Required("OPENAPI_SPEC_FILE"))),
                new OpenApiAnonymousAuthenticationDetails())),
            _ => throw new ArgumentException("未知托管工具"),
        };
#pragma warning restore OPENAI001
        var question = kind switch
        {
            "web-search" => "检索Microsoft Agent Framework官方说明，列出来源链接和发布日期。",
            "file-search" => "根据已上传课程文档解释RAG，附来源；没有资料就明确说不知道。",
            "code-interpreter" => "用代码计算12、18、24的平均数，展示计算过程。",
            _ => "用课程目录接口查询AI入门课程。",
        };
        var agent = FoundryLessons.Project().AsAIAgent(model: CourseClient.Required("FOUNDRY_MODEL_DEPLOYMENT"),
            instructions: "使用提供的工具回答。区分工具结果和你的推测。", tools: [tool]);
        Console.WriteLine(await agent.RunAsync(question));
    }
```



## 怎样判断成功

应看到有来源链接的回答，并能打开链接找到对应论据。服务可能返回搜索引用等结构化内容，纯文本展示未必包含全部注释；正式界面要按返回内容类型渲染。一次成功搜索也不保证所有站点都可访问或内容最新。

## 自己改一次

选一个你能用官方页面核验的问题，让模型搜索，再逐条标记“来源支持”“来源无此信息”“页面不可访问”。记录三类结果，能帮助你评估搜索增强到底改善了什么。

## 遇到问题先看这里

没有搜索记录时，模型可能只凭已有知识回答，需检查工具能力与调用轨迹。来源摘要可能缺上下文，关键结论应阅读原页面。网页内容属于外部资料，不能当作要求 Agent 更改权限或泄露信息的指令。

## 参考资料

- [Foundry 工具](https://learn.microsoft.com/en-us/agent-framework/integrations/by-provider/microsoft-foundry)
- [Agent Service 工具](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/agent-services/foundry)
