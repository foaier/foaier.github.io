---
title: "第一次生成真实文本向量：用 C# 比较两句话"
date: "2026-11-20"
summary: "调用真实 embedding 接口，理解维度与相似度输出。"
series: "提示词与知识库"
order: 2
tags: ["提示词与知识库","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["embeddings-schema","first-model-call"]
goals: ["调用真实 embedding 接口，理解维度与相似度输出。"]
---

上一课用人造坐标解释向量，现在把真实文本交给向量模型。我们比较“钱什么时候退回来”与两句话：退款到账说明、图片识别课程。如果模型适合中文语义搜索，前者通常更接近。但我们要读实际结果，而不是在代码里写死一个漂亮分数。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。需要支持 embedding 的服务。设置 AI_ENDPOINT、AI_API_KEY、AI_EMBEDDING_MODEL。向量模型名与聊天模型名不同，请从服务的 embedding 文档选择。此练习会发送三段演示文本到服务端。

~~~powershell
dotnet run --project Integrations -- embedding
~~~

## 代码是怎样工作的

程序逐条调用 GenerateEmbeddingAsync，把返回值转成 float 数组，打印实际维度，再计算余弦相似度。三段文本必须由同一模型、同一配置生成。Cosine 检查维度与零向量，避免把无意义数字继续传给后面的排序。

```csharp
using System.ClientModel;
using OpenAI;

namespace AiCourse.Integrations;

public static class EmbeddingLesson
{
    public static async Task Run()
    {
        var client = new OpenAIClient(new ApiKeyCredential(CourseClient.Required("AI_API_KEY")),
            new OpenAIClientOptions { Endpoint = new Uri(CourseClient.Required("AI_ENDPOINT")) })
            .GetEmbeddingClient(CourseClient.Required("AI_EMBEDDING_MODEL"));
        string[] texts = ["钱什么时候退回来？", "退款一般需要三个工作日到账。", "今天学习图片识别。"];
        var vectors = new List<float[]>();
        foreach (var text in texts)
            vectors.Add((await client.GenerateEmbeddingAsync(text)).Value.ToFloats().ToArray());
        Console.WriteLine($"维度：{vectors[0].Length}");
        for (var index = 1; index < texts.Length; index++)
            Console.WriteLine($"{Cosine(vectors[0], vectors[index]):F4} {texts[index]}");
    }

    public static double Cosine(float[] left, float[] right)
    {
        if (left.Length != right.Length || left.Length == 0) throw new ArgumentException("向量维度必须相同且非空。");
        double dot = 0, a = 0, b = 0;
        for (var index = 0; index < left.Length; index++)
        { dot += left[index] * right[index]; a += left[index] * left[index]; b += right[index] * right[index]; }
        if (a == 0 || b == 0) throw new ArgumentException("不能比较零向量。");
        return dot / Math.Sqrt(a * b);
    }
}

```



## 怎样判断成功

输出应有一个维度数和两个相似度。这里不承诺固定小数，也不把分数解释成正确率。若退款说明没有排在前面，检查模型对中文的支持、输入文本和检索任务适配性；不要为了让示例通过就改造数据隐藏问题。

## 自己改一次

把问题改成“退款多久到账”，再改成“怎样修改密码”，观察排序变化。保留每次原文、模型名称与向量维度。想升级成知识库时，还要保存来源、版本和权限信息，不能只把浮点数组写进数据库。

## 遇到问题先看这里

四零四可能是服务没有 embedding 接口，维度不符可能是混用了模型。不同模型即使维度相同，也不能直接比较。不要把聊天回答中的一串数字当成 embedding；必须使用返回向量的专用接口。

## 参考资料

- [Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [向量存储](https://learn.microsoft.com/en-us/semantic-kernel/concepts/vector-store-connectors/)
