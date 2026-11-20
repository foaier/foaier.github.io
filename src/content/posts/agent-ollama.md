---
title: "接入 Ollama：在本机完成一次模型调用"
date: "2026-11-20"
summary: "通过 Ollama 的兼容接口运行模型，认识资源和功能限制。"
series: "Agent Framework 进阶"
order: 5
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-model-call"]
goals: ["通过 Ollama 的兼容接口运行模型，认识资源和功能限制。"]
---

本地模型让你能在自己的机器上体验推理过程，离线实验也更方便。代价是模型文件、内存和计算都由本机承担。“能启动一个模型”和“足够快地跑工具型 Agent”不是同一个门槛，先从一轮短问答开始。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。安装 Ollama，先用 ollama pull qwen3:4b 拉取模型，再用 ollama run qwen3:4b 验证本机推理。设置 AI_ENDPOINT=`http://localhost:11434/v1`、AI_MODEL=qwen3:4b、AI_API_KEY=ollama。本地实验的占位 Key 不代表服务有认证保护。

~~~powershell
dotnet run --project Core -- chat
~~~

## 代码是怎样工作的

课程仍使用 Chat Completions 客户端，地址改成本机 Ollama 的 /v1。模型名必须与 ollama list 中一致。先在 Ollama 自带终端对话，排除模型下载和运行问题，再运行 C#。这样服务没启动、模型名不对和代码错误不会混为一谈。

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

应返回一段回答，同时能在本机观察资源使用。第一次加载比后续请求慢很常见。基础问答成功后，如果要运行 tools 或结构化输出，应核对所选模型和 Ollama 版本支持情况，不能因为服务兼容接口就默认所有模型会调用工具。

## 自己改一次

选择机器能承受的更小模型，记录首次和后续响应时间，再比较同一问题的解释质量。然后把模型服务停止后运行客户端，认识连接失败的错误。此时应提示服务不可用，而不是说模型拒绝了你的问题。

## 遇到问题先看这里

连接被拒绝先检查服务与端口。内存不足不要无限重试，改用更小模型或降低上下文需求。不要把本机无认证端点直接暴露到公网。本文固定的是客户端依赖，模型文件和 Ollama 运行版本需要你另行记录，便于复现结果。

## 参考资料

- [Ollama OpenAI 兼容接口](https://docs.ollama.com/api/openai-compatibility)
- [Ollama 模型库](https://ollama.com/library/qwen3)
