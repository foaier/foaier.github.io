---
title: "视觉 Agent：把图片作为输入，而不是把路径发给模型"
date: "2026-11-20"
summary: "发送真实图片内容，区分看图描述与可靠的结构化识别。"
series: "Agent Framework 进阶"
order: 37
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-agent"]
goals: ["发送真实图片内容，区分看图描述与可靠的结构化识别。"]
---

把“D盘某张图”写进聊天文字，云端模型并不能访问你的电脑。视觉输入需要把图片内容或可访问地址按接口格式发送。本篇读取一张自己准备的简单图片，让模型描述可见内容，再用模糊区域测试它会不会承认看不清。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。 选择支持图片输入的模型，设置 AI_IMAGE_FILE 为本机 PNG 或 JPEG 文件的完整路径，示例限制五兆字节。

~~~powershell
dotnet run --project Core -- vision
~~~

## 代码是怎样工作的

程序按扩展名选择 MIME 类型，读取字节，用 DataContent 与 TextContent 组成一条用户消息。图片和问题一起交给 Agent。这里的扩展名检查只是教学中的格式选择，真实上传系统还应验证实际文件格式、大小与解码资源。

```csharp
public static async Task Vision()
    {
        var file = CourseClient.Required("AI_IMAGE_FILE");
        var bytes = await File.ReadAllBytesAsync(file);
        string mime = Path.GetExtension(file).ToLowerInvariant() switch
        { ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", _ => throw new InvalidOperationException("练习支持PNG或JPEG。") };
        if (bytes.Length > 5_000_000) throw new InvalidOperationException("练习图片请小于5MB。");
        var agent = CourseClient.Agent("只描述图中可见内容，模糊的文字要注明看不清。");
        var message = new ChatMessage(ChatRole.User, [new TextContent("这张图里有什么？"), new DataContent(bytes, mime)]);
        Console.WriteLine(await agent.RunAsync(message));
    }
```



## 怎样判断成功

应得到与图片内容一致的描述。再逐项核对物体和文字，记录看错与漏掉的地方。视觉语言模型可能猜测，不应把它的输出直接当成身份证号码、财务数字等关键字段的最终依据。

## 自己改一次

把同一图片裁剪或降低清晰度再运行，观察答案如何变化。明确要求“看不清就说明”，仍要人工核对。若任务主要是大量文档字段提取，可比较专门 OCR 或文档分析服务，而不是所有情况都用聊天模型。

## 遇到问题先看这里

不支持图片的模型可能返回参数错误；格式或大小不支持也会失败。发送图片会消耗相应额度，确保内容允许发给所选服务。图片里的文字同样属于输入资料，不能覆盖应用规则。

## 参考资料

- [多模态输入](https://learn.microsoft.com/en-us/agent-framework/agents/multimodal)
- [图像与视觉](https://platform.openai.com/docs/guides/images-vision)
