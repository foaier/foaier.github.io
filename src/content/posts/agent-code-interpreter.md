---
title: "Code Interpreter：让工具真正计算，再检查结果"
date: "2026-11-20"
summary: "调用托管代码解释器，区分模型口算与实际代码执行。"
series: "Agent Framework 进阶"
order: 38
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["foundry-models","agent-function-tools"]
goals: ["调用托管代码解释器，区分模型口算与实际代码执行。"]
---

模型能写出一段 Python，不代表它运行过。Code Interpreter 在服务提供的执行环境里计算，可以辅助数据分析和文件处理。我们从三个数的平均数开始，先让执行证据清楚，再考虑上传表格或生成图表。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。需要 Foundry 项目、支持相应工具的模型部署及权限，配置 FOUNDRY_PROJECT_ENDPOINT、FOUNDRY_MODEL_DEPLOYMENT，并 az login。工具可能产生独立服务费用。

~~~powershell
dotnet run --project Integrations -- code-interpreter
~~~

## 代码是怎样工作的

HostedTool 的 code-interpreter 分支创建自动容器配置，再交给 FoundryAITool.CreateCodeInterpreterTool。模型收到“用代码计算12、18、24的平均数”后可以调用托管工具。代码运行在服务端容器，不是你本机的 PowerShell，也不能自动访问本机文件。

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

正确平均数是18，但只得到18还不够。检查响应或服务运行记录中是否真的发生代码执行。模型不用工具也会算这个简单题，因此要把“答案正确”和“工具路径已验证”分开验收。

## 自己改一次

把数字改成一个容易人工校验的小列表，比较直接计算与工具计算。下一步再使用虚构 CSV，确认文件上传位置和容器可见范围。不要直接拿真实业务表格当第一个实验。

## 遇到问题先看这里

工具不可用可能是模型、区域或项目配置限制。自动容器有自己的生命周期，后续请求不一定保留上次文件。容器隔离不意味着结果永远正确，计算代码、单位和数据清洗规则仍要检查。

## 参考资料

- [Foundry 工具](https://learn.microsoft.com/en-us/agent-framework/integrations/by-provider/microsoft-foundry)
- [Agent Service 工具](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/agent-services/foundry)
