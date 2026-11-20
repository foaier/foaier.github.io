---
title: "第一次调用大模型：地址、模型名和密钥分别填哪里"
date: "2026-11-20"
summary: "配置一次真实模型请求并解释返回结果"
series: "AI 编程起步"
order: 3
tags: ["AI 编程起步","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["csharp-ai-essentials","llm-tokens-context"]
goals: ["配置一次真实模型请求并解释返回结果","区分认证失败、地址错误、限流与模型能力不支持"]
---

上一课的学习计划由固定规则生成。这一次把问题真正发给模型。我们先使用支持 OpenAI Chat Completions 接口的服务；这是一种接口约定，并不表示所有服务商的所有功能都完全一样。

## 先取得三个真实值

登录你选定服务商的开发者平台，创建可调用模型的 API Key，找到接口基础地址和当前账号可用的模型标识。三个值要来自同一个服务配置。把别家的密钥与一个看起来像的地址拼在一起，通常只会得到认证错误。

如果使用 OpenAI，基础地址是 `https://api.openai.com/v1`；其他兼容服务请使用它自己的官方地址。模型标识也应从当前可用列表取得，不要把产品展示名或本教程里的占位文字原样填进去。Azure 的项目级接入另有独立章节。

## 在当前终端设置变量

Windows PowerShell 可以这样设置，把尖括号中的内容替换成自己的值。只对当前终端及它启动的子进程生效；关闭窗口后，需要重新设置。

```powershell
$env:AI_ENDPOINT = "https://api.openai.com/v1"
$env:AI_MODEL = "<你的模型标识>"
$env:AI_API_KEY = "<你的API密钥>"
dotnet run --project Core -- chat
```

macOS 和 Linux 在终端中使用 export AI_ENDPOINT="..."、export AI_MODEL="..."、export AI_API_KEY="..."，然后执行相同的 dotnet run 命令。不要把密钥提交进 Git。终端历史也可能保存输入，真实项目可以使用秘密管理工具。

## 这几行代码实际做了什么

课程示例的 CourseClient.Create 负责读取配置并建立客户端。完整实现如下，项目文件已经包含所需依赖：

```csharp
using System.ClientModel;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using OpenAI;

namespace AiCourse;

public static class CourseClient
{
    public static IChatClient Create()
    {
        var key = Required("AI_API_KEY");
        var model = Required("AI_MODEL");
        var endpoint = Environment.GetEnvironmentVariable("AI_ENDPOINT") ?? "https://api.openai.com/v1";
        var uri = new Uri(endpoint);
        if (uri.Scheme != "https" && !(uri.Scheme == "http" && uri.IsLoopback))
            throw new InvalidOperationException("模型地址应使用 HTTPS；本机实验可以使用 HTTP。 ");
        return new OpenAIClient(new ApiKeyCredential(key), new OpenAIClientOptions { Endpoint = uri })
            .GetChatClient(model).AsIChatClient();
    }

    public static AIAgent Agent(string instructions, params AITool[] tools) =>
        Create().AsAIAgent(instructions: instructions, name: "StudyAssistant", tools: tools);

    public static string Required(string name) => Environment.GetEnvironmentVariable(name)
        is { Length: > 0 } value ? value : throw new InvalidOperationException($"请先设置环境变量 {name}，见环境准备章节。");

    public static string StateFile(string name)
    {
        var directory = Path.Combine(Directory.GetCurrentDirectory(), ".state");
        Directory.CreateDirectory(directory);
        return Path.Combine(directory, name);
    }
}
```


第一次调用的主体很短。GetResponseAsync把问题交给服务，await等待结果，Text取出文本，WriteLine显示到终端。

```csharp
public static async Task Chat()
{
    using var client = CourseClient.Create();
    var response = await client.GetResponseAsync("请用两句话向新手解释什么是人工智能。");
    Console.WriteLine(response.Text);
}
```


AsIChatClient把具体提供商的客户端转换为 .NET 的通用聊天接口。它有利于替换提供商，但不会凭空补出服务本来不支持的功能。后面接工具、图片和结构化输出时，还要分别检查模型能力。

## 怎样算运行成功

终端应该显示一段中文解释。它的具体措辞每次可能不同，这属于模型生成的正常现象。确认答案围绕人工智能、没有程序异常，并在服务商控制台查看本次用量。不要为了得到与截图完全一样的文字反复付费调用。

## 按状态码排错

401通常与密钥或认证方式有关；403可能是权限或服务策略；404先检查基础地址与模型标识；429可能是频率、并发或额度限制。遇到400要阅读错误正文，可能是参数、上下文长度或能力不支持。

网络超时与认证错误也不同。先用一条短问题复现，再检查代理、DNS和服务状态。排错时可以记录状态码、请求时间和模型标识，不要把完整密钥贴进日志。服务端的具体错误说明优先于这张常见情况表。

## 小练习：只改问题，不改所有配置

先让模型解释“训练和推理”，再让它用三条要点回答，比较结果。每次只改一个变量，方便看出变化来自哪里。接下来读 [第一个 Agent](/articles/first-agent/)，把可重复使用的指令放到对象里，并逐步加入会话和工具。

## 参考资料

- [Microsoft.Extensions.AI](https://learn.microsoft.com/en-us/dotnet/ai/microsoft-extensions-ai)
- [OpenAI .NET SDK](https://github.com/openai/openai-dotnet)
