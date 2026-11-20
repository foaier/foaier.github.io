---
title: "多轮会话：为什么下一句能接住上一句"
date: "2026-11-20"
summary: "用 AgentSession 连续提问，并观察新会话的区别"
series: "Agent Framework 入门"
order: 2
tags: ["Agent Framework 入门","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-agent"]
goals: ["用 AgentSession 连续提问，并观察新会话的区别","理解当前对话、保存历史和长期记忆是三个不同问题"]
---

你对助手说“我的练习编号是DEMO-001”，下一句再问编号，它为什么能回答？这一课不凭感觉判断“有记忆了”，而是创建两个会话，观察相同的问题在不同上下文里得到什么结果。

## 先给每段对话一个容器

Session承载一次对话相关的状态。当前版本使用AgentSession，由agent.CreateSessionAsync创建。一次请求一个新Session，会把连续对话切断；把所有用户塞进同一个Session，又可能把甲的信息带到乙的回答里。

旧教程中可能出现AgentThread。看到不同类型名时先核对版本，不要把两套API拼在一个项目中。本课程核心示例固定在1.28.0，并统一使用Session。模型参数并不会因为创建一个Session就被重新训练。

## 准备并运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载并解压[课程示例](/downloads/ai-course.zip)。在解压后的 ai-course 目录打开终端。本篇使用 .NET 10，核心包 Microsoft.Agents.AI 1.28.0；依赖版本已写在项目文件中。

```powershell
dotnet run --project Core -- session
```

需要在线模型的练习，请先在当前终端设置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。不要把网页聊天产品的登录密码当作 API Key。模型调用会消耗所选服务的额度；本地模型则需要相应硬件和运行服务。

## 两个会话，做同一个问题

打开 Core/Lessons/FirstSteps.cs。先创建alice和bob两个Session，只把练习编号告诉alice，然后分别提问：

```csharp
public static async Task Session()
{
    var agent = CourseClient.Agent("只根据当前会话回答，不知道用户信息时说不知道。");
    AgentSession alice = await agent.CreateSessionAsync();
    AgentSession bob = await agent.CreateSessionAsync();
    Console.WriteLine(await agent.RunAsync("我正在学 C#，这次练习的编号是 DEMO-001。", alice));
    Console.WriteLine("同一会话：" + await agent.RunAsync("练习编号是什么？", alice));
    Console.WriteLine("新会话：" + await agent.RunAsync("练习编号是什么？", bob));
}
```


这里的alice和bob只是实验变量名。正式系统中，会话标识应与已认证的用户对应，并检查访问权限，不能只相信浏览器传来的一个字符串。用户拥有相同名称，也不意味着他们应该共享会话。

## 预期看到什么

同一会话应当能回答DEMO-001；新会话没有收到这个事实，应该说明不知道。如果新会话猜出一个编号，也不能认为它访问了另一个Session。生成模型可能猜测，应该检查实际发送的历史和输入内容。

可以把编号换成随机且无敏感意义的字符串，例如DEMO-728，重复实验。这样比问“我喜欢什么颜色”更容易判断是否真正利用了上下文。不要用真实身份证号、订单号或密钥做实验。

## 三种“记住”要分开

当前对话能接话，解决的是连续上下文。程序重启之后还能继续，解决的是状态保存与恢复。隔了很多段对话还能按用户偏好回答，通常要设计独立的长期记忆。这三种能力可以组合，但不能因为第一种成功就假设另外两种也成立。

本篇使用的普通聊天客户端主要在应用一侧组织历史。某些服务托管的Agent则会在远端保存状态，会话里可能持有远端标识。序列化Session不一定等于导出所有服务端数据，恢复时仍要具备相应资源与权限。

## 失败时怎样定位

如果同一Session也忘记了编号，检查第二次调用是否真的传了alice，是否中间重新创建了对象，是否设置了历史裁剪。再用更短的对话排除上下文过长。如果不同用户能读到彼此信息，先检查应用的会话映射和授权，不能靠提示词补救。

小练习：给bob告诉另一个编号，交替向两个Session提问。两个结果应该互不混淆。下一篇 [会话保存与恢复](/articles/agent-session-persistence/) 会把状态写入文件，让你关闭程序再继续。

## 参考资料

- [AgentSession 生命周期](https://learn.microsoft.com/en-us/agent-framework/concepts/agents/conversations/session)
- [聊天历史](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/chat-history)
