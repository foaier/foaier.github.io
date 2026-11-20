---
title: "接入 DeepSeek：先换配置，再验证模型能力"
date: "2026-11-20"
summary: "用同一套 C# 客户端接入 DeepSeek，并分步验证工具和结构化输出。"
series: "Agent Framework 进阶"
order: 4
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-model-call"]
goals: ["用同一套 C# 客户端接入 DeepSeek，并分步验证工具和结构化输出。"]
---

接入另一家模型，最容易犯的错是一次改地址、模型、消息结构和业务逻辑，失败后不知道该查哪一层。这里保留第一次模型调用的程序，只换三个配置。先把最简单的聊天跑通，再逐个测试需要的能力。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。准备 DeepSeek 开放平台的 API Key。设置 AI_ENDPOINT=`https://api.deepseek.com`、AI_MODEL=deepseek-chat、AI_API_KEY=你的服务密钥。模型名称以账号当前可用列表为准。

~~~powershell
dotnet run --project Core -- chat
~~~

## 代码是怎样工作的

CourseClient 用 OpenAI 兼容的 Chat Completions 客户端访问 AI_ENDPOINT。兼容意味着一定范围内的请求结构相似，不意味着 Responses、后台任务、严格 JSON Schema 等能力完全相同。使用 deepseek-chat 开始普通问答；其他模型的推理字段和限制请单独核对。

```csharp
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
```



## 怎样判断成功

运行 Core 的 chat 能看到中文回答，说明认证、地址和基础聊天路径可用。之后再运行 tools，观察课程查询是否真实执行；再运行 structured，验证格式约束。每一步单独记录结果，比一个功能很全但报错模糊的大程序好定位。

## 自己改一次

先故意写错模型名称观察错误，再恢复。接着保留相同输入与提示词，对比已有服务的答案、延迟和工具行为。不要只比较价格或回答长度，也要确认中文任务、错误处理与并发限制是否满足应用需要。

## 遇到问题先看这里

四零一优先查密钥归属和余额，四零四查模型及基础路径，四二九看限流。不要重复拼接 /v1/chat/completions。网络问题与不支持参数应分别处理；本教程没有真实 DeepSeek 凭证，因此不把编译通过说成在线调用已验证。

## 参考资料

- [DeepSeek API](https://api-docs.deepseek.com/)
- [工具调用](https://api-docs.deepseek.com/guides/function_calling)
