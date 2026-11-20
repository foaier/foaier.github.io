---
title: "Plugins 与 DI：把业务服务的一个方法交给 Agent"
date: "2026-11-20"
summary: "从业务服务实例创建工具，而不是让模型直接接触整个服务。"
series: "Agent Framework 进阶"
order: 23
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-dependency-injection","agent-function-tools"]
goals: ["从业务服务实例创建工具，而不是让模型直接接触整个服务。"]
---

“给 Agent 加插件”听上去很大，其实可以从一个普通 C# 方法开始。课程目录服务知道每门课程要学多久，我们只把查询方法暴露给模型。Agent 不需要知道数据库怎么连，也不应该获得整个服务对象的所有能力。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。

~~~powershell
dotnet run --project Core -- plugin
~~~

## 代码是怎样工作的

CourseCatalog 由 DI 创建，Plugin 取得当前 scope 中的实例，再用 AIFunctionFactory.Create(catalog.Find) 把一个方法转成工具。参数描述帮助模型填入课程名；真正的查询逻辑仍在服务里执行。这里的 plugin 是能力封装的说法，不要求搬入 Semantic Kernel 的 KernelPlugin 类型。

```csharp
public static async Task Plugin()
    {
        var services = new ServiceCollection();
        services.AddScoped<CourseCatalog>();
        using var container = services.BuildServiceProvider(validateScopes: true);
        using var scope = container.CreateScope();
        var catalog = scope.ServiceProvider.GetRequiredService<CourseCatalog>();
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(instructions: "课程时长必须查询目录。",
            tools: [AIFunctionFactory.Create(catalog.Find)]);
        Console.WriteLine(await agent.RunAsync("C#起步课程需要多久？"));
    }
```


```csharp
public sealed class CourseCatalog
{
    [Description("查询课程时长，只读演示目录。")]
    public string Find([Description("课程名称")] string name) => name switch
    { "AI入门" => "30分钟", "C#起步" => "45分钟", _ => "未找到" };
}
```


## 怎样判断成功

问“C#起步课程需要多久”，工具目录中确定的结果是四十五分钟。模型最终语句可以变化，但数字不应靠猜。可以在 Find 中设断点确认执行；仅有一条正确回答不足以证明模型调用了方法。

## 自己改一次

增加一门“向量入门，六十分钟”的课程，再询问未收录课程。期望后一种情况返回未找到并澄清，而不是编造课时。把目录替换成数据库时，保留同样的输入输出契约，工具层只负责做必要的适配。

## 遇到问题先看这里

方法签名不能只写一个含糊的 object 参数，参数名和描述应表达业务含义。把服务注册成 Singleton 之前检查它是否持有请求状态或非线程安全对象。数据库权限由应用身份决定，不能接受模型传来的任意 SQL 并直接执行。

## 参考资料

- [Function tools](https://learn.microsoft.com/en-us/agent-framework/agents/tools/function-tools)
- [Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
