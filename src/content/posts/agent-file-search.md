---
title: "托管 File Search：上传资料之后，验证检索和引用"
date: "2026-11-20"
summary: "连接已准备好的文件索引，验证回答是否来自正确资料。"
series: "Agent Framework 进阶"
order: 39
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["foundry-models","agent-function-tools"]
goals: ["连接已准备好的文件索引，验证回答是否来自正确资料。"]
---

把文件交给托管搜索服务，可以少写一些切分和索引代码。但上传完成、索引可用、检索命中、答案正确，仍然是四个不同状态。我们准备一份只有几条课程规则的小文档，故意加入一个普通模型不知道的课程代号。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。需要 Foundry 项目、支持相应工具的模型部署及权限，配置 FOUNDRY_PROJECT_ENDPOINT、FOUNDRY_MODEL_DEPLOYMENT，并 az login。工具可能产生独立服务费用。 先在服务端创建专用向量存储并上传一份自己的课程说明，等待处理完成，设置 FOUNDRY_VECTOR_STORE_ID。

~~~powershell
dotnet run --project Integrations -- file-search
~~~

## 代码是怎样工作的

file-search 分支把已有向量存储 ID 传入 CreateFileSearchTool。Agent 收到工具配置后，可在回答前检索文件。程序没有自动上传文件或创建索引，准备步骤需要在当前服务控制台或官方文件 API 中完成，避免运行示例时悄悄生成一批资源。

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

对文档里的问题应能找到依据，对未出现的问题应说明资料不足。检查来源和引用是否指向实际上传内容。即使引用存在，也要确认它支持当前结论，而不是只与问题主题相关。

## 自己改一次

在课程说明里添加一个虚构代号及定义，等索引更新后再查询。随后修改定义，观察更新延迟和旧版本是否仍被检索到。这个实验比只问“什么是RAG”更能证明模型用了你的文件。

## 遇到问题先看这里

检索为空先查索引处理状态、存储 ID 和项目范围，再考虑改提示词。托管索引不会自动实现你的业务访问权限；多租户要在资源设计和查询范围中隔离。删除原文件后，还要确认索引中的副本如何清理。

## 参考资料

- [Foundry 工具](https://learn.microsoft.com/en-us/agent-framework/integrations/by-provider/microsoft-foundry)
- [Agent Service 工具](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/agent-services/foundry)
