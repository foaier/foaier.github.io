---
title: "OpenAPI 工具：让 Agent 读懂一个明确的 HTTP 接口"
date: "2026-11-20"
summary: "把 OpenAPI 定义变成托管工具，区分接口描述和业务实现。"
series: "Agent Framework 进阶"
order: 41
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["foundry-models","agent-function-tools"]
goals: ["把 OpenAPI 定义变成托管工具，区分接口描述和业务实现。"]
---

已经有 Web API，不一定要为每个端点再手写一遍函数定义。OpenAPI 描述路径、参数和返回结构，托管工具可以据此调用服务。但定义文件只是说明书，真正的业务服务仍要运行，而且必须能被执行工具的云端访问。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。需要 Foundry 项目、支持相应工具的模型部署及权限，配置 FOUNDRY_PROJECT_ENDPOINT、FOUNDRY_MODEL_DEPLOYMENT，并 az login。工具可能产生独立服务费用。 准备一个云端可访问的只读课程 API，并把其 OpenAPI JSON 保存到本机，设置 OPENAPI_SPEC_FILE。示例使用匿名认证，仅适合公开的演示数据。

~~~powershell
dotnet run --project Integrations -- openapi
~~~

## 代码是怎样工作的

openapi 分支读取 JSON，通过 OpenApiFunctionDefinition 创建工具定义，再用 FoundryAITool.CreateOpenApiTool 转为 AITool。示例明确使用匿名认证。真实私有 API 应配置服务支持的连接或身份机制，不能把密钥直接写进公开定义文件。

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

问“查询AI入门课程”时，应在你的 API 日志中看到请求，再检查模型回答与返回值一致。本机 localhost 地址从云端通常不可达；因此前面的本机 McpServer 不能直接当成这个实验的云端目标。

## 自己改一次

先只暴露一个只读查询端点，给参数和返回字段写清说明。验证不存在的课程如何返回，再加入一个可选参数。每加一个操作都重新检查权限和含义，不要一次把整套管理 API 全部交给模型。

## 遇到问题先看这里

解析失败先验证 OpenAPI 文档格式与支持版本；执行失败查云端到目标服务的网络、认证和超时。返回二百也不表示业务成功，业务错误字段要让模型能够理解。涉及写入的操作还需额外审批和幂等设计。

## 参考资料

- [Foundry 工具](https://learn.microsoft.com/en-us/agent-framework/integrations/by-provider/microsoft-foundry)
- [Agent Service 工具](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/agent-services/foundry)
