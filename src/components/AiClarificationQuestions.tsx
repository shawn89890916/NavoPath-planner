import { useState } from "react";
import type { AiClarification } from "../aiAssistantApi";
import type { Language } from "../types";

type AiClarificationQuestionsProps = {
  clarifications: AiClarification[];
  lang: Language;
  disabled?: boolean;
  onSubmit: (message: string) => void | Promise<unknown>;
};

export default function AiClarificationQuestions({ clarifications, lang, disabled = false, onSubmit }: AiClarificationQuestionsProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const questions = clarifications.slice(0, 3);
  const complete = questions.length > 0 && questions.every((question) => Boolean(answers[question.id]?.trim()));
  const locked = disabled || submitting;

  const setAnswer = (id: string, answer: string) => {
    if (locked) return;
    setAnswers((current) => ({ ...current, [id]: answer }));
  };

  const submit = async () => {
    if (locked || !complete) return;
    const message = questions.map((question) => `${question.question}\n${(answers[question.id] || "").trim()}`).join("\n\n");
    setSubmitting(true);
    try {
      const result = await onSubmit(message);
      if (result === false) setSubmitting(false);
    } catch {
      setSubmitting(false);
    }
  };

  if (questions.length === 0) return null;
  return <div className={`df-ai-clarifications${disabled ? " is-disabled" : ""}`} aria-label={lang === "zh" ? "需要补充的信息" : "Clarification questions"}>
    <div className="df-ai-clarifications-head">
      <strong>{lang === "zh" ? "补充几项信息" : "A few details"}</strong>
      <small>{lang === "zh" ? "可直接选择，也可以填写自己的答案" : "Choose an option or write your own answer"}</small>
    </div>
    {questions.map((question, index) => {
      const answer = answers[question.id] || "";
      return <fieldset className="df-ai-clarification" key={question.id} disabled={locked}>
        <legend><span>{index + 1}</span>{question.question}</legend>
        <div className="df-ai-clarification-options">
          {question.options.slice(0, 3).map((option) => <button className={answer === option ? "selected" : ""} key={option} type="button" aria-pressed={answer === option} onClick={() => setAnswer(question.id, option)}>{option}</button>)}
        </div>
        <input type="text" value={answer} onChange={(event) => setAnswer(question.id, event.target.value)} placeholder={lang === "zh" ? "或输入你的答案" : "Or write your answer"} aria-label={question.question} />
      </fieldset>;
    })}
    <button className="df-ai-clarification-submit" type="button" disabled={locked || !complete} onClick={() => void submit()}>
      {submitting ? (lang === "zh" ? "正在发送…" : "Sending…") : (lang === "zh" ? "提交回答" : "Send answers")}
    </button>
  </div>;
}
