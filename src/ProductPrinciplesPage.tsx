import { useEffect, useState } from "react";
import ProductNavigation from "./ProductNavigation";
import ProductSiteFooter from "./ProductSiteFooter";
import { featureHref, siteLanguage } from "./productSite";
import "./product-feature.css";
import "./product-principles.css";

const copy = {
  zh: {
    label: "相关原理",
    title: "体验里的小细节，背后的几个原理。",
    description: "从创建一项任务，到为它安排时间。NavoPath 将小范围的 AI 判断、个人记录与明确的时间规则放在一起，让整理和执行少一些负担。",
    exampleLabel: "举个例子",
    sections: [
      {
        id: "jev", label: "JEV · 结构化判断", title: "少填几项，先把任务记下来。",
        paragraphs: [
          "JEV 是 TypeSafe AI 的结构化决策模型。在 NavoPath 中，它负责两个小问题：这项任务大概需要多久，以及它更适合哪个已有项目。返回的是时长、项目选项和各自的置信度，便于产品直接处理。",
          "任务先创建，建议在后台补充。时长从 15 分钟到 4 小时的选项中判断；项目也允许保持未归类。配置了可用的预测服务后，这些小判断就能减少重复填写。",
        ],
        example: "写下“整理数据分析课程笔记”，系统可以辅助估时，并建议归入“学习数据分析”。这里描述的是处理流程，实际建议取决于任务和已有项目。",
      },
      {
        id: "feedback", label: "置信度 · 个人记录", title: "建议有分寸，修改有优先级。",
        paragraphs: [
          "估时和归类分别判断。置信度用于决定是否应用估时、提示项目，或在更有把握时自动归类；它不保证判断正确。你已明确选择的项目、手动修改的时长，会受到保护，后台结果也会检查任务是否已发生变化。",
          "产品还会参考相似任务、记录过的用时和项目统计，整理出个人规划的参考信息。这些记录参与后续建议，让默认值更贴近你的使用情况。",
        ],
        example: "你把一项任务的时长改成 90 分钟，稍后返回的后台预测不会再覆盖这次手动修改。",
      },
      {
        id: "time", label: "时间网格 · 空闲时段", title: "安排要放得下，也要看得清。",
        paragraphs: [
          "安排引擎先扣除已有的忙碌时间，再从剩余时段中寻找能容纳任务的位置。任务时长、截止日期和项目的历史安排时间，都可以参与位置选择；时间不足时，会留下未安排任务和原因。",
          "默认按 15 分钟网格对齐，让拖动、调整和自动安排使用一致的时间尺度。执行时间与截止日期分别保存，改期时可以保留原来的截止日期。",
        ],
        example: "一项需要 90 分钟的任务，无法完整放进 30 分钟的空闲段。改到明天执行，也不会把截止日期一起改掉。",
      },
      {
        id: "control", label: "操作预览 · 撤回记录", title: "看清将要改变什么，再往前走。",
        paragraphs: [
          "Navo AI 的建议会转成具体的任务操作，在界面中展示目标任务、时间和原因。应用时仍要经过产品的时间与冲突检查，让模型建议落到可核对的任务数据上。",
          "支持撤回的操作会记录本轮变化，便于恢复之前的安排。网站上的 AI 体验使用预设请求和内存数据，正式工作区则按服务配置处理真实请求。",
        ],
        example: "查看一轮安排建议，调整后应用；如果不合适，再撤回这一轮，恢复原来的安排。",
      },
    ],
    sources: "继续了解",
    docs: "JEV 官方文档",
    code: "查看 NavoPath 的实现",
  },
  en: {
    label: "Principles",
    title: "Small details. Thoughtful foundations.",
    description: "From capturing a task to making time for it, NavoPath combines focused AI decisions, personal records, and clear scheduling rules to make planning a little lighter.",
    exampleLabel: "For example",
    sections: [
      {
        id: "jev", label: "JEV · Typed decisions", title: "Capture a task with less to fill in.",
        paragraphs: [
          "JEV is TypeSafe AI’s structured decision model. In NavoPath, it handles two focused questions: how long a task might take, and which existing project it fits. It returns duration and project choices with separate confidence values the product can use.",
          "The task is created first; suggestions follow in the background. Duration choices range from 15 minutes to four hours, and a project can remain unassigned. When a prediction service is configured and available, these decisions reduce repetitive input.",
        ],
        example: "Capture “Review data analysis course notes”. The system can estimate a duration and suggest the “Learn data analysis” project. This illustrates the process; actual suggestions depend on the task and existing projects.",
      },
      {
        id: "feedback", label: "Confidence · Personal records", title: "Suggestions that respect your choices.",
        paragraphs: [
          "Duration and project predictions are assessed separately. Confidence guides whether to apply an estimate, suggest a project, or assign it when confidence is higher; it does not guarantee correctness. Explicit project choices and manually edited durations are protected, and background results are checked against subsequent task changes.",
          "Similar tasks, recorded time, and project statistics also inform personal planning references. These records can contribute to later suggestions, bringing defaults closer to how you work.",
        ],
        example: "Change a task’s duration to 90 minutes. A background prediction arriving later will preserve that manual edit.",
      },
      {
        id: "time", label: "Time grid · Available slots", title: "A plan needs room to fit.",
        paragraphs: [
          "The scheduler subtracts existing busy time, then looks for slots that can hold each task. Duration, due dates, and historical project start times can influence placement. Tasks that do not fit remain unscheduled with an explanation.",
          "The default 15-minute grid gives dragging, adjustments, and automatic scheduling a common scale. Execution time and due dates are stored separately, so rescheduling can retain the original due date.",
        ],
        example: "A 90-minute task cannot fit in full into a 30-minute gap. Moving it to tomorrow does not also move its due date.",
      },
      {
        id: "control", label: "Action previews · Undo records", title: "See the change before moving ahead.",
        paragraphs: [
          "Navo AI suggestions become concrete task actions, showing the affected task, times, and reason. Applying them still goes through the product’s time and conflict checks, turning model suggestions into task changes you can inspect.",
          "Supported undo operations record the changes in that round so earlier arrangements can be restored. The website’s AI experience uses preset requests and in-memory data; the workspace handles real requests according to its service configuration.",
        ],
        example: "Review a proposed arrangement, adjust it, and apply it. If it does not suit your day, undo that round to restore the previous arrangement.",
      },
    ],
    sources: "Read further",
    docs: "Official JEV documentation",
    code: "Explore NavoPath’s implementation",
  },
};

export default function ProductPrinciplesPage() {
  const [lang, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const c = copy[lang];
  useEffect(() => {
    document.documentElement.classList.add("product-site-document");
    return () => document.documentElement.classList.remove("product-site-document");
  }, []);
  useEffect(() => {
    document.title = `${c.label} · NavoPath`;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = c.description;
    const url = new URL(location.href); url.searchParams.set("lang", lang); history.replaceState(null, "", url);
  }, [lang, c]);
  return <div className="np-feature np-principles">
    <header className="np-site-nav np-site-nav--product">
      <ProductNavigation feature="principles" lang={lang} icon={<img src={`${import.meta.env.BASE_URL}navopath-icon.png`} alt="" />} onLanguageChange={setLang} onNavigate={next => location.assign(featureHref(next, lang))} />
    </header>
    <main>
      <section className="np-principles-intro">
        <p className="np-principles-label">{c.label}</p>
        <h1>{c.title}</h1><p>{c.description}</p>
      </section>
      <article aria-label={c.label}>
        {c.sections.map((section, index) => <section className="np-principle" key={section.id} aria-labelledby={section.id}>
          <div className="np-principle-heading"><p className="np-principles-label"><span>{String(index + 1).padStart(2, "0")}</span>{section.label}</p><h2 id={section.id}>{section.title}</h2></div>
          <div className="np-principle-body">{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}<p className="np-principle-example"><strong>{c.exampleLabel}</strong>{section.example}</p></div>
        </section>)}
      </article>
      <aside className="np-principles-sources" aria-label={c.sources}><h2>{c.sources}</h2><a href="https://docs.typesafe.ai/introduction" target="_blank" rel="noreferrer">{c.docs}</a><a href="https://github.com/shawn89890916/NavoPath-planner" target="_blank" rel="noreferrer">{c.code}</a></aside>
      <ProductSiteFooter lang={lang} next="ai" />
    </main>
  </div>;
}
