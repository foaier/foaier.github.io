---
title: "写 AI 程序之前：安装 .NET，运行你的第一个 C# 项目"
date: "2026-11-20"
summary: "安装并检查 .NET 10 SDK，理解终端、项目和运行目录"
series: "AI 编程起步"
order: 1
tags: ["AI 编程起步","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["prompt-engineering"]
goals: ["安装并检查 .NET 10 SDK，理解终端、项目和运行目录","下载课程示例，运行不需要模型密钥的自检"]
---

到这里，你已经能在聊天工具里做小实验。接下来让自己的程序发送请求、读取结果。我们用 C#，因为后面的 Agent Framework 和现有 .NET 项目可以自然衔接。你不用先学完整门语言课程，但要先把程序跑起来。

## 先分清编辑器、SDK 和终端

编辑器是写文件的工具，可以选 Visual Studio Code 或你熟悉的 IDE。SDK 是编译和运行开发项目的一套工具，本教程使用 .NET 10 SDK。终端是输入命令的地方；Windows 可以使用 PowerShell，macOS 和 Linux 可以使用系统终端。

到 [.NET 官方下载页](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) 安装与你的系统对应的 SDK。只装 Runtime 不够，因为 Runtime 主要用来运行现成程序，不能代替完整开发工具。

重新打开终端，输入：

```powershell
dotnet --list-sdks
dotnet --version
```

第一条应能看到10.0开头的版本。第二条显示当前目录选择的 SDK。课程示例中的 global.json 会选择已安装的 .NET 10 正式版，避免电脑上更新的预览版悄悄影响实验。

## 第一个项目先不用 AI

选一个自己找得到的文件夹，逐行执行。命令中的目录名就是即将创建的练习文件夹。

```powershell
dotnet new console -n HelloAi --framework net10.0
cd HelloAi
dotnet run
```

如果出现 Hello, World!，说明编译和运行链路已经正常。打开 Program.cs，把里面的内容换成下面这一行，再次运行。

```csharp
Console.WriteLine("今天开始学习 AI 开发。");
```

看到新的文字，就是本阶段的第一个成果。这里还没有模型请求，没有 API 密钥，也没有云服务费用。不要因为项目名字里有 AI，就误以为它已经具有智能。

## 下载后续课程示例

下载[完整课程示例包](/downloads/ai-course.zip)，解压后进入 ai-course 文件夹。里面的 Core 是模型和 Agent 练习，Workflows 是图式工作流练习。打开文件夹里的 README 可以看到具体命令。

```powershell
dotnet run --project Core -- check
dotnet run --project Workflows -- " rag "
```

第一条运行离线检查，不会访问模型。它检查检索结果、会话序列化和技能构造。第二条会依次打印 normalize、explain 和最终结果，验证工作流节点能衔接起来。第一次运行时需要联网下载 NuGet 依赖，之后通常会使用本机缓存。

Core 项目的直接依赖已经固定：Microsoft.Agents.AI 1.28.0、Microsoft.Extensions.AI.OpenAI 10.11.0 和 OpenAI 2.14.0。依赖在 Core.csproj 里，不用一边看教程一边猜应该安装哪个版本。涉及 Foundry、MCP 等集成的项目，会在对应章节单独说明。

## 在线模型需要另外配置什么

你需要服务商提供的 API 访问地址、模型标识和 API Key。它们分别回答“请求发到哪儿”“用哪个模型”“谁有调用权限”。聊天网页的会员与 API 额度可能独立计费，要以服务商说明为准。

本教程统一使用 AI_ENDPOINT、AI_MODEL、AI_API_KEY 三个环境变量。下一篇第一次调用会给出具体设置方法。不要把真实密钥写进 Program.cs、截图或博客，也不用为了准备环境现在就开通任何云资源。

## 常见问题怎么判断

找不到 dotnet：先重新打开终端，再确认安装的是 SDK。提示没有项目：看看终端当前目录，或使用明确的 --project 路径。提示无法还原包：检查网络与 NuGet 源，不要把模型密钥问题和依赖下载问题混在一起。

小练习：把 HelloAi 的输出换成自己的学习计划，运行两次，确认修改文件后结果会变化。再运行课程示例的 check 命令，记录你在哪个目录、用了什么命令。能稳定复现，比偶然成功一次更重要。

## 参考资料

- [.NET 10 下载](https://dotnet.microsoft.com/en-us/download/dotnet/10.0)
- [dotnet CLI 入门](https://learn.microsoft.com/en-us/dotnet/core/tools/)
